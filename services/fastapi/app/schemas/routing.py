from typing import List, Optional
from pydantic import BaseModel, Field

class RouteGeometryResponse(BaseModel):
    dispatchId: str
    vehicleId: str
    geometry: Optional[List[List[float]]] = None  # [[lon, lat], ...]
    distanceKm: float
    durationMinutes: float
    source: str = "local"

class FleetAssignmentRequest(BaseModel):
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
    osrmSource: str
