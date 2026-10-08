"""
FastAPI endpoints for the resource-demand matching & routing module.

POST /api/routing/optimize
    Given available vehicles (relief resources) and demand points,
    returns an optimized route per vehicle, including real road
    geometry (GeoJSON coordinates) ready to draw on a Leaflet/Mapbox map.

POST /api/routing/matrix
    Thin pass-through to OSRM's distance/duration matrix, exposed in
    case the frontend or another service needs raw travel times
    (e.g. for the public shelter locator's "nearest shelter" feature).
"""
from fastapi import APIRouter, HTTPException

from .schemas import (
    OptimizeRequest,
    OptimizeResponse,
    VehicleRoute,
    RouteStop,
    Coordinate,
    MatrixRequest,
    MatrixResponse,
)
from .osrm_client import get_distance_duration_matrix, get_route_geometry, OSRMError
from .optimizer import solve_cvrp

router = APIRouter(prefix="/api/routing", tags=["routing"])


@router.post("/matrix", response_model=MatrixResponse)
def matrix(req: MatrixRequest):
    try:
        distances, durations, source = get_distance_duration_matrix(req.coordinates)
    except OSRMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return MatrixResponse(distances_m=distances, durations_s=durations, osrm_source=source)


@router.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    if not req.vehicles:
        raise HTTPException(status_code=400, detail="At least one vehicle is required.")
    if not req.demands:
        raise HTTPException(status_code=400, detail="At least one demand point is required.")

    # Build the combined node list: depots first, then demand points.
    depot_coords = [v.start for v in req.vehicles]
    demand_coords = [d.location for d in req.demands]
    all_coords = depot_coords + demand_coords

    try:
        distances_m, durations_s, matrix_source = get_distance_duration_matrix(all_coords)
    except OSRMError as e:
        raise HTTPException(status_code=502, detail=f"OSRM matrix request failed: {e}")

    try:
        raw_routes, unassigned_indices = solve_cvrp(req.vehicles, req.demands, distances_m)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    num_depot_nodes = len(req.vehicles)

    def node_to_demand_id(node_index: int):
        if node_index < num_depot_nodes:
            return None
        return req.demands[node_index - num_depot_nodes].id

    def node_to_coord(node_index: int) -> Coordinate:
        return all_coords[node_index]

    routes = []
    geometry_source = matrix_source
    for vehicle, node_sequence in zip(req.vehicles, raw_routes):
        stops = [
            RouteStop(
                demand_id=node_to_demand_id(n),
                location=node_to_coord(n),
                arrival_order=i,
            )
            for i, n in enumerate(node_sequence)
        ]

        total_distance = sum(
            distances_m[node_sequence[i]][node_sequence[i + 1]]
            for i in range(len(node_sequence) - 1)
        )
        total_duration = sum(
            durations_s[node_sequence[i]][node_sequence[i + 1]]
            for i in range(len(node_sequence) - 1)
        )

        geometry = None
        if req.return_route_geometry and len(node_sequence) > 1:
            ordered_coords = [node_to_coord(n) for n in node_sequence]
            try:
                geometry, _, _, geometry_source = get_route_geometry(ordered_coords)
            except OSRMError as e:
                raise HTTPException(status_code=502, detail=f"OSRM route geometry request failed: {e}")

        routes.append(
            VehicleRoute(
                vehicle_id=vehicle.id,
                stops=stops,
                total_distance_m=total_distance,
                total_duration_s=total_duration,
                geometry=geometry,
            )
        )

    unassigned_ids = [node_to_demand_id(n) for n in unassigned_indices]

    return OptimizeResponse(
        routes=routes,
        unassigned_demand_ids=unassigned_ids,
        osrm_source=geometry_source,
    )
