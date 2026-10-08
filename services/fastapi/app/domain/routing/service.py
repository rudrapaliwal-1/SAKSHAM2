from typing import List, Optional
from ortools.linear_solver import pywraplp

from app.repositories.interfaces import (
    DispatchRepositoryInterface,
    AllocationRepositoryInterface,
    VehicleRepositoryInterface,
    ResourceRepositoryInterface,
    DemandRepositoryInterface,
    IncidentRepositoryInterface,
)
from app.schemas.routing import (
    RouteGeometryResponse,
    FleetAssignmentItem,
    FleetAssignmentResponse,
)
from app.schemas.allocation import AllocationStatus
from app.schemas.vehicle import VehicleStatus
from app.core.exceptions import EntityNotFoundException, ValidationException
from app.integrations.osrm_client import get_route, get_road_distance_km

# Mirrors the priority weighting already used in matching/service.py and
# dispatch/service.py, so a CRITICAL demand's distance "counts less"
# against it in the optimizer's cost function — i.e. the solver will
# happily send a slightly-farther vehicle to a CRITICAL request over a
# closer one to a LOW request.
PRIORITY_WEIGHT = {
    "CRITICAL": 0.5,
    "HIGH": 0.7,
    "MEDIUM": 0.85,
    "LOW": 1.0,
}

# Large cost used to make the solver strongly avoid an infeasible
# vehicle-allocation pairing (e.g. capacity far too small) without
# hard-forbidding it outright, matching the "allow some partial fits"
# philosophy already in DispatchService.create_dispatch.
INFEASIBLE_COST = 1_000_000.0


