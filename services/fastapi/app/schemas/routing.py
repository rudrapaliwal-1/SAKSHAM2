from typing import List, Optional
from pydantic import BaseModel


class RouteGeometryResponse(BaseModel):
    dispatchId: str
    vehicleId: str
    # GeoJSON-style [[lon, lat], ...] coordinates tracing the road route
    # (or a straight-line approximation if OSRM is disabled/unreachable)
    geometry: List[List[float]]
    distanceKm: float
    durationMinutes: float
    source: str  # "local", "public_fallback", or "straight_line_fallback"


class FleetAssignmentRequest(BaseModel):
    # If omitted, the service targets every APPROVED allocation that
    # doesn't already have a vehicle assigned.
    allocationIds: Optional[List[str]] = None


class FleetAssignmentItem(BaseModel):
    allocationId: str
    vehicleId: str
    vehicleName: str
    demandId: str
    resourceId: str
    distanceKm: float
    priority: str


class FleetAssignmentResponse(BaseModel):
    assignments: List[FleetAssignmentItem]
    unassignedAllocationIds: List[str]
    osrmSource: str  # reflects whether real road distances or fallback were used
