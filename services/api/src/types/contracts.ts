/**
 * SAKSHAM Unified Disaster Response Domain Contracts & Interfaces
 * ─────────────────────────────────────────────────────────────────
 * Canonical domain contracts for SAKSHAM backend service and operational engine.
 */

// ── 1. Common Enums & Geolocation ──────────────────────────────────────────

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Location {
  address: string;
  lat: number;
  lng: number;
  zone?: string;
  region?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// ── 2. Incident Domain ──────────────────────────────────────────────────────

export type IncidentType =
  | 'FLOOD'
  | 'FIRE'
  | 'EARTHQUAKE'
  | 'MEDICAL_EMERGENCY'
  | 'STRUCTURAL_COLLAPSE'
  | 'RESOURCE_SHORTAGE'
  | 'OTHER';

export type IncidentStatus =
  | 'REPORTED'
  | 'VERIFIED'
  | 'PRIORITIZED'
  | 'RESOURCE_MATCHED'
  | 'DISPATCHED'
  | 'UNDER_RESPONSE'
  | 'RESOLVED';

export interface IncidentTimelineEntry {
  time: string;
  title: string;
  description: string;
  actor?: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: Severity;
  location: string;
  coordinates: Coordinates;
  time: string;
  status: IncidentStatus;
  assignedTeam: string;
  description: string;
  reporterName: string;
  reporterContact: string;
  casualtiesCount?: number;
  displacedCount?: number;
  reportedAt?: string;
  updatedAt?: string;
  source?: string;
  peopleAffected?: number;
  requiredResources?: {
    itemNeeded: string;
    quantity: number;
    unit: string;
    priority: Severity;
  }[];
  timeline?: IncidentTimelineEntry[];
}

// ── 3. Demand Request Domain ────────────────────────────────────────────────

export type RequestStatus =
  | 'PENDING'
  | 'OPEN'
  | 'MATCHING'
  | 'MATCHED'
  | 'ALLOCATED'
  | 'DISPATCHED'
  | 'FULFILLING'
  | 'DELIVERING'
  | 'FULFILLED'
  | 'PARTIALLY_FULFILLED'
  | 'UNFULFILLED'
  | 'CANCELLED';

export interface DemandRequest {
  id: string;
  incidentId?: string;
  zoneName: string;
  coordinates: Coordinates;
  itemNeeded: string;
  category: string;
  quantity: number;
  unit: string;
  priority: Severity;
  affectedCount: number;
  status: RequestStatus;
  requestedAt: string;
  allocatedResourceId?: string;
  allocatedVehicleId?: string;
  eta?: string;
}

// ── 4. Resource & Inventory Domain ──────────────────────────────────────────

export type ResourceCategory =
  | 'WATER'
  | 'FOOD'
  | 'MEDICAL'
  | 'SHELTER_SUPPLIES'
  | 'CLOTHING'
  | 'RESCUE_EQUIPMENT'
  | 'VEHICLES'
  | 'OTHER';

export type ResourceStatus =
  | 'AVAILABLE'
  | 'LOW'
  | 'RESERVED'
  | 'IN_TRANSIT'
  | 'DEPLOYED'
  | 'DEPLETED';

export interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  quantity: number;
  allocatedQuantity?: number;
  unit: string;
  locationName: string;
  coordinates: Coordinates;
  status: ResourceStatus;
  lastUpdated: string;
  contactPerson: string;
  contactNumber: string;
  allocationId?: string;
}

// ── 5. Resource Allocation & Matching Domain ────────────────────────────────

export type AllocationStatus =
  | 'RECOMMENDED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'COMPLETED'
  | 'REJECTED';

export interface MatchScoreBreakdown {
  availability: number;        // 0–40
  distance: number;            // 0–25
  priority: number;            // 0–20
  compatibility: number;       // 0–10
  allocationPressure: number;  // 0–5
  total: number;               // 0–100
}

export interface ResourceAllocation {
  id: string;
  demandId: string;
  resourceId: string;
  quantity: number;
  vehicleId?: string;
  matchScore: number;
  breakdown?: MatchScoreBreakdown;
  status: AllocationStatus;
  reasoning?: string[];
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── 6. Responder & Personnel Domain ─────────────────────────────────────────

export type ResponderRole =
  | 'INCIDENT_COMMANDER'
  | 'LOGISTICS_OFFICER'
  | 'PARAMEDIC'
  | 'BOATMASTER'
  | 'PILOT'
  | 'FIELD_RESCUER';

export type ResponderStatus = 'ON_DUTY' | 'ON_MISSION' | 'STANDBY' | 'OFF_DUTY';

export interface Responder {
  id: string;
  name: string;
  role: ResponderRole;
  agency: string;
  contactRadio: string;
  contactPhone: string;
  status: ResponderStatus;
  assignedUnit?: string;
  assignedMissionId?: string;
  currentLocation?: Coordinates;
}

// ── 7. Vehicle & Fleet Domain ───────────────────────────────────────────────

export type VehicleType =
  | 'TRUCK'
  | 'AMBULANCE'
  | 'HELICOPTER'
  | 'RESCUE_BOAT'
  | 'DRONE'
  | 'SUV';

export type VehicleStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'RETURNING'
  | 'MAINTENANCE';

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  capacity: string;
  status: VehicleStatus;
  location: Coordinates;
  destination?: Coordinates;
  cargo?: string;
  driverName: string;
  driverContact: string;
  speedKmh?: number;
  incidentId?: string;
  etaMinutes?: number;
  teamName?: string;
}

