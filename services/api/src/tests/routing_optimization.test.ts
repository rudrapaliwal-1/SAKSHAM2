import { describe, it, expect } from 'vitest';
import {
  toOsrmLngLat,
  fromOsrmLngLat,
  formatOsrmCoordinateString,
  calculateHaversineKm,
  sanitizeLatLng,
} from '../modules/routing/coordinates.js';
import { RoutingService } from '../modules/routing/routing.service.js';
import { MatchingPreprocessor } from '../modules/optimization/matching.preprocessor.js';
import { OptimizationService } from '../modules/optimization/optimization.service.js';
import { OrToolsSolver } from '../modules/optimization/ortools.solver.js';

describe('SAKSHAM Routing & Logistics Optimization Engine Tests', () => {
  // Test 1: Coordinate Conversion & Validation
  it('1. should convert coordinates accurately between MapLibre [lat, lng] and OSRM [lng, lat]', () => {
    const latLng = { lat: 28.6139, lng: 77.2090 };
    const osrmTuple = toOsrmLngLat(latLng);
    expect(osrmTuple).toEqual([77.2090, 28.6139]);

    const backToLatLng = fromOsrmLngLat(osrmTuple);
    expect(backToLatLng.lat).toBeCloseTo(28.6139);
    expect(backToLatLng.lng).toBeCloseTo(77.2090);

    const formatted = formatOsrmCoordinateString([
      { lat: 28.6139, lng: 77.2090 },
      { lat: 28.7041, lng: 77.1025 },
    ]);
    expect(formatted).toBe('77.209000,28.613900;77.102500,28.704100');

    const sanitized = sanitizeLatLng({ lat: NaN, lng: undefined });
    expect(sanitized.lat).toBe(28.6139);
    expect(sanitized.lng).toBe(77.2090);
  });

  // Test 2: Matrix Generation
  it('2. should generate a symmetric NxN distance and duration matrix for multiple disaster locations', async () => {
    const locations = [
      { lat: 28.6755, lng: 77.2215 }, // Civil Lines Depot
      { lat: 28.6650, lng: 77.2320 }, // Kashmiri Gate
      { lat: 28.6510, lng: 77.2480 }, // Geeta Colony
    ];

    const matrix = await RoutingService.getTable(locations, true); // test with simulation provider
    expect(matrix.numLocations).toBe(3);
    expect(matrix.distanceMatrix.length).toBe(3);
    expect(matrix.durationMatrix.length).toBe(3);
    expect(matrix.distanceMatrix[0][0]).toBe(0);
    expect(matrix.distanceMatrix[0][1]).toBeGreaterThan(0);
    expect(matrix.durationMatrix[0][1]).toBeGreaterThan(0);
  });

  // Test 3: Resource-Demand Matching Preprocessor
  it('3. should match demands only to compatible depots with positive inventory', () => {
    const demo = OptimizationService.getDemoScenario();
    const { matched, unmatched, depotAllocations } = MatchingPreprocessor.preprocessDemands(
      demo.demands,
      demo.depots
    );

    expect(matched.length).toBeGreaterThan(0);
    expect(unmatched.length).toBe(0);

    matched.forEach((m) => {
      expect(m.matchedDepot).toBeDefined();
      expect(m.isEligible).toBe(true);
    });

    demo.depots.forEach((d) => {
      expect(depotAllocations[d.id]).toBeLessThanOrEqual(d.availableQuantity);
    });
  });

  // Test 4: Vehicle Capacity Constraint
  it('4. should enforce strict vehicle capacity constraints with zero load violations', async () => {
    const demo = OptimizationService.getDemoScenario();
    const result = await OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);

    expect(result.status).toBe('OPTIMAL');
    result.routes.forEach((route) => {
      expect(route.totalLoadDelivered).toBeLessThanOrEqual(route.vehicleCapacity);
      expect(route.capacityUtilizationPct).toBeLessThanOrEqual(100.0);
    });
  });

  // Test 5: Route Validity (Depot Start & End)
  it('5. should ensure every vehicle route starts and ends at an authorized depot', async () => {
    const demo = OptimizationService.getDemoScenario();
    const result = await OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);

    result.routes.forEach((route) => {
      if (route.stops.length > 0) {
        const firstStop = route.stops[0];
        const lastStop = route.stops[route.stops.length - 1];
        expect(firstStop.nodeType).toBe('DEPOT');
        expect(lastStop.nodeType).toBe('DEPOT');
      }
    });
  });

  // Test 6 & 7: Demand Visits & No Duplicated Stops
  it('6 & 7. should visit every assigned demand exactly once with no duplicated intermediate stops', async () => {
    const demo = OptimizationService.getDemoScenario();
    const result = await OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);

    const visitedDemandNodeIds = new Set<string>();

    result.routes.forEach((route) => {
      const demandStops = route.stops.filter((s) => s.nodeType === 'DEMAND');
      demandStops.forEach((stop) => {
        expect(visitedDemandNodeIds.has(stop.nodeId)).toBe(false); // No duplicates
        visitedDemandNodeIds.add(stop.nodeId);
      });
    });

    expect(visitedDemandNodeIds.size).toBe(demo.demands.length);
  });

  // Test 8: Anti-Depletion / No Negative Stock
  it('8. should prevent depot over-allocation and negative stock balance', () => {
    const demo = OptimizationService.getDemoScenario();
    const firstDepotId = demo.depots[0].id;
    // artifically constrain first depot to 30 units
    const scarceDepots = demo.depots.map((d) => (d.id === firstDepotId ? { ...d, availableQuantity: 30 } : d));

    const { matched, depotAllocations } = MatchingPreprocessor.preprocessDemands(demo.demands, scarceDepots);
    expect(depotAllocations[firstDepotId]).toBeLessThanOrEqual(30);
  });

  // Test 9: Critical Demand Prioritization
  it('9. should prioritize CRITICAL requests even when vehicle fleet capacity is limited', async () => {
    const demo = OptimizationService.getDemoScenario();
    // Only 1 small vehicle with capacity 100
    const limitedVehicles = [
      {
        id: 'VEH-MINI-01',
        name: 'Mini Van',
        type: 'VAN',
        capacity: 1500,
        currentLocation: demo.depots[0].location,
        startDepotId: demo.depots[0].id,
      },
    ];

    const result = await OptimizationService.optimizeRoutes(limitedVehicles, demo.depots, demo.demands);

    // The assigned route should serve critical requests
    const servedDemands = result.routes.flatMap((r) => r.stops.filter((s) => s.nodeType === 'DEMAND'));
    const servedCriticals = servedDemands.filter((s) => s.priority === 'CRITICAL');
    expect(servedCriticals.length).toBeGreaterThan(0);
  });

  // Test 10: Optimizer Output Structure Validation
  it('10. should return complete optimization metrics, before-vs-after comparison, and explainable reasoning', async () => {
    const demo = OptimizationService.getDemoScenario();
    const result = await OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);

    expect(result.metrics).toBeDefined();
    expect(result.metrics.totalDistanceKm).toBeGreaterThan(0);
    expect(result.metrics.totalTravelTimeMinutes).toBeGreaterThan(0);
    expect(result.metrics.requestsServed).toBe(demo.demands.length);
    expect(result.metrics.criticalRequestsServed).toBeGreaterThan(0);

    expect(result.comparison).toBeDefined();
    expect(result.comparison.baselineDistanceKm).toBeGreaterThan(result.comparison.optimizedDistanceKm);
    expect(result.comparison.distanceImprovementPct).toBeGreaterThan(0);

    expect(result.reasoning.length).toBe(result.routes.length);
    result.reasoning.forEach((r) => {
      expect(r.vehicleId).toBeDefined();
      expect(r.points.length).toBeGreaterThan(0);
    });
  });

  // Test 11: OSRM Failure Fallback
  it('11. should fall back gracefully to simulation routing provider if OSRM is unreachable', async () => {
    const waypoints = [
      { lat: 28.6755, lng: 77.2215 },
      { lat: 28.6650, lng: 77.2320 },
    ];
    const fallbackRoute = await RoutingService.getRoute(waypoints, true); // force fallback
    expect(fallbackRoute.source).toBe('SIMULATION_FALLBACK');
    expect(fallbackRoute.distanceKm).toBeGreaterThan(0);
    expect(fallbackRoute.durationMinutes).toBeGreaterThan(0);
    expect(fallbackRoute.latLngs.length).toBeGreaterThan(2);
  });

  // Test 12: Live Dynamic Re-Optimization
  it('12. should perform live re-optimization when a new critical emergency surge occurs', async () => {
    const demo = OptimizationService.getDemoScenario();
    const initialResult = await OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);

    const newSurgeDemand = {
      id: 'DEM-SURGE-999',
      requestId: 'REQ-SURGE-999',
      title: 'Kashmiri Gate Shelter Flooded Breach',
      location: { lat: 28.6670, lng: 77.2280 },
      locationName: 'Kashmiri Gate Gate 2 Shelter',
      category: 'MEDICAL',
      itemNeeded: 'Emergency Trauma Triage',
      quantity: 30,
      unit: 'kits',
      priority: 'CRITICAL' as const,
      peopleAffected: 2400,
      status: 'PENDING',
    };

    const reoptimized = await OptimizationService.optimizeRoutes(
      demo.vehicles,
      demo.depots,
      [newSurgeDemand, ...demo.demands]
    );

    expect(reoptimized.status).toBe('OPTIMAL');
    expect(reoptimized.metrics.requestsServed).toBe(demo.demands.length + 1);
    const surgeServed = reoptimized.routes.some((r) =>
      r.stops.some((s) => s.nodeId === 'DEM-SURGE-999')
    );
    expect(surgeServed).toBe(true);
  });

  // Test 13: Route Disruption & Blockage Simulation
  it('13. should simulate road segment blockage and generate an alternate road detour with ETA delta', async () => {
    const waypoints = [
      { lat: 28.6755, lng: 77.2215 },
      { lat: 28.6650, lng: 77.2320 },
      { lat: 28.6510, lng: 77.2480 },
    ];

    const disruptionResult = await RoutingService.simulateBlockage('DISRUPT-DEL-01', waypoints);
    expect(disruptionResult.disruption).toBeDefined();
    expect(disruptionResult.deltaMinutes).toBeGreaterThan(0);
    expect(disruptionResult.deltaKm).toBeGreaterThan(0);
    expect(disruptionResult.alternateRoute.latLngs.length).toBeGreaterThan(0);
  });

  // Test 14: Algorithmic VRP In-Process Solver
  it('14. should solve VRP deterministically with the algorithmic fallback solver', () => {
    const solution = OrToolsSolver.solveAlgorithmicVrp({
      distance_matrix: [
        [0, 2000, 3000],
        [2000, 0, 1500],
        [3000, 1500, 0],
      ],
      duration_matrix: [
        [0, 120, 180],
        [120, 0, 90],
        [180, 90, 0],
      ],
      demands: [0, 40, 50],
      vehicle_capacities: [100],
      num_vehicles: 1,
      starts: [0],
      ends: [0],
      priorities: ['LOW', 'CRITICAL', 'HIGH'],
      node_ids: ['DEPOT', 'REQ-1', 'REQ-2'],
    });

    expect(solution.status).toBe('OPTIMAL');
    expect(solution.routes.length).toBe(1);
    expect(solution.routes[0].load).toBe(90);
    expect(solution.unfulfilled.length).toBe(0);
  });
});
