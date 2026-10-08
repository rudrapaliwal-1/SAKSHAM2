import {
  VehicleInput,
  DepotInput,
  DemandTargetInput,
  OptimizationOutput,
  OptimizedVehicleRoute,
  VrpStop,
  SolverConfigInput,
} from './vrp.types.js';
import { MatchingPreprocessor } from './matching.preprocessor.js';
import { RoutingService } from '../routing/routing.service.js';
import { OrToolsSolver, VrpSolverPayload } from './ortools.solver.js';
import { LatLng } from '../routing/coordinates.js';

const ROUTE_COLORS = ['#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308'];

export class OptimizationService {
  /**
   * Executes the full SAKSHAM Resource Matching + OSRM Matrix + OR-Tools VRP Optimization Pipeline.
   */
  static async optimizeRoutes(
    vehicles: VehicleInput[],
    depots: DepotInput[],
    demands: DemandTargetInput[],
    solverConfig?: SolverConfigInput
  ): Promise<OptimizationOutput> {
    const startTime = Date.now();

    // Filter only selected depots and demands if selected flag is provided
    const activeDepots = depots.filter((d) => d.selected !== false);
    const activeDemands = demands.filter((d) => d.selected !== false);

    if (!vehicles || vehicles.length === 0) {
      throw new Error('At least 1 vehicle required for route optimization.');
    }
    if (activeDepots.length === 0) {
      throw new Error('At least 1 active resource depot required for route optimization.');
    }
    if (activeDemands.length === 0) {
      throw new Error('At least 1 active demand target point required for route optimization.');
    }

    const useOsrm = solverConfig?.useOsrmRoadApi !== false;

    // ── STAGE 1: Resource-Demand Matching Preprocessing ──────────────────────
    const { matched, unmatched } = MatchingPreprocessor.preprocessDemands(activeDemands, activeDepots);

    const eligibleDemands = matched.map((m) => m.demand);
    if (eligibleDemands.length === 0) {
      return {
        status: 'NO_SOLUTION',
        message: 'No demands could be matched with available depot inventory.',
        routes: [],
        unfulfilledDemands: unmatched.map((u) => ({
          demandId: u.demand.id,
          itemNeeded: u.demand.itemNeeded,
          quantity: u.demand.quantity,
          priority: u.demand.priority,
          reason: u.ineligibilityReason || 'Stock depleted or incompatible.',
        })),
        metrics: {
          totalDistanceKm: 0,
          totalTravelTimeMinutes: 0,
          vehiclesUsed: 0,
          totalVehiclesAvailable: vehicles.length,
          requestsServed: 0,
          requestsUnfulfilled: activeDemands.length,
          criticalRequestsServed: 0,
          totalResourceAllocated: 0,
          optimizationTimeMs: Date.now() - startTime,
        },
        comparison: {
          baselineDistanceKm: 0,
          optimizedDistanceKm: 0,
          distanceSavedKm: 0,
          distanceImprovementPct: 0,
          baselineDurationMinutes: 0,
          optimizedDurationMinutes: 0,
          durationSavedMinutes: 0,
          durationImprovementPct: 0,
          baselineVehiclesNeeded: 0,
          optimizedVehiclesNeeded: 0,
          vehiclesSaved: 0,
        },
        reasoning: [],
        timestamp: new Date().toISOString(),
      };
    }

    // ── STAGE 2: Node Location Aggregation & OSRM Table Matrix ────────────────
    const allLocations: LatLng[] = [];
    const nodeIds: string[] = [];
    const nodeNames: string[] = [];
    const nodeDemands: number[] = [];
    const nodePriorities: string[] = [];
    const nodeCategories: string[] = [];

    // Add Depots (Nodes 0 to activeDepots.length - 1)
    activeDepots.forEach((d) => {
      allLocations.push(d.location);
      nodeIds.push(d.id);
      nodeNames.push(d.name);
      nodeDemands.push(0);
      nodePriorities.push('LOW');
      nodeCategories.push(d.category);
    });

    // Add Eligible Demands
    eligibleDemands.forEach((d) => {
      allLocations.push(d.location);
      nodeIds.push(d.id);
      nodeNames.push(d.locationName || d.title);
      nodeDemands.push(d.quantity);
      nodePriorities.push(d.priority);
      nodeCategories.push(d.category || d.itemNeeded);
    });

    // Map Vehicle Start and End Depots
    const vehicleStarts: number[] = [];
    const vehicleEnds: number[] = [];
    vehicles.forEach((v) => {
      let startIdx = activeDepots.findIndex((d) => d.id === v.startDepotId);
      if (startIdx === -1) startIdx = 0;
      let endIdx = v.endDepotId ? activeDepots.findIndex((d) => d.id === v.endDepotId) : startIdx;
      if (endIdx === -1) endIdx = startIdx;

      vehicleStarts.push(startIdx);
      vehicleEnds.push(endIdx);
    });

    // Build OSRM Travel Matrix (or simulation fallback if disabled)
    const tableResult = await RoutingService.getTable(allLocations, !useOsrm);

    // ── STAGE 3: Multi-Vehicle OR-Tools VRP Optimization ─────────────────────
    const serviceTimeSeconds = Math.round((solverConfig?.serviceTimeMinutesPerStop ?? 10) * 60);

    const vrpPayload: VrpSolverPayload = {
      distance_matrix: tableResult.distanceMatrix,
      duration_matrix: tableResult.durationMatrix,
      demands: nodeDemands,
      vehicle_capacities: vehicles.map((v) => v.capacity),
      num_vehicles: vehicles.length,
      starts: vehicleStarts,
      ends: vehicleEnds,
      priorities: nodePriorities,
      node_ids: nodeIds,
      strategy: solverConfig?.strategy || 'PATH_CHEAPEST_ARC',
      max_solve_time_seconds: solverConfig?.maxSolveTimeSeconds || 5,
      service_time_seconds_per_stop: serviceTimeSeconds,
    };

    const vrpSolution = await OrToolsSolver.solve(vrpPayload);

    // ── STAGE 4: Real Road Geometry Synthesis & Stop Manifest Assembly ────────
    const finalRoutes: OptimizedVehicleRoute[] = [];
    let totalOptimizedDistanceKm = 0;
    let totalOptimizedDurationMin = 0;
    let totalResourceAllocated = 0;
    let criticalRequestsServed = 0;
    let totalRequestsServed = 0;

    for (let rIdx = 0; rIdx < vrpSolution.routes.length; rIdx++) {
      const rawRoute = vrpSolution.routes[rIdx];
      const vehicle = vehicles[rawRoute.vehicle_index];
      if (!vehicle) continue;

      const stopWaypoints: LatLng[] = [];
      const stops: VrpStop[] = [];
      let accumulatedLoad = 0;
      let cumulativeDurationSeconds = 0;
      let cumulativeDistanceKm = 0;

      const priorityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      const routeColor = vehicle.color || ROUTE_COLORS[rIdx % ROUTE_COLORS.length];

      for (let sIdx = 0; sIdx < rawRoute.node_indices.length; sIdx++) {
        const nodeIdx = rawRoute.node_indices[sIdx];
        const isDepot = nodeIdx < activeDepots.length;
        const loc = allLocations[nodeIdx];
        stopWaypoints.push(loc);

        const dQty = nodeDemands[nodeIdx];
        accumulatedLoad += dQty;

        if (!isDepot) {
          totalRequestsServed++;
          const prio = (nodePriorities[nodeIdx] || 'MEDIUM').toUpperCase();
          if (prio === 'CRITICAL') {
            priorityCounts.critical++;
            criticalRequestsServed++;
          } else if (prio === 'HIGH') {
            priorityCounts.high++;
          } else if (prio === 'MEDIUM') {
            priorityCounts.medium++;
          } else {
            priorityCounts.low++;
          }
        }

        let legDistKm = 0;
        if (sIdx > 0) {
          const prevNode = rawRoute.node_indices[sIdx - 1];
          const distM = tableResult.distanceMatrix[prevNode][nodeIdx];
          const durS = tableResult.durationMatrix[prevNode][nodeIdx];
          legDistKm = Math.round((distM / 1000) * 10) / 10;
          cumulativeDurationSeconds += durS + (isDepot ? 0 : serviceTimeSeconds);
          cumulativeDistanceKm += legDistKm;
        }

        stops.push({
          stopIndex: sIdx,
          nodeId: nodeIds[nodeIdx],
          nodeType: isDepot ? 'DEPOT' : 'DEMAND',
          name: nodeNames[nodeIdx],
          location: loc,
          demandQuantity: dQty,
          accumulatedLoad,
          priority: isDepot ? undefined : (nodePriorities[nodeIdx] as any),
          etaMinutesFromStart: Math.round(cumulativeDurationSeconds / 60),
          distanceFromPrevKm: legDistKm,
          resourceCategory: nodeCategories[nodeIdx],
        });
      }

      // Generate actual road geometry via OSRM Route Service
      let roadGeometry = await RoutingService.getRoute(stopWaypoints, !useOsrm);

      // Generate natural language explanation
      const explanationPoints: string[] = [];
      const assignedDepot = activeDepots[vehicleStarts[rawRoute.vehicle_index]] || activeDepots[0];
      const demandStopsCount = stops.filter((s) => s.nodeType === 'DEMAND').length;

      if (demandStopsCount > 0) {
        explanationPoints.push(
          `Dispatched from ${assignedDepot.name} with ${rawRoute.load.toLocaleString()} / ${vehicle.capacity.toLocaleString()} units cargo.`
        );
        explanationPoints.push(
          `Serves ${demandStopsCount} demand point(s) (${priorityCounts.critical} CRITICAL, ${priorityCounts.high} HIGH).`
        );
        explanationPoints.push(
          `Optimized multi-stop road itinerary: ${roadGeometry.distanceKm} km (~${roadGeometry.durationMinutes} min).`
        );
        explanationPoints.push(`Capacity utilization: ${rawRoute.load_percentage}% within safe vehicular payload limit.`);
      } else {
        explanationPoints.push(`Vehicle on standby reserve at ${assignedDepot.name}.`);
      }

      finalRoutes.push({
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        vehicleType: vehicle.type,
        driverName: vehicle.driverName || 'Convoy Commander',
        depotId: assignedDepot.id,
        depotName: assignedDepot.name,
        color: routeColor,
        status: demandStopsCount > 0 ? 'ASSIGNED' : 'PLANNED',
        stops,
        totalDistanceKm: roadGeometry.distanceKm,
        totalDurationMinutes: roadGeometry.durationMinutes,
        totalLoadDelivered: rawRoute.load,
        vehicleCapacity: vehicle.capacity,
        capacityUtilizationPct: rawRoute.load_percentage,
        prioritySummary: priorityCounts,
        roadGeometry,
        routingSource: roadGeometry.source,
        optimizerEngine: vrpSolution.engineUsed,
        explanation: explanationPoints,
      });

      if (demandStopsCount > 0) {
        totalOptimizedDistanceKm += roadGeometry.distanceKm;
        totalOptimizedDurationMin += roadGeometry.durationMinutes;
        totalResourceAllocated += rawRoute.load;
      }
    }

    // ── STAGE 5: Baseline Comparison Calculation ─────────────────────────────
    let baselineDistanceKm = 0;
    let baselineDurationMinutes = 0;
    eligibleDemands.forEach((d) => {
      const roundTripDistMeters = (tableResult.distanceMatrix[0][activeDepots.length + eligibleDemands.indexOf(d)] || 15000) * 2;
      const roundTripDurSec = (tableResult.durationMatrix[0][activeDepots.length + eligibleDemands.indexOf(d)] || 1200) * 2;
      baselineDistanceKm += roundTripDistMeters / 1000;
      baselineDurationMinutes += roundTripDurSec / 60;
    });

    baselineDistanceKm = Math.round(baselineDistanceKm * 10) / 10;
    baselineDurationMinutes = Math.round(baselineDurationMinutes * 10) / 10;
    totalOptimizedDistanceKm = Math.round(totalOptimizedDistanceKm * 10) / 10;
    totalOptimizedDurationMin = Math.round(totalOptimizedDurationMin * 10) / 10;

    const distanceSavedKm = Math.max(0, Math.round((baselineDistanceKm - totalOptimizedDistanceKm) * 10) / 10);
    const distanceImprovementPct = baselineDistanceKm > 0 ? Math.round((distanceSavedKm / baselineDistanceKm) * 1000) / 10 : 0;

    const durationSavedMinutes = Math.max(0, Math.round((baselineDurationMinutes - totalOptimizedDurationMin) * 10) / 10);
    const durationImprovementPct = baselineDurationMinutes > 0 ? Math.round((durationSavedMinutes / baselineDurationMinutes) * 1000) / 10 : 0;

    const activeVehiclesCount = finalRoutes.filter((r) => r.stops.some((s) => s.nodeType === 'DEMAND')).length;

    const allUnfulfilled = [
      ...unmatched.map((u) => ({
        demandId: u.demand.id,
        itemNeeded: u.demand.itemNeeded,
        quantity: u.demand.quantity,
        priority: u.demand.priority,
        reason: u.ineligibilityReason || 'Depot capacity constraint.',
      })),
      ...vrpSolution.unfulfilled.map((u) => {
        const dObj = eligibleDemands[u.node_index - activeDepots.length];
        return {
          demandId: u.node_id,
          itemNeeded: dObj?.itemNeeded || 'Emergency Supplies',
          quantity: u.demand,
          priority: u.priority as any,
          reason: 'Vehicle fleet capacity exhausted or route time limit reached.',
        };
      }),
    ];

    const reasoning = finalRoutes.map((r) => ({
      vehicleId: r.vehicleId,
      summary: `${r.vehicleName} (${r.vehicleType}) · ${r.stops.filter((s) => s.nodeType === 'DEMAND').length} Stops · ${r.totalDistanceKm} km (~${r.totalDurationMinutes} min)`,
      points: r.explanation,
    }));

    return {
      status: allUnfulfilled.length === 0 ? 'OPTIMAL' : 'PARTIAL',
      message:
        allUnfulfilled.length === 0
          ? `${finalRoutes.filter((r) => r.stops.length > 2).length} vehicle itineraries generated successfully.`
          : `${allUnfulfilled.length} demand point(s) require additional fleet capacity.`,
      routes: finalRoutes,
      unfulfilledDemands: allUnfulfilled,
      metrics: {
        totalDistanceKm: totalOptimizedDistanceKm,
        totalTravelTimeMinutes: totalOptimizedDurationMin,
        vehiclesUsed: activeVehiclesCount,
        totalVehiclesAvailable: vehicles.length,
        requestsServed: totalRequestsServed,
        requestsUnfulfilled: allUnfulfilled.length,
        criticalRequestsServed,
        totalResourceAllocated,
        optimizationTimeMs: Date.now() - startTime,
      },
      comparison: {
        baselineDistanceKm,
        optimizedDistanceKm: totalOptimizedDistanceKm,
        distanceSavedKm,
        distanceImprovementPct,
        baselineDurationMinutes,
        optimizedDurationMinutes: totalOptimizedDurationMin,
        durationSavedMinutes,
        durationImprovementPct,
        baselineVehiclesNeeded: eligibleDemands.length,
        optimizedVehiclesNeeded: activeVehiclesCount,
        vehiclesSaved: Math.max(0, eligibleDemands.length - activeVehiclesCount),
      },
      reasoning,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generates the reference Indian National Disaster Management Scenario.
   */
  static getDemoScenario(): {
    depots: DepotInput[];
    demands: DemandTargetInput[];
    vehicles: VehicleInput[];
  } {
    const depots: DepotInput[] = [
      {
        id: 'DEPOT-NAT-01',
        name: 'National Disaster Command Hub',
        location: { lat: 28.6139, lng: 77.2090 },
        locationName: 'New Delhi (HQ)',
        category: 'MEDICAL',
        resourceTypes: ['MEDICAL', 'WATER', 'FOOD', 'SHELTER_SUPPLIES'],
        availableQuantity: 10000,
        allocatedQuantity: 0,
        status: 'ACTIVE',
        stationedVehicleCount: 2,
        selected: true,
      },
      {
        id: 'DEPOT-MAR-02',
        name: 'Western Maritime & Coastal Hub',
        location: { lat: 19.0760, lng: 72.8777 },
        locationName: 'Mumbai, Maharashtra',
        category: 'WATER',
        resourceTypes: ['WATER', 'FOOD', 'RESCUE_EQUIPMENT'],
        availableQuantity: 9000,
        allocatedQuantity: 0,
        status: 'ACTIVE',
        stationedVehicleCount: 2,
        selected: true,
      },
      {
        id: 'DEPOT-EAS-03',
        name: 'Eastern Regional Logistics Base',
        location: { lat: 22.5726, lng: 88.3639 },
        locationName: 'Kolkata, West Bengal',
        category: 'FOOD',
        resourceTypes: ['FOOD', 'CLOTHING', 'SHELTER_SUPPLIES'],
        availableQuantity: 8000,
        allocatedQuantity: 0,
        status: 'ACTIVE',
        stationedVehicleCount: 1,
        selected: true,
      },
      {
        id: 'DEPOT-SOU-04',
        name: 'Southern Peninsular Depot',
        location: { lat: 13.0827, lng: 80.2707 },
        locationName: 'Chennai, Tamil Nadu',
        category: 'MEDICAL',
        resourceTypes: ['MEDICAL', 'WATER', 'FOOD'],
        availableQuantity: 7500,
        allocatedQuantity: 0,
        status: 'ACTIVE',
        stationedVehicleCount: 1,
        selected: true,
      },
    ];

    const demands: DemandTargetInput[] = [
      {
        id: 'DEM-SRI-01',
        requestId: 'REQ-101',
        title: 'Srinagar Valley Relief Staging',
        location: { lat: 34.0837, lng: 74.7973 },
        locationName: 'Srinagar, Jammu & Kashmir',
        category: 'MEDICAL',
        itemNeeded: 'Emergency Medical & Trauma Kits',
        quantity: 1200,
        unit: 'units',
        priority: 'CRITICAL',
        peopleAffected: 4800,
        status: 'PENDING',
        selected: true,
      },
      {
        id: 'DEM-KUT-02',
        requestId: 'REQ-102',
        title: 'Kutch Coastal Evacuation Base',
        location: { lat: 23.2420, lng: 69.6669 },
        locationName: 'Bhuj, Kutch, Gujarat',
        category: 'WATER',
        itemNeeded: 'Potable Drinking Water & Rations',
        quantity: 1400,
        unit: 'units',
        priority: 'CRITICAL',
        peopleAffected: 5600,
        status: 'PENDING',
        selected: true,
      },
      {
        id: 'DEM-BRA-03',
        requestId: 'REQ-103',
        title: 'Brahmaputra Flood Command',
        location: { lat: 26.1445, lng: 91.7362 },
        locationName: 'Guwahati, Assam',
        category: 'FOOD',
        itemNeeded: 'High-Calorie Ready-to-Eat Rations',
        quantity: 1800,
        unit: 'units',
        priority: 'CRITICAL',
        peopleAffected: 7200,
        status: 'PENDING',
        selected: true,
      },
      {
        id: 'DEM-JOS-04',
        requestId: 'REQ-104',
        title: 'Joshimath Subsidence Emergency Center',
        location: { lat: 30.5574, lng: 79.5663 },
        locationName: 'Joshimath, Chamoli, Uttarakhand',
        category: 'MEDICAL',
        itemNeeded: 'Triage & Cold Weather Medical Kits',
        quantity: 800,
        unit: 'units',
        priority: 'CRITICAL',
        peopleAffected: 3200,
        status: 'PENDING',
        selected: true,
      },
      {
        id: 'DEM-PUR-05',
        requestId: 'REQ-105',
        title: 'Puri Cyclone Evacuation Camp',
        location: { lat: 19.8135, lng: 85.8312 },
        locationName: 'Puri Coastal Zone, Odisha',
        category: 'FOOD',
        itemNeeded: 'Emergency Nutrition & Blankets',
        quantity: 1500,
        unit: 'units',
        priority: 'HIGH',
        peopleAffected: 6000,
        status: 'PENDING',
        selected: true,
      },
      {
        id: 'DEM-WAY-06',
        requestId: 'REQ-106',
        title: 'Wayanad Landslide Medical Outpost',
        location: { lat: 11.6854, lng: 76.1320 },
        locationName: 'Meppadi, Wayanad, Kerala',
        category: 'MEDICAL',
        itemNeeded: 'Advanced Triage Trauma Supplies',
        quantity: 950,
        unit: 'units',
        priority: 'CRITICAL',
        peopleAffected: 3800,
        status: 'PENDING',
        selected: true,
      },
      {
        id: 'DEM-BAR-07',
        requestId: 'REQ-107',
        title: 'Barmer Desert Border Relief Post',
        location: { lat: 25.7532, lng: 71.4181 },
        locationName: 'Barmer, Rajasthan',
        category: 'WATER',
        itemNeeded: 'Emergency Water Bowsers & Cans',
        quantity: 700,
        unit: 'units',
        priority: 'MEDIUM',
        peopleAffected: 2800,
        status: 'PENDING',
        selected: true,
      },
      {
        id: 'DEM-SUN-08',
        requestId: 'REQ-108',
        title: 'Sundarbans Coastal Surge Station',
        location: { lat: 21.9497, lng: 88.9000 },
        locationName: 'Gosaba, Sundarbans, West Bengal',
        category: 'FOOD',
        itemNeeded: 'Purification Kits & Dry Supplies',
        quantity: 1100,
        unit: 'units',
        priority: 'HIGH',
        peopleAffected: 4400,
        status: 'PENDING',
        selected: true,
      },
    ];

    const vehicles: VehicleInput[] = [
      {
        id: 'V-01',
        name: 'Convoy Alpha (Northern)',
        type: 'HEAVY RELIEF CONVOY',
        capacity: 5000,
        currentLocation: { lat: 28.6139, lng: 77.2090 },
        startDepotId: 'DEPOT-NAT-01',
        endDepotId: 'DEPOT-NAT-01',
        driverName: 'Col. Vikram Singh (NDRF)',
        status: 'AVAILABLE',
        speedKmh: 45,
        color: '#F97316', // Orange
      },
      {
        id: 'V-02',
        name: 'Rapid Air/Road Transport',
        type: 'HIGH-SPEED MEDICAL TRANSPORTER',
        capacity: 3000,
        currentLocation: { lat: 28.6139, lng: 77.2090 },
        startDepotId: 'DEPOT-NAT-01',
        endDepotId: 'DEPOT-NAT-01',
        driverName: 'Maj. Sneha Rao (Disaster Medical Corps)',
        status: 'AVAILABLE',
        speedKmh: 55,
        color: '#10B981', // Green
      },
      {
        id: 'V-03',
        name: 'Western Carrier Bravo',
        type: 'ALL-TERRAIN WATER BOWSER',
        capacity: 4500,
        currentLocation: { lat: 19.0760, lng: 72.8777 },
        startDepotId: 'DEPOT-MAR-02',
        endDepotId: 'DEPOT-MAR-02',
        driverName: 'Subedar R. Patil (Coast Guard Support)',
        status: 'AVAILABLE',
        speedKmh: 42,
        color: '#3B82F6', // Blue
      },
      {
        id: 'V-04',
        name: 'Eastern Disaster Transporter',
        type: 'HEAVY RIVERINE SUPPLY TRUCK',
        capacity: 4000,
        currentLocation: { lat: 22.5726, lng: 88.3639 },
        startDepotId: 'DEPOT-EAS-03',
        endDepotId: 'DEPOT-EAS-03',
        driverName: 'Capt. A. Mukherjee (State Disaster Relief)',
        status: 'AVAILABLE',
        speedKmh: 40,
        color: '#8B5CF6', // Purple
      },
      {
        id: 'V-05',
        name: 'Southern Emergency Convoy',
        type: 'RAPID MOBILITY EMERGENCY FLEET',
        capacity: 4000,
        currentLocation: { lat: 13.0827, lng: 80.2707 },
        startDepotId: 'DEPOT-SOU-04',
        endDepotId: 'DEPOT-SOU-04',
        driverName: 'Lt. K. Ramanathan (Southern Command Logistics)',
        status: 'AVAILABLE',
        speedKmh: 48,
        color: '#EC4899', // Pink
      },
    ];

    return { depots, demands, vehicles };
  }
}
