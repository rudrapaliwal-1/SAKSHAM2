import { Router, Request, Response } from 'express';
import { OptimizationService } from './optimization.service.js';
import { RoutingService } from '../routing/routing.service.js';
import { LatLng } from '../routing/coordinates.js';
import { VehicleInput, DepotInput, DemandTargetInput } from './vrp.types.js';

export const optimizationRouter = Router();

/**
 * POST /api/v1/optimize
 * Runs full SAKSHAM Multi-Vehicle VRP Optimization Pipeline
 */
optimizationRouter.post('/optimize', async (req: Request, res: Response) => {
  try {
    let { vehicles, depots, demands } = req.body as {
      vehicles?: VehicleInput[];
      depots?: DepotInput[];
      demands?: DemandTargetInput[];
    };

    // If no payload provided, load default deterministic demo scenario
    if (!vehicles || !depots || !demands) {
      const demo = OptimizationService.getDemoScenario();
      vehicles = vehicles || demo.vehicles;
      depots = depots || demo.depots;
      demands = demands || demo.demands;
    }

    const result = await OptimizationService.optimizeRoutes(vehicles, depots, demands);
    return res.json(result);
  } catch (err: any) {
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
optimizationRouter.post('/reoptimize', async (req: Request, res: Response) => {
  try {
    const { eventType, newDemand, blockedDisruptionId, vehicles, depots, demands } = req.body as {
      eventType?: 'NEW_CRITICAL_DEMAND' | 'ROUTE_BLOCKED' | 'VEHICLE_DELAY';
      newDemand?: DemandTargetInput;
      blockedDisruptionId?: string;
      vehicles?: VehicleInput[];
      depots?: DepotInput[];
      demands?: DemandTargetInput[];
    };

    const demo = OptimizationService.getDemoScenario();
    let currentDemands = demands || demo.demands;
    const currentDepots = depots || demo.depots;
    const currentVehicles = vehicles || demo.vehicles;

    let eventSummary = 'Re-optimization completed.';

    if (eventType === 'NEW_CRITICAL_DEMAND') {
      const surgeDemand: DemandTargetInput = newDemand || {
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

    const result = await OptimizationService.optimizeRoutes(currentVehicles, currentDepots, currentDemands);
    return res.json({
      ...result,
      eventSummary,
      eventType: eventType || 'MANUAL_REOPTIMIZATION',
    });
  } catch (err: any) {
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
optimizationRouter.post('/route', async (req: Request, res: Response) => {
  try {
    const { waypoints, forceFallback } = req.body as { waypoints: LatLng[]; forceFallback?: boolean };
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ error: 'Array of at least 2 waypoints required.' });
    }

    const route = await RoutingService.getRoute(waypoints, forceFallback);
    return res.json(route);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/matrix
 * Builds all-pairs travel matrix via OSRM Table
 */
optimizationRouter.post('/matrix', async (req: Request, res: Response) => {
  try {
    const { locations, forceFallback } = req.body as { locations: LatLng[]; forceFallback?: boolean };
    if (!locations || !Array.isArray(locations) || locations.length < 2) {
      return res.status(400).json({ error: 'Array of at least 2 locations required.' });
    }

    const matrix = await RoutingService.getTable(locations, forceFallback);
    return res.json(matrix);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/simulate-blockage
 * Simulates road disruption, returns original vs alternate detour
 */
optimizationRouter.post('/simulate-blockage', async (req: Request, res: Response) => {
  try {
    const { disruptionId, waypoints } = req.body as { disruptionId?: string; waypoints?: LatLng[] };
    const defaultWaypoints: LatLng[] = [
      { lat: 28.6755, lng: 77.2215 }, // Civil Lines Depot
      { lat: 28.6650, lng: 77.2320 }, // Kashmiri Gate Camp
      { lat: 28.6510, lng: 77.2480 }, // Geeta Colony
    ];

    const simResult = await RoutingService.simulateBlockage(
      disruptionId || 'DISRUPT-DEL-01',
      waypoints || defaultWaypoints
    );
    return res.json(simResult);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/optimization/demo-scenario
 * Returns deterministic Delhi NCR Flood response baseline dataset
 */
optimizationRouter.get('/demo-scenario', (req: Request, res: Response) => {
  const scenario = OptimizationService.getDemoScenario();
  return res.json(scenario);
});

/**
 * GET /api/v1/optimization/status
 * Returns routing and optimizer engine status
 */
optimizationRouter.get('/status', (req: Request, res: Response) => {
  return res.json({
    routingEngine: 'OSRM (Open Source Routing Machine)',
    routingSource: RoutingService.getActiveSource(),
    optimizerEngine: 'Google OR-Tools (Vehicle Routing Problem)',
    activeDisruptions: RoutingService.getDisruptions(),
    timestamp: new Date().toISOString(),
  });
});
