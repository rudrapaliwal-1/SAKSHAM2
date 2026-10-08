"""
Pydantic models shared by the OSRM client, the OR-Tools optimizer,
and the FastAPI routes. Keeping these in one place means the
frontend contract stays stable even if you swap the solver internals.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float
    lon: float


class Vehicle(BaseModel):
    id: str
    start: Coordinate               # depot / current location of the relief vehicle
    capacity: int = Field(..., gt=0)  # e.g. number of ration kits / people it can carry
    end: Optional[Coordinate] = None  # if omitted, vehicle does not need to return to depot
    # What kinds of demand this vehicle/team is equipped to serve, e.g.
    # ["food", "water"] for a supply truck, ["medical"] for an ambulance,
    # ["rescue"] for a rescue team. A vehicle can list multiple types if
    # it's mixed-use. Defaults to "general" so untyped payloads still work.
    resource_types: List[str] = Field(default_factory=lambda: ["general"])


class DemandPoint(BaseModel):
    id: str
    location: Coordinate
    demand: int = Field(..., gt=0)  # quantity requested (food kits, medical units, seats, etc.)
    priority: int = 1               # higher = more urgent, used as a soft weight in the objective
    # The single resource type this request needs, e.g. "medical", "food",
    # "rescue", "water", "shelter". Must match one of a vehicle's
    # resource_types for that vehicle to be eligible to serve it.
    resource_type: str = "general"


class OptimizeRequest(BaseModel):
    vehicles: List[Vehicle]
    demands: List[DemandPoint]
    return_route_geometry: bool = True  # if True, fetch actual road polyline per vehicle route


class RouteStop(BaseModel):
    demand_id: Optional[str] = None  # None for the depot/start stop
    location: Coordinate
    arrival_order: int


class VehicleRoute(BaseModel):
    vehicle_id: str
    stops: List[RouteStop]
    total_distance_m: float
    total_duration_s: float
    # GeoJSON LineString coordinates [[lon, lat], ...] for actual road-following geometry
    geometry: Optional[List[List[float]]] = None


class OptimizeResponse(BaseModel):
    routes: List[VehicleRoute]
    unassigned_demand_ids: List[str]
    osrm_source: str  # "local" or "public_fallback", useful for debugging/demo


class MatrixRequest(BaseModel):
    coordinates: List[Coordinate]


class MatrixResponse(BaseModel):
    distances_m: List[List[float]]
    durations_s: List[List[float]]
    osrm_source: str
