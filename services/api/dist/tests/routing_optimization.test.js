"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const coordinates_js_1 = require("../modules/routing/coordinates.js");
const routing_service_js_1 = require("../modules/routing/routing.service.js");
const matching_preprocessor_js_1 = require("../modules/optimization/matching.preprocessor.js");
const optimization_service_js_1 = require("../modules/optimization/optimization.service.js");
const ortools_solver_js_1 = require("../modules/optimization/ortools.solver.js");
(0, vitest_1.describe)('SAKSHAM Routing & Logistics Optimization Engine Tests', () => {
    // Test 1: Coordinate Conversion & Validation
    (0, vitest_1.it)('1. should convert coordinates accurately between MapLibre [lat, lng] and OSRM [lng, lat]', () => {
        const latLng = { lat: 28.6139, lng: 77.2090 };
        const osrmTuple = (0, coordinates_js_1.toOsrmLngLat)(latLng);
        (0, vitest_1.expect)(osrmTuple).toEqual([77.2090, 28.6139]);
        const backToLatLng = (0, coordinates_js_1.fromOsrmLngLat)(osrmTuple);
        (0, vitest_1.expect)(backToLatLng.lat).toBeCloseTo(28.6139);
        (0, vitest_1.expect)(backToLatLng.lng).toBeCloseTo(77.2090);
        const formatted = (0, coordinates_js_1.formatOsrmCoordinateString)([
            { lat: 28.6139, lng: 77.2090 },
            { lat: 28.7041, lng: 77.1025 },
        ]);
        (0, vitest_1.expect)(formatted).toBe('77.209000,28.613900;77.102500,28.704100');
        const sanitized = (0, coordinates_js_1.sanitizeLatLng)({ lat: NaN, lng: undefined });
        (0, vitest_1.expect)(sanitized.lat).toBe(28.6139);
        (0, vitest_1.expect)(sanitized.lng).toBe(77.2090);
    });
    // Test 2: Matrix Generation
    (0, vitest_1.it)('2. should generate a symmetric NxN distance and duration matrix for multiple disaster locations', async () => {
        const locations = [
            { lat: 28.6755, lng: 77.2215 }, // Civil Lines Depot
            { lat: 28.6650, lng: 77.2320 }, // Kashmiri Gate
            { lat: 28.6510, lng: 77.2480 }, // Geeta Colony
        ];
        const matrix = await routing_service_js_1.RoutingService.getTable(locations, true); // test with simulation provider
        (0, vitest_1.expect)(matrix.numLocations).toBe(3);
        (0, vitest_1.expect)(matrix.distanceMatrix.length).toBe(3);
        (0, vitest_1.expect)(matrix.durationMatrix.length).toBe(3);
        (0, vitest_1.expect)(matrix.distanceMatrix[0][0]).toBe(0);
        (0, vitest_1.expect)(matrix.distanceMatrix[0][1]).toBeGreaterThan(0);
        (0, vitest_1.expect)(matrix.durationMatrix[0][1]).toBeGreaterThan(0);
    });
    // Test 3: Resource-Demand Matching Preprocessor
    (0, vitest_1.it)('3. should match demands only to compatible depots with positive inventory', () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        const { matched, unmatched, depotAllocations } = matching_preprocessor_js_1.MatchingPreprocessor.preprocessDemands(demo.demands, demo.depots);
        (0, vitest_1.expect)(matched.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(unmatched.length).toBe(0);
        matched.forEach((m) => {
            (0, vitest_1.expect)(m.matchedDepot).toBeDefined();
            (0, vitest_1.expect)(m.isEligible).toBe(true);
        });
        demo.depots.forEach((d) => {
            (0, vitest_1.expect)(depotAllocations[d.id]).toBeLessThanOrEqual(d.availableQuantity);
        });
    });
    // Test 4: Vehicle Capacity Constraint
    (0, vitest_1.it)('4. should enforce strict vehicle capacity constraints with zero load violations', async () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        const result = await optimization_service_js_1.OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);
        (0, vitest_1.expect)(result.status).toBe('OPTIMAL');
        result.routes.forEach((route) => {
            (0, vitest_1.expect)(route.totalLoadDelivered).toBeLessThanOrEqual(route.vehicleCapacity);
            (0, vitest_1.expect)(route.capacityUtilizationPct).toBeLessThanOrEqual(100.0);
        });
    });
    // Test 5: Route Validity (Depot Start & End)
    (0, vitest_1.it)('5. should ensure every vehicle route starts and ends at an authorized depot', async () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        const result = await optimization_service_js_1.OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);
        result.routes.forEach((route) => {
            if (route.stops.length > 0) {
                const firstStop = route.stops[0];
                const lastStop = route.stops[route.stops.length - 1];
                (0, vitest_1.expect)(firstStop.nodeType).toBe('DEPOT');
                (0, vitest_1.expect)(lastStop.nodeType).toBe('DEPOT');
            }
        });
    });
    // Test 6 & 7: Demand Visits & No Duplicated Stops
    (0, vitest_1.it)('6 & 7. should visit every assigned demand exactly once with no duplicated intermediate stops', async () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        const result = await optimization_service_js_1.OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);
        const visitedDemandNodeIds = new Set();
        result.routes.forEach((route) => {
            const demandStops = route.stops.filter((s) => s.nodeType === 'DEMAND');
            demandStops.forEach((stop) => {
                (0, vitest_1.expect)(visitedDemandNodeIds.has(stop.nodeId)).toBe(false); // No duplicates
                visitedDemandNodeIds.add(stop.nodeId);
            });
        });
        (0, vitest_1.expect)(visitedDemandNodeIds.size).toBe(demo.demands.length);
    });
    // Test 8: Anti-Depletion / No Negative Stock
    (0, vitest_1.it)('8. should prevent depot over-allocation and negative stock balance', () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        // artifically constrain first depot to 30 units
        const scarceDepots = demo.depots.map((d) => (d.id === 'DEPOT-DEL-01' ? { ...d, availableQuantity: 30 } : d));
        const { matched, depotAllocations } = matching_preprocessor_js_1.MatchingPreprocessor.preprocessDemands(demo.demands, scarceDepots);
        (0, vitest_1.expect)(depotAllocations['DEPOT-DEL-01']).toBeLessThanOrEqual(30);
    });
    // Test 9: Critical Demand Prioritization
    (0, vitest_1.it)('9. should prioritize CRITICAL requests even when vehicle fleet capacity is limited', async () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        // Only 1 small vehicle with capacity 100
        const limitedVehicles = [
            {
                id: 'VEH-MINI-01',
                name: 'Mini Van',
                type: 'VAN',
                capacity: 90,
                currentLocation: { lat: 28.6755, lng: 77.2215 },
                startDepotId: 'DEPOT-DEL-01',
            },
        ];
        const result = await optimization_service_js_1.OptimizationService.optimizeRoutes(limitedVehicles, demo.depots, demo.demands);
        // The assigned route should serve critical requests
        const servedDemands = result.routes.flatMap((r) => r.stops.filter((s) => s.nodeType === 'DEMAND'));
        const servedCriticals = servedDemands.filter((s) => s.priority === 'CRITICAL');
        (0, vitest_1.expect)(servedCriticals.length).toBeGreaterThan(0);
    });
    // Test 10: Optimizer Output Structure Validation
    (0, vitest_1.it)('10. should return complete optimization metrics, before-vs-after comparison, and explainable reasoning', async () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        const result = await optimization_service_js_1.OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);
        (0, vitest_1.expect)(result.metrics).toBeDefined();
        (0, vitest_1.expect)(result.metrics.totalDistanceKm).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.metrics.totalTravelTimeMinutes).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.metrics.requestsServed).toBe(10);
        (0, vitest_1.expect)(result.metrics.criticalRequestsServed).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.comparison).toBeDefined();
        (0, vitest_1.expect)(result.comparison.baselineDistanceKm).toBeGreaterThan(result.comparison.optimizedDistanceKm);
        (0, vitest_1.expect)(result.comparison.distanceImprovementPct).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.reasoning.length).toBe(result.routes.length);
        result.reasoning.forEach((r) => {
            (0, vitest_1.expect)(r.vehicleId).toBeDefined();
            (0, vitest_1.expect)(r.points.length).toBeGreaterThan(0);
        });
    });
    // Test 11: OSRM Failure Fallback
    (0, vitest_1.it)('11. should fall back gracefully to simulation routing provider if OSRM is unreachable', async () => {
        const waypoints = [
            { lat: 28.6755, lng: 77.2215 },
            { lat: 28.6650, lng: 77.2320 },
        ];
        const fallbackRoute = await routing_service_js_1.RoutingService.getRoute(waypoints, true); // force fallback
        (0, vitest_1.expect)(fallbackRoute.source).toBe('SIMULATION_FALLBACK');
        (0, vitest_1.expect)(fallbackRoute.distanceKm).toBeGreaterThan(0);
        (0, vitest_1.expect)(fallbackRoute.durationMinutes).toBeGreaterThan(0);
        (0, vitest_1.expect)(fallbackRoute.latLngs.length).toBeGreaterThan(2);
    });
    // Test 12: Live Dynamic Re-Optimization
    (0, vitest_1.it)('12. should perform live re-optimization when a new critical emergency surge occurs', async () => {
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        const initialResult = await optimization_service_js_1.OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, demo.demands);
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
            priority: 'CRITICAL',
            peopleAffected: 2400,
            status: 'PENDING',
        };
        const reoptimized = await optimization_service_js_1.OptimizationService.optimizeRoutes(demo.vehicles, demo.depots, [newSurgeDemand, ...demo.demands]);
        (0, vitest_1.expect)(reoptimized.status).toBe('OPTIMAL');
        (0, vitest_1.expect)(reoptimized.metrics.requestsServed).toBe(11);
        const surgeServed = reoptimized.routes.some((r) => r.stops.some((s) => s.nodeId === 'DEM-SURGE-999'));
        (0, vitest_1.expect)(surgeServed).toBe(true);
    });
    // Test 13: Route Disruption & Blockage Simulation
    (0, vitest_1.it)('13. should simulate road segment blockage and generate an alternate road detour with ETA delta', async () => {
        const waypoints = [
            { lat: 28.6755, lng: 77.2215 },
            { lat: 28.6650, lng: 77.2320 },
            { lat: 28.6510, lng: 77.2480 },
        ];
        const disruptionResult = await routing_service_js_1.RoutingService.simulateBlockage('DISRUPT-DEL-01', waypoints);
        (0, vitest_1.expect)(disruptionResult.disruption).toBeDefined();
        (0, vitest_1.expect)(disruptionResult.deltaMinutes).toBeGreaterThan(0);
        (0, vitest_1.expect)(disruptionResult.deltaKm).toBeGreaterThan(0);
        (0, vitest_1.expect)(disruptionResult.alternateRoute.latLngs.length).toBeGreaterThan(0);
    });
    // Test 14: Algorithmic VRP In-Process Solver
    (0, vitest_1.it)('14. should solve VRP deterministically with the algorithmic fallback solver', () => {
        const solution = ortools_solver_js_1.OrToolsSolver.solveAlgorithmicVrp({
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
        (0, vitest_1.expect)(solution.status).toBe('OPTIMAL');
        (0, vitest_1.expect)(solution.routes.length).toBe(1);
        (0, vitest_1.expect)(solution.routes[0].load).toBe(90);
        (0, vitest_1.expect)(solution.unfulfilled.length).toBe(0);
    });
});
