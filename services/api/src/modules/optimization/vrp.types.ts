import { LatLng } from '../routing/coordinates.js';
import { RoutingSource, RouteGeometryResult } from '../routing/routing.types.js';

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface VehicleInput {
  id: string;
  name: string;
  type: string;
  capacity: number;
  currentLocation: LatLng;
  startDepotId: string;
  endDepotId?: string;
  driverName?: string;
  status?: 'AVAILABLE' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'MAINTENANCE';
  speedKmh?: number;
}

export interface DepotInput {
  id: string;
  name: string;
  location: LatLng;
  locationName: string;
  category: string;
  resourceTypes: string[];
  availableQuantity: number;
  allocatedQuantity?: number;
  status: 'ACTIVE' | 'LOW' | 'DEPLETED';
}

export interface DemandTargetInput {
  id: string;
  requestId: string;
  title: string;
  location: LatLng;
  locationName: string;
  category: string;
  itemNeeded: string;
  quantity: number;
  unit: string;
  priority: PriorityLevel;
  peopleAffected: number;
  status: string;
  assignedVehicleId?: string;
  assignedDepotId?: string;
}

export interface VrpStop {
  stopIndex: number;
  nodeId: string;
  nodeType: 'DEPOT' | 'DEMAND';
  name: string;
  location: LatLng;
  demandQuantity: number;
  accumulatedLoad: number;
  priority?: PriorityLevel;
  etaMinutesFromStart: number;
  distanceFromPrevKm: number;
  resourceCategory?: string;
}

export interface OptimizedVehicleRoute {
  vehicleId: string;
  vehicleName: string;
  vehicleType: string;
  driverName: string;
  depotId: string;
  depotName: string;
  status: 'PLANNED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'COMPLETED';
  stops: VrpStop[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  totalLoadDelivered: number;
  vehicleCapacity: number;
  capacityUtilizationPct: number;
  prioritySummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  roadGeometry: RouteGeometryResult;
  routingSource: RoutingSource;
  optimizerEngine: 'OR-TOOLS VRP' | 'ALGORITHMIC VRP';
  explanation: string[];
}

export interface OptimizationMetrics {
  totalDistanceKm: number;
  totalTravelTimeMinutes: number;
  vehiclesUsed: number;
  totalVehiclesAvailable: number;
  requestsServed: number;
  requestsUnfulfilled: number;
  criticalRequestsServed: number;
  totalResourceAllocated: number;
  optimizationTimeMs: number;
}

export interface RouteComparison {
  baselineDistanceKm: number;
  optimizedDistanceKm: number;
  distanceSavedKm: number;
  distanceImprovementPct: number;

  baselineDurationMinutes: number;
  optimizedDurationMinutes: number;
  durationSavedMinutes: number;
  durationImprovementPct: number;

  baselineVehiclesNeeded: number;
  optimizedVehiclesNeeded: number;
  vehiclesSaved: number;
}

export interface OptimizationOutput {
  status: 'OPTIMAL' | 'FEASIBLE' | 'PARTIAL' | 'NO_SOLUTION';
  message: string;
  routes: OptimizedVehicleRoute[];
  unfulfilledDemands: Array<{
    demandId: string;
    itemNeeded: string;
    quantity: number;
    priority: PriorityLevel;
    reason: string;
  }>;
  metrics: OptimizationMetrics;
  comparison: RouteComparison;
  reasoning: Array<{
    vehicleId: string;
    summary: string;
    points: string[];
  }>;
  timestamp: string;
  scenarioId?: string;
}
