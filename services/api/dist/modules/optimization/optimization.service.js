"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizationService = void 0;
const matching_preprocessor_js_1 = require("./matching.preprocessor.js");
const routing_service_js_1 = require("../routing/routing.service.js");
const ortools_solver_js_1 = require("./ortools.solver.js");
class OptimizationService {
    /**
     * Executes the full SAKSHAM Resource Matching + OSRM Matrix + OR-Tools VRP Optimization Pipeline.
     */
    static async optimizeRoutes(vehicles, depots, demands) {
        const startTime = Date.now();
        if (!vehicles || vehicles.length === 0) {
            throw new Error('At least 1 vehicle required for route optimization.');
        }
        if (!depots || depots.length === 0) {
            throw new Error('At least 1 resource depot required for route optimization.');
        }
        if (!demands || demands.length === 0) {
            throw new Error('At least 1 demand request required for route optimization.');
        }
        // ── STAGE 1: Resource-Demand Matching Preprocessing ──────────────────────
        const { matched, unmatched } = matching_preprocessor_js_1.MatchingPreprocessor.preprocessDemands(demands, depots);
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
                    requestsUnfulfilled: demands.length,
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
        // Node ordering: [depot_0, depot_1, ..., demand_0, demand_1, ...]
        const allLocations = [];
        const nodeIds = [];
        const nodeNames = [];
        const nodeDemands = [];
        const nodePriorities = [];
        const nodeCategories = [];
        // Add Depots (Nodes 0 to depots.length - 1)
        depots.forEach((d) => {
            allLocations.push(d.location);
            nodeIds.push(d.id);
            nodeNames.push(d.name);
            nodeDemands.push(0);
            nodePriorities.push('LOW');
            nodeCategories.push(d.category);
        });
        // Add Eligible Demands (Nodes depots.length to depots.length + eligibleDemands.length - 1)
        eligibleDemands.forEach((d) => {
            allLocations.push(d.location);
            nodeIds.push(d.id);
            nodeNames.push(d.locationName || d.title);
            nodeDemands.push(d.quantity);
            nodePriorities.push(d.priority);
            nodeCategories.push(d.category || d.itemNeeded);
        });
        // Determine Vehicle Start and End Depots
        const vehicleStarts = [];
        const vehicleEnds = [];
        vehicles.forEach((v) => {
            let startIdx = depots.findIndex((d) => d.id === v.startDepotId);
            if (startIdx === -1)
                startIdx = 0;
            let endIdx = v.endDepotId ? depots.findIndex((d) => d.id === v.endDepotId) : startIdx;
            if (endIdx === -1)
                endIdx = startIdx;
            vehicleStarts.push(startIdx);
            vehicleEnds.push(endIdx);
        });
        // Build OSRM Travel Matrix
        const tableResult = await routing_service_js_1.RoutingService.getTable(allLocations);
        // ── STAGE 3: Multi-Vehicle OR-Tools VRP Optimization ─────────────────────
        const vrpPayload = {
            distance_matrix: tableResult.distanceMatrix,
            duration_matrix: tableResult.durationMatrix,
            demands: nodeDemands,
            vehicle_capacities: vehicles.map((v) => v.capacity),
            num_vehicles: vehicles.length,
            starts: vehicleStarts,
            ends: vehicleEnds,
            priorities: nodePriorities,
            node_ids: nodeIds,
        };
        const vrpSolution = await ortools_solver_js_1.OrToolsSolver.solve(vrpPayload);
        // ── STAGE 4: Real Road Geometry Synthesis & Stop Manifest Assembly ────────
        const finalRoutes = [];
        let totalOptimizedDistanceKm = 0;
        let totalOptimizedDurationMin = 0;
        let totalResourceAllocated = 0;
        let criticalRequestsServed = 0;
        let totalRequestsServed = 0;
        for (const rawRoute of vrpSolution.routes) {
            const vehicle = vehicles[rawRoute.vehicle_index];
            if (!vehicle)
                continue;
            const stopWaypoints = [];
            const stops = [];
            let accumulatedLoad = 0;
            let cumulativeDurationSeconds = 0;
            let cumulativeDistanceKm = 0;
            const priorityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
            for (let sIdx = 0; sIdx < rawRoute.node_indices.length; sIdx++) {
                const nodeIdx = rawRoute.node_indices[sIdx];
                const isDepot = nodeIdx < depots.length;
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
                    }
                    else if (prio === 'HIGH') {
                        priorityCounts.high++;
                    }
                    else if (prio === 'MEDIUM') {
                        priorityCounts.medium++;
                    }
                    else {
                        priorityCounts.low++;
                    }
                }
                // Leg incremental metrics
                let legDistKm = 0;
                if (sIdx > 0) {
                    const prevNode = rawRoute.node_indices[sIdx - 1];
                    const distM = tableResult.distanceMatrix[prevNode][nodeIdx];
                    const durS = tableResult.durationMatrix[prevNode][nodeIdx];
                    legDistKm = Math.round((distM / 1000) * 10) / 10;
                    cumulativeDurationSeconds += durS;
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
                    priority: isDepot ? undefined : nodePriorities[nodeIdx],
                    etaMinutesFromStart: Math.round(cumulativeDurationSeconds / 60),
                    distanceFromPrevKm: legDistKm,
                    resourceCategory: nodeCategories[nodeIdx],
                });
            }
            // Generate road geometry via OSRM Route Service
            let roadGeometry = await routing_service_js_1.RoutingService.getRoute(stopWaypoints);
            // Generate natural language explanation
            const explanationPoints = [];
            const assignedDepot = depots[vehicleStarts[rawRoute.vehicle_index]] || depots[0];
            const demandStopsCount = stops.filter((s) => s.nodeType === 'DEMAND').length;
            if (demandStopsCount > 0) {
                explanationPoints.push(`Dispatched from ${assignedDepot.name} with ${rawRoute.load} / ${vehicle.capacity} units cargo.`);
                explanationPoints.push(`Serves ${demandStopsCount} demand point(s) including ${priorityCounts.critical} CRITICAL and ${priorityCounts.high} HIGH priority sector(s).`);
                explanationPoints.push(`Optimized multi-stop road sequence minimizes detour time to ${roadGeometry.durationMinutes} minutes (${roadGeometry.distanceKm} km).`);
                explanationPoints.push(`Capacity utilization: ${rawRoute.load_percentage}% within safe vehicular payload limit.`);
            }
            else {
                explanationPoints.push(`Vehicle in active reserve at ${assignedDepot.name} (no assigned stops required).`);
            }
            finalRoutes.push({
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                vehicleType: vehicle.type,
                driverName: vehicle.driverName || 'Designated Driver',
                depotId: assignedDepot.id,
                depotName: assignedDepot.name,
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
        // Baseline represents naive individual round-trips from depot to each demand point
        let baselineDistanceKm = 0;
        let baselineDurationMinutes = 0;
        eligibleDemands.forEach((d) => {
            const startDepotLoc = depots[0].location;
            const roundTripDistMeters = (tableResult.distanceMatrix[0][depots.length + eligibleDemands.indexOf(d)] || 12000) * 2;
            const roundTripDurSec = (tableResult.durationMatrix[0][depots.length + eligibleDemands.indexOf(d)] || 900) * 2;
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
        // Collect all unfulfilled demands
        const allUnfulfilled = [
            ...unmatched.map((u) => ({
                demandId: u.demand.id,
                itemNeeded: u.demand.itemNeeded,
                quantity: u.demand.quantity,
                priority: u.demand.priority,
                reason: u.ineligibilityReason || 'Depot capacity constraint.',
            })),
            ...vrpSolution.unfulfilled.map((u) => {
                const dObj = eligibleDemands[u.node_index - depots.length];
                return {
                    demandId: u.node_id,
                    itemNeeded: dObj?.itemNeeded || 'Emergency Supplies',
                    quantity: u.demand,
                    priority: u.priority,
                    reason: 'Vehicle fleet capacity exhausted or route time limit reached.',
                };
            }),
        ];
        const reasoning = finalRoutes.map((r) => ({
            vehicleId: r.vehicleId,
            summary: `${r.vehicleName} (${r.vehicleType}) · ${r.stops.filter((s) => s.nodeType === 'DEMAND').length} Stops · ${r.totalDistanceKm} km (${r.totalDurationMinutes} min)`,
            points: r.explanation,
        }));
        return {
            status: allUnfulfilled.length === 0 ? 'OPTIMAL' : 'PARTIAL',
            message: allUnfulfilled.length === 0
                ? 'All demand targets successfully routed within vehicle capacity and depot limits.'
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
     * Generates the deterministic Delhi-NCR Flood Response scenario data.
     */
    static getDemoScenario() {
        const depots = [
            {
                id: 'DEPOT-DEL-01',
                name: 'Delhi Central Relief Depot (Civil Lines)',
                location: { lat: 28.6755, lng: 77.2215 },
                locationName: 'Civil Lines, North Delhi',
                category: 'MEDICAL',
                resourceTypes: ['MEDICAL', 'WATER', 'FOOD'],
                availableQuantity: 500,
                allocatedQuantity: 0,
                status: 'ACTIVE',
            },
            {
                id: 'DEPOT-DEL-02',
                name: 'Ghaziabad Emergency Supply Hub (Sahibabad)',
                location: { lat: 28.6705, lng: 77.3450 },
                locationName: 'Sahibabad Industrial Area, Ghaziabad',
                category: 'WATER',
                resourceTypes: ['WATER', 'FOOD', 'SHELTER_SUPPLIES'],
                availableQuantity: 800,
                allocatedQuantity: 0,
                status: 'ACTIVE',
            },
            {
                id: 'DEPOT-DEL-03',
                name: 'Faridabad Regional Relief Depot',
                location: { lat: 28.4089, lng: 77.3178 },
                locationName: 'Faridabad Sector 15',
                category: 'FOOD',
                resourceTypes: ['FOOD', 'CLOTHING', 'WATER'],
                availableQuantity: 650,
                allocatedQuantity: 0,
                status: 'ACTIVE',
            },
            {
                id: 'DEPOT-DEL-04',
                name: 'Noida Advanced Medical Depot (Sector 62)',
                location: { lat: 28.6280, lng: 77.3649 },
                locationName: 'Sector 62, Noida',
                category: 'MEDICAL',
                resourceTypes: ['MEDICAL', 'RESCUE_EQUIPMENT'],
                availableQuantity: 400,
                allocatedQuantity: 0,
                status: 'ACTIVE',
            },
        ];
        const demands = [
            {
                id: 'DEM-DEL-001',
                requestId: 'REQ-101',
                title: 'Trauma Kits & IV Fluids for Inundated Camp',
                location: { lat: 28.6650, lng: 77.2320 },
                locationName: 'Yamuna Khadar Kashmiri Gate Relief Camp',
                category: 'MEDICAL',
                itemNeeded: 'Advanced Trauma Kits',
                quantity: 40,
                unit: 'kits',
                priority: 'CRITICAL',
                peopleAffected: 1800,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-002',
                requestId: 'REQ-102',
                title: 'Potable Drinking Water Tankers Needed',
                location: { lat: 28.6510, lng: 77.2480 },
                locationName: 'Geeta Colony Inundated Sector 3',
                category: 'WATER',
                itemNeeded: 'Purified Water Containers',
                quantity: 120,
                unit: 'cans (20L)',
                priority: 'CRITICAL',
                peopleAffected: 3200,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-003',
                requestId: 'REQ-103',
                title: 'Emergency Ready-to-Eat Food Packets',
                location: { lat: 28.6285, lng: 77.2790 },
                locationName: 'Mayur Vihar Phase 1 Flood Shelter',
                category: 'FOOD',
                itemNeeded: 'RTE High-Calorie Rations',
                quantity: 90,
                unit: 'crates',
                priority: 'HIGH',
                peopleAffected: 1400,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-004',
                requestId: 'REQ-104',
                title: 'Anti-Venom & Waterborne Disease Kits',
                location: { lat: 28.6920, lng: 77.2180 },
                locationName: 'Majnu Ka Tilla Gurudwara Relief Camp',
                category: 'MEDICAL',
                itemNeeded: 'Anti-Venom & Antibiotics',
                quantity: 35,
                unit: 'kits',
                priority: 'CRITICAL',
                peopleAffected: 950,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-005',
                requestId: 'REQ-105',
                title: 'Clean Drinking Water Supply',
                location: { lat: 28.6015, lng: 77.3025 },
                locationName: 'Chilla Khadar Flood Inundation Point',
                category: 'WATER',
                itemNeeded: 'Drinking Water Packs',
                quantity: 80,
                unit: 'cans (20L)',
                priority: 'HIGH',
                peopleAffected: 2100,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-006',
                requestId: 'REQ-106',
                title: 'Emergency Food Supplies for Displaced Families',
                location: { lat: 28.6810, lng: 77.2640 },
                locationName: 'Usmanpur Village Flood Bank',
                category: 'FOOD',
                itemNeeded: 'Dry Ration Kits',
                quantity: 70,
                unit: 'kits',
                priority: 'HIGH',
                peopleAffected: 1600,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-007',
                requestId: 'REQ-107',
                title: 'Water Purification Tablets & Jerrycans',
                location: { lat: 28.6430, lng: 77.2880 },
                locationName: 'Akshardham Relief Transit Point',
                category: 'WATER',
                itemNeeded: 'Purification Kits',
                quantity: 60,
                unit: 'kits',
                priority: 'MEDIUM',
                peopleAffected: 800,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-008',
                requestId: 'REQ-108',
                title: 'Sanitation & Hygiene Kits',
                location: { lat: 28.7110, lng: 77.2020 },
                locationName: 'Wazirabad Water Works Camp',
                category: 'MEDICAL',
                itemNeeded: 'Hygiene & Disinfection Kits',
                quantity: 45,
                unit: 'packs',
                priority: 'MEDIUM',
                peopleAffected: 1100,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-009',
                requestId: 'REQ-109',
                title: 'Baby Food and Infant Nutrition',
                location: { lat: 28.6180, lng: 77.2600 },
                locationName: 'Shakarpur School Relief Shelter',
                category: 'FOOD',
                itemNeeded: 'Infant Milk & Nutrition Formula',
                quantity: 30,
                unit: 'boxes',
                priority: 'HIGH',
                peopleAffected: 450,
                status: 'PENDING',
            },
            {
                id: 'DEM-DEL-010',
                requestId: 'REQ-110',
                title: 'Triage Sutures & Burn Dressings',
                location: { lat: 28.6550, lng: 77.2850 },
                locationName: 'Seelampur Community Hall Camp',
                category: 'MEDICAL',
                itemNeeded: 'Burn Dressings & Suture Kits',
                quantity: 25,
                unit: 'kits',
                priority: 'MEDIUM',
                peopleAffected: 620,
                status: 'PENDING',
            },
        ];
        const vehicles = [
            {
                id: 'VEH-TRK-01',
                name: 'NDRF Heavy Response Truck V-01',
                type: 'HEAVY TRUCK',
                capacity: 180,
                currentLocation: { lat: 28.6755, lng: 77.2215 },
                startDepotId: 'DEPOT-DEL-01',
                endDepotId: 'DEPOT-DEL-01',
                driverName: 'Havildar Rajesh Kumar',
                status: 'AVAILABLE',
                speedKmh: 42,
            },
            {
                id: 'VEH-TRK-02',
                name: 'Rapid Medical Ambulance Unit V-02',
                type: 'AMBULANCE TRUCK',
                capacity: 120,
                currentLocation: { lat: 28.6755, lng: 77.2215 },
                startDepotId: 'DEPOT-DEL-01',
                endDepotId: 'DEPOT-DEL-01',
                driverName: 'Sgt. Amit Verma',
                status: 'AVAILABLE',
                speedKmh: 48,
            },
            {
                id: 'VEH-TRK-03',
                name: 'Ghaziabad Water Bowser V-03',
                type: 'WATER CARRIER',
                capacity: 220,
                currentLocation: { lat: 28.6705, lng: 77.3450 },
                startDepotId: 'DEPOT-DEL-02',
                endDepotId: 'DEPOT-DEL-02',
                driverName: 'Subedar Kuldeep Singh',
                status: 'AVAILABLE',
                speedKmh: 38,
            },
            {
                id: 'VEH-TRK-04',
                name: 'Noida Disaster Logistics Van V-04',
                type: 'LIGHT LOGISTICS',
                capacity: 140,
                currentLocation: { lat: 28.6280, lng: 77.3649 },
                startDepotId: 'DEPOT-DEL-04',
                endDepotId: 'DEPOT-DEL-04',
                driverName: 'Naik Sandeep Joshi',
                status: 'AVAILABLE',
                speedKmh: 45,
            },
        ];
        return { depots, demands, vehicles };
    }
}
exports.OptimizationService = OptimizationService;
