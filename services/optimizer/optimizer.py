"""
OR-Tools Capacitated Vehicle Routing Problem (CVRP) solver.

Node 0..N-1 layout:
  - one node per vehicle START (depot nodes come first)
  - one node per demand point after that

We use OSRM's real road distance matrix (not straight-line distance) as
the cost matrix, so routes reflect actual drivable roads on your India
OSM extract rather than "as the crow flies" estimates.

Priority handling: OR-Tools' CVRP has no native "priority" concept, so
we implement it as a penalty-based optional-visit model — every demand
node gets a "disjunction" with a drop penalty proportional to
(priority * some scale). High-priority points get a very high penalty
for being left unassigned, so the solver strongly prefers to serve them
first when capacity is tight.

Resource-type matching: a demand point (e.g. "medical") can only be
served by a vehicle equipped for that type (e.g. an ambulance, not a
food truck). This is enforced as a hard constraint via
routing.SetAllowedVehiclesForIndex — if zero vehicles match a demand's
type, that demand is structurally unreachable and always ends up in
unassigned_node_indices, regardless of remaining capacity.
"""
from typing import List, Tuple
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

from .config import SOLVER_TIME_LIMIT_SECONDS
from .schemas import Vehicle, DemandPoint

# Large-but-finite penalty base. Real distances from OSRM are in meters,
# so this comfortably dominates any reasonable route cost.
PRIORITY_PENALTY_SCALE = 1_000_000


def solve_cvrp(
    vehicles: List[Vehicle],
    demands: List[DemandPoint],
    distance_matrix_m: List[List[float]],
) -> Tuple[List[List[int]], List[int]]:
    """
    Returns:
      routes: for each vehicle, an ordered list of node indices it visits
              (node indices are into the combined [depots..., demands...] array,
               NOT including the implicit return-to-depot node if unused)
      unassigned_node_indices: demand node indices OR-Tools chose to drop
                                (only happens if total demand > total capacity)
    """
    num_vehicles = len(vehicles)
    num_depot_nodes = num_vehicles  # one depot node per vehicle, in the same order
    num_demand_nodes = len(demands)
    num_nodes = num_depot_nodes + num_demand_nodes

    manager = pywrapcp.RoutingIndexManager(
        num_nodes,
        num_vehicles,
        list(range(num_depot_nodes)),  # start node per vehicle
        list(range(num_depot_nodes)),  # end node per vehicle (return to own depot)
    )
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(distance_matrix_m[from_node][to_node])

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Capacity constraint: demand nodes consume capacity, depot nodes consume 0.
    demands_per_node = [0] * num_depot_nodes + [d.demand for d in demands]

    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands_per_node[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # no slack
        [v.capacity for v in vehicles],
        True,  # start cumul at zero
        "Capacity",
    )

    # Let the solver drop demand nodes it truly cannot serve, at a cost
    # proportional to priority — higher priority == more expensive to skip.
    #
    # Resource-type matching: restrict each demand node to only the
    # vehicles equipped to serve its type. A demand can list only one
    # required type; a vehicle can list several types it's capable of.
    for i, d in enumerate(demands):
        node_index = manager.NodeToIndex(num_depot_nodes + i)
        penalty = d.priority * PRIORITY_PENALTY_SCALE
        routing.AddDisjunction([node_index], penalty)

        eligible_vehicles = [
            v_idx for v_idx, v in enumerate(vehicles)
            if d.resource_type in v.resource_types
        ]
        # If no vehicle matches, leave it unconstrained here — the
        # disjunction penalty alone won't drop it because there's no
        # competing incentive. SetAllowedVehiclesForIndex with an empty
        # list is what actually makes it structurally unservable.
        routing.SetAllowedVehiclesForIndex(eligible_vehicles, node_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.FromSeconds(SOLVER_TIME_LIMIT_SECONDS)

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        raise RuntimeError("OR-Tools failed to find a solution within the time limit.")

    routes: List[List[int]] = []
    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        route_nodes: List[int] = []
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route_nodes.append(node)
            index = solution.Value(routing.NextVar(index))
        route_nodes.append(manager.IndexToNode(index))  # final depot/end node
        routes.append(route_nodes)

    unassigned_node_indices = []
    for i in range(num_demand_nodes):
        node_index = manager.NodeToIndex(num_depot_nodes + i)
        if solution.Value(routing.NextVar(node_index)) == node_index:
            unassigned_node_indices.append(num_depot_nodes + i)

    return routes, unassigned_node_indices