class RoutingService:
    def __init__(
        self,
        dispatch_repo: DispatchRepositoryInterface,
        allocation_repo: AllocationRepositoryInterface,
        vehicle_repo: VehicleRepositoryInterface,
        resource_repo: ResourceRepositoryInterface,
        demand_repo: DemandRepositoryInterface,
        incident_repo: IncidentRepositoryInterface,
    ):
        self.dispatch_repo = dispatch_repo
        self.allocation_repo = allocation_repo
        self.vehicle_repo = vehicle_repo
        self.resource_repo = resource_repo
        self.demand_repo = demand_repo
        self.incident_repo = incident_repo

    # ------------------------------------------------------------------
    # Route geometry for a single dispatch — feeds the map display.
    # ------------------------------------------------------------------
    def get_dispatch_route(self, dispatch_id: str) -> RouteGeometryResponse:
        dispatch = self.dispatch_repo.get_by_id(dispatch_id)
        if not dispatch:
            dispatch = self.dispatch_repo.get_by_ref(dispatch_id)
            if not dispatch:
                raise EntityNotFoundException("Dispatch", dispatch_id)

        alloc = self.allocation_repo.get_by_id(dispatch.allocationId)
        if not alloc:
            raise ValidationException("Associated allocation could not be found for this dispatch.")

        resource = self.resource_repo.get_by_id(alloc.resourceId)
        demand = self.demand_repo.get_by_id(alloc.demandId)
        vehicle = self.vehicle_repo.get_by_id(dispatch.vehicleId)
        if not (resource and demand and vehicle):
            raise ValidationException("Resource, demand, or vehicle details are incomplete for this dispatch.")

        incident = self.incident_repo.get_by_id(demand.incidentId)
        if not incident:
            raise ValidationException("Could not resolve a delivery location — associated incident not found.")

        # Vehicle's current position -> pickup at the resource depot -> drop-off at the incident site
        waypoints = [
            (vehicle.currentLatitude, vehicle.currentLongitude),
            (resource.latitude, resource.longitude),
            (incident.latitude, incident.longitude),
        ]
        geometry, distance_m, duration_s, source = get_route(waypoints)

        return RouteGeometryResponse(
            dispatchId=dispatch.dispatchId,
            vehicleId=vehicle.vehicleId,
            geometry=geometry,
            distanceKm=round(distance_m / 1000.0, 2),
            durationMinutes=round(duration_s / 60.0, 1),
            source=source,
        )

    # ------------------------------------------------------------------
    # Fleet-wide assignment optimization via OR-Tools.
    #
    # This generalizes what DispatchService.recommend_vehicles already
    # does (score vehicles for ONE allocation, greedily) into a joint
    # optimization across MANY allocations and MANY vehicles at once —
    # minimizing total road-distance cost (weighted by demand priority)
    # subject to each vehicle serving at most one allocation and each
    # allocation getting at most one vehicle.
    # ------------------------------------------------------------------
    def optimize_fleet_assignment(self, allocation_ids: Optional[List[str]] = None) -> FleetAssignmentResponse:
        all_allocations = self.allocation_repo.list()

        if allocation_ids:
            wanted = set(allocation_ids)
            target_allocations = [
                a for a in all_allocations
                if a.id in wanted or a.allocationId in wanted
            ]
        else:
            target_allocations = [
                a for a in all_allocations
                if a.status == AllocationStatus.APPROVED and not a.vehicleId
            ]

        if not target_allocations:
            return FleetAssignmentResponse(assignments=[], unassignedAllocationIds=[], osrmSource="n/a")

        available_vehicles = [v for v in self.vehicle_repo.list() if v.status == VehicleStatus.AVAILABLE]
        if not available_vehicles:
            return FleetAssignmentResponse(
                assignments=[],
                unassignedAllocationIds=[a.allocationId for a in target_allocations],
                osrmSource="n/a",
            )

        # Build the cost matrix: rows = vehicles, cols = allocations.
        cost = [[INFEASIBLE_COST] * len(target_allocations) for _ in available_vehicles]
        feasible = [[False] * len(target_allocations) for _ in available_vehicles]
        context = {}  # (vi, ai) -> (resource, demand) for building the response later

        for vi, veh in enumerate(available_vehicles):
            for ai, alloc in enumerate(target_allocations):
                resource = self.resource_repo.get_by_id(alloc.resourceId)
                demand = self.demand_repo.get_by_id(alloc.demandId)
                if not resource or not demand:
                    continue

                # Mirrors DispatchService.create_dispatch's minimal-fit guard.
                if veh.capacity < demand.quantity * 0.1:
                    continue

                dist_km = get_road_distance_km(
                    veh.currentLatitude, veh.currentLongitude,
                    resource.latitude, resource.longitude,
                )
                priority_value = demand.priority.value if hasattr(demand.priority, "value") else str(demand.priority)
                weight = PRIORITY_WEIGHT.get(priority_value, 1.0)

                cost[vi][ai] = dist_km * weight
                feasible[vi][ai] = True
                context[(vi, ai)] = (resource, demand, priority_value)

        # Solve the assignment problem (minimum-cost bipartite matching)
        # using OR-Tools' MIP solver. Each vehicle <= 1 allocation, each
        # allocation <= 1 vehicle — allocations that can't be feasibly
        # matched are simply left unassigned rather than forced.
        solver = pywraplp.Solver.CreateSolver("CBC")
        if solver is None:
            raise RuntimeError("OR-Tools CBC solver is unavailable in this environment.")

        x = {}
        for vi in range(len(available_vehicles)):
            for ai in range(len(target_allocations)):
                if feasible[vi][ai]:
                    x[vi, ai] = solver.IntVar(0, 1, f"x_{vi}_{ai}")

        for vi in range(len(available_vehicles)):
            solver.Add(
                solver.Sum(x[vi, ai] for ai in range(len(target_allocations)) if (vi, ai) in x) <= 1
            )
        for ai in range(len(target_allocations)):
            solver.Add(
                solver.Sum(x[vi, ai] for vi in range(len(available_vehicles)) if (vi, ai) in x) <= 1
            )

        solver.Minimize(solver.Sum(cost[vi][ai] * x[vi, ai] for (vi, ai) in x))

        status = solver.Solve()
        if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
            # No feasible pairing at all (e.g. every vehicle too small for every demand)
            return FleetAssignmentResponse(
                assignments=[],
                unassignedAllocationIds=[a.allocationId for a in target_allocations],
                osrmSource="n/a",
            )

        assignments: List[FleetAssignmentItem] = []
        assigned_alloc_indices = set()

        for (vi, ai), var in x.items():
            if var.solution_value() > 0.5:
                veh = available_vehicles[vi]
                alloc = target_allocations[ai]
                resource, demand, priority_value = context[(vi, ai)]
                assigned_alloc_indices.add(ai)
                assignments.append(
                    FleetAssignmentItem(
                        allocationId=alloc.allocationId,
                        vehicleId=veh.vehicleId,
                        vehicleName=veh.name,
                        demandId=demand.id,
                        resourceId=resource.id,
                        distanceKm=round(cost[vi][ai] / PRIORITY_WEIGHT.get(priority_value, 1.0), 2),
                        priority=priority_value,
                    )
                )

        unassigned_ids = [
            target_allocations[ai].allocationId
            for ai in range(len(target_allocations))
            if ai not in assigned_alloc_indices
        ]

        return FleetAssignmentResponse(
            assignments=assignments,
            unassignedAllocationIds=unassigned_ids,
            osrmSource="local_or_fallback",
        )
