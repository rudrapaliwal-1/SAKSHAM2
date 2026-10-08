from fastapi import APIRouter, Depends
from app.schemas.routing import RouteGeometryResponse, FleetAssignmentRequest, FleetAssignmentResponse
from app.domain.routing.service import RoutingService
from app.api.dependencies import get_routing_service, get_current_officer
from app.core.models import OfficerModel

router = APIRouter()


@router.get(
    "/dispatch/{dispatch_id}/route",
    response_model=RouteGeometryResponse,
    summary="Get actual road-route geometry for a dispatch (vehicle -> resource -> incident)",
)
async def get_dispatch_route(
    dispatch_id: str,
    service: RoutingService = Depends(get_routing_service),
    current_officer: OfficerModel = Depends(get_current_officer),
):
    return service.get_dispatch_route(dispatch_id)


@router.post(
    "/optimize-fleet",
    response_model=FleetAssignmentResponse,
    summary="Jointly assign available vehicles to approved allocations using OR-Tools + real road distances",
)
async def optimize_fleet(
    request: FleetAssignmentRequest,
    service: RoutingService = Depends(get_routing_service),
    current_officer: OfficerModel = Depends(get_current_officer),
):
    return service.optimize_fleet_assignment(request.allocationIds)
