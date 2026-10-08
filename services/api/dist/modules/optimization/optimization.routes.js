"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizationRouter = void 0;
const express_1 = require("express");
const optimization_service_js_1 = require("./optimization.service.js");
const routing_service_js_1 = require("../routing/routing.service.js");
exports.optimizationRouter = (0, express_1.Router)();
/**
 * POST /api/v1/optimize
 * Runs full SAKSHAM Multi-Vehicle VRP Optimization Pipeline
 */
exports.optimizationRouter.post('/optimize', async (req, res) => {
    try {
        let { vehicles, depots, demands, solverConfig } = req.body;
        // If no payload provided, load default deterministic demo scenario
        if (!vehicles || !depots || !demands) {
            const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
            vehicles = vehicles || demo.vehicles;
            depots = depots || demo.depots;
            demands = demands || demo.demands;
        }
        const result = await optimization_service_js_1.OptimizationService.optimizeRoutes(vehicles, depots, demands, solverConfig);
        return res.json(result);
    }
    catch (err) {
        console.error('[OPTIMIZATION API ERROR]:', err);
        return res.status(500).json({
            status: 'ERROR',
            message: err.message || 'Route optimization failed.',
        });
    }
});
/**
 * POST /api/v1/reoptimize
 * Live dynamic re-optimization with injected disruption or priority surge
 */
exports.optimizationRouter.post('/reoptimize', async (req, res) => {
    try {
        const { eventType, newDemand, blockedDisruptionId, vehicles, depots, demands } = req.body;
        const demo = optimization_service_js_1.OptimizationService.getDemoScenario();
        let currentDemands = demands || demo.demands;
        const currentDepots = depots || demo.depots;
        const currentVehicles = vehicles || demo.vehicles;
        let eventSummary = 'Re-optimization completed.';
        if (eventType === 'NEW_CRITICAL_DEMAND') {
            const surgeDemand = newDemand || {
                id: `DEM-SURGE-${Date.now()}`,
                requestId: `REQ-SURGE-999`,
                title: 'URGENT: Floodwater breach in Kashmiri Gate Metro Shelter',
                location: { lat: 28.6670, lng: 77.2280 },
                locationName: 'Kashmiri Gate Gate 2 Metro Shelter',
                category: 'MEDICAL',
                itemNeeded: 'Emergency Trauma Triage & Defibrillators',
                quantity: 30,
                unit: 'kits',
                priority: 'CRITICAL',
                peopleAffected: 2400,
                status: 'PENDING',
            };
            currentDemands = [surgeDemand, ...currentDemands];
            eventSummary = `ROUTE UPDATED: New CRITICAL request received at ${surgeDemand.locationName}. Priority insertion executed.`;
        }
        const result = await optimization_service_js_1.OptimizationService.optimizeRoutes(currentVehicles, currentDepots, currentDemands);
        return res.json({
            ...result,
            eventSummary,
            eventType: eventType || 'MANUAL_REOPTIMIZATION',
        });
    }
    catch (err) {
        console.error('[RE-OPTIMIZATION API ERROR]:', err);
        return res.status(500).json({
            status: 'ERROR',
            message: err.message || 'Live re-optimization failed.',
        });
    }
});
/**
 * POST /api/v1/route
 * Retrieves real road route geometry from OSRM
 */
exports.optimizationRouter.post('/route', async (req, res) => {
    try {
        const { waypoints, forceFallback } = req.body;
        if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
            return res.status(400).json({ error: 'Array of at least 2 waypoints required.' });
        }
        const route = await routing_service_js_1.RoutingService.getRoute(waypoints, forceFallback);
        return res.json(route);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/v1/matrix
 * Builds all-pairs travel matrix via OSRM Table
 */
exports.optimizationRouter.post('/matrix', async (req, res) => {
    try {
        const { locations, forceFallback } = req.body;
        if (!locations || !Array.isArray(locations) || locations.length < 2) {
            return res.status(400).json({ error: 'Array of at least 2 locations required.' });
        }
        const matrix = await routing_service_js_1.RoutingService.getTable(locations, forceFallback);
        return res.json(matrix);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/v1/simulate-blockage
 * Simulates road disruption, returns original vs alternate detour
 */
exports.optimizationRouter.post('/simulate-blockage', async (req, res) => {
    try {
        const { disruptionId, waypoints } = req.body;
        const defaultWaypoints = [
            { lat: 28.6755, lng: 77.2215 }, // Civil Lines Depot
            { lat: 28.6650, lng: 77.2320 }, // Kashmiri Gate Camp
            { lat: 28.6510, lng: 77.2480 }, // Geeta Colony
        ];
        const simResult = await routing_service_js_1.RoutingService.simulateBlockage(disruptionId || 'DISRUPT-DEL-01', waypoints || defaultWaypoints);
        return res.json(simResult);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/v1/optimization/demo-scenario
 * Returns deterministic Delhi NCR Flood response baseline dataset
 */
exports.optimizationRouter.get('/demo-scenario', (req, res) => {
    const scenario = optimization_service_js_1.OptimizationService.getDemoScenario();
    return res.json(scenario);
});
/**
 * GET /api/v1/optimization/status
 * Returns routing and optimizer engine status
 */
exports.optimizationRouter.get('/status', (req, res) => {
    return res.json({
        routingEngine: 'OSRM (Open Source Routing Machine)',
        routingSource: routing_service_js_1.RoutingService.getActiveSource(),
        optimizerEngine: 'Google OR-Tools (Vehicle Routing Problem)',
        activeDisruptions: routing_service_js_1.RoutingService.getDisruptions(),
        timestamp: new Date().toISOString(),
    });
});