// ── 8. Mission & Dispatch Domain ────────────────────────────────────────────

export type MissionStatus =
  | 'PLANNED'
  | 'AWAITING_DISPATCH'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export interface MissionTimelineEvent {
  time: string;
  title: string;
  done: boolean;
}

export interface Mission {
  id: string;
  requestId: string;
  vehicleId: string;
  status: MissionStatus;
  destinationName: string;
  resourceType: string;
  quantity: number;
  unit: string;
  etaMinutes: number;
  operatorName: string;
  speedKmh: number;
  distanceKm: number;
  signalStrength: number;
  fuelPct: number;
  trafficLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'BLOCKED';
  routePath: string[];
  alertMessage?: string;
  timeline: MissionTimelineEvent[];
}

// ── 9. Route & Navigation Domain ────────────────────────────────────────────

export interface RouteWaypoint {
  name: string;
  coordinates: Coordinates;
  reached?: boolean;
}

export interface Route {
  id: string;
  origin: Coordinates;
  destination: Coordinates;
  originName: string;
  destinationName: string;
  distanceKm: number;
  estimatedMinutes: number;
  waypoints: RouteWaypoint[];
  pathCoordinates: Coordinates[];
  trafficStatus: 'CLEAR' | 'MODERATE' | 'CONGESTED' | 'FLOOD_BLOCKED';
}

// ── 10. Alert Domain ────────────────────────────────────────────────────────

export type AlertCategory = 'DEMAND' | 'RESOURCE' | 'SHELTER' | 'MISSION' | 'INCIDENT' | 'SYSTEM';

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  timestamp: string;
  category: AlertCategory;
  actionPath?: string;
  resolved?: boolean;
}

// ── 11. Audit Event & Ledger Domain ─────────────────────────────────────────

export type AuditActionType =
  | 'VERIFY'
  | 'PRIORITIZE'
  | 'MATCH'
  | 'ALLOCATE'
  | 'DISPATCH'
  | 'DELIVERY'
  | 'RESOLVE'
  | 'SYSTEM'
  | 'AUTH';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  result: string;
  type: AuditActionType;
  metadata?: Record<string, any>;
}

// ── 12. Shelter Safe Haven Domain ───────────────────────────────────────────

export type ShelterStatus = 'OPEN' | 'FULL' | 'CLOSED';

export interface Shelter {
  id: string;
  name: string;
  locationName: string;
  coordinates: Coordinates;
  capacityTotal: number;
  capacityOccupied: number;
  status: ShelterStatus;
  contactPerson: string;
  contactNumber: string;
  resourcesAvailable: string[];
}

// ── 13. Decision Support Domain (Transparent & Deterministic) ────────────────

export interface PriorityFactorBreakdown {
  incidentSeverityScore: number;       // 0–25
  affectedPopulationScore: number;     // 0–25
  resourceCriticalityScore: number;    // 0–20
  waitingTimeScore: number;            // 0–15
  vulnerabilityScore: number;          // 0–15
  totalScore: number;                  // 0–100
}

export interface DemandPriorityEvaluation {
  demandId: string;
  priorityScore: number;               // 0–100
  priorityLevel: Severity;             // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  breakdown: PriorityFactorBreakdown;
  reasoning: string[];
  evaluatedAt: string;
}

export interface MatchingRecommendation {
  demandId: string;
  matchScore: number;                  // 0–100
  recommendedResource: {
    id: string;
    name: string;
    category: ResourceCategory;
    storageDepot: string;
    availableQuantity: number;
    unit: string;
  };
  recommendedQuantity: number;
  distanceKm: number;
  estimatedDeliveryMinutes: number;
  estimatedDeliveryTime: string;       // e.g. "~14 mins"
  breakdown: MatchScoreBreakdown;
  qualityLabel: 'EXCELLENT' | 'GOOD' | 'PARTIAL' | 'POOR' | 'INCOMPATIBLE';
  reasoning: string;                   // Comprehensive explainable statement
  detailedExplanation: string[];
}

export interface AllocationPlan {
  allocationId: string;
  demandId: string;
  resourceId: string;
  allocatedQuantity: number;
  vehicleId?: string;
  matchScore: number;
  reasoning: string;
  timestamp: string;
  remainingDepotStock: number;
}

