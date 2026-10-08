#!/usr/bin/env python3
"""
SAKSHAM — OR-Tools Multi-Vehicle Capacity-Constrained Routing Problem (CVRP) Engine
Implements multi-depot, multi-vehicle routing with capacity constraints and critical demand penalties.
"""

import sys
import json
from ortools.constraint_solver import routing_enums_pb2, pywrapcp

def solve_vrp(data):
    """
    Solves Capacitated Vehicle Routing Problem with Penalties for Dropped Nodes.
    
    Expected JSON Structure:
    {
        "distance_matrix": [[int, ...], ...], # in meters
        "duration_matrix": [[int, ...], ...], # in seconds
        "demands": [int, ...],                # demand load per node (depots have 0)
        "vehicle_capacities": [int, ...],     # capacity per vehicle
        "num_vehicles": int,
        "starts": [int, ...],                 # start node index for each vehicle
        "ends": [int, ...],                   # end node index for each vehicle
        "priorities": [str, ...],             # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
        "time_windows": [[int, int], ...],    # optional [earliest, latest] in seconds
        "node_ids": [str, ...]                # identifiers for output mapping
    }
    """
    distance_matrix = data["distance_matrix"]
    duration_matrix = data.get("duration_matrix", distance_matrix)
    demands = data["demands"]
    vehicle_capacities = data["vehicle_capacities"]
    num_vehicles = data["num_vehicles"]
    starts = data["starts"]
    ends = data["ends"]
    priorities = data.get("priorities", ["MEDIUM"] * len(demands))
    node_ids = data.get("node_ids", [str(i) for i in range(len(demands))])
    num_nodes = len(distance_matrix)

    if num_vehicles <= 0 or num_nodes <= 1:
        return {
            "status": "ERROR",
            "message": "Invalid input: needs at least 1 vehicle and 2 locations."
        }

    # 1. Create Routing Index Manager
    manager = pywrapcp.RoutingIndexManager(num_nodes, num_vehicles, starts, ends)
    routing = pywrapcp.RoutingModel(manager)

    # 2. Distance and Cost Transit Callbacks
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # 3. Add Capacity Constraints Dimension
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        vehicle_capacities,  # vehicle maximum capacities
        True,  # start cumul to zero
        "Capacity"
    )

    # 4. Add Penalties for Dropping Demand Nodes (Critical Demands get Huge Penalties)
    # Depots cannot be dropped
    depot_nodes = set(starts + ends)
    priority_penalties = {
        "CRITICAL": 5000000, # 5000 km equivalent penalty
        "HIGH":     1500000, # 1500 km equivalent penalty
        "MEDIUM":    500000, # 500 km equivalent penalty
        "LOW":       150000  # 150 km equivalent penalty
    }

    for node in range(num_nodes):
        if node not in depot_nodes:
            prio = priorities[node] if node < len(priorities) else "MEDIUM"
            penalty = priority_penalties.get(prio.upper(), 500000)
            routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    # 5. Search Parameters
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 2

    # 6. Solve Problem
    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        return {
            "status": "NO_SOLUTION",
            "message": "OR-Tools could not find a feasible route satisfying constraints."
        }

    # 7. Extract Solution
    routes = []
    total_distance_m = 0
    total_duration_s = 0
    total_load_delivered = 0
    served_nodes = set()

    for vehicle_id in range(num_vehicles):
        index = routing.Start(vehicle_id)
        route_nodes = []
        route_dist_m = 0
        route_dur_s = 0
        route_load = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route_nodes.append(node)
            route_load += demands[node]
            served_nodes.add(node)
            
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            next_node = manager.IndexToNode(index)
            
            route_dist_m += distance_matrix[node][next_node]
            route_dur_s += duration_matrix[node][next_node]

        end_node = manager.IndexToNode(index)
        route_nodes.append(end_node)

        # Only include if vehicle visits at least one demand node
        stops_count = len(route_nodes)
        has_demands = any(n not in depot_nodes for n in route_nodes)

        routes.append({
            "vehicle_index": vehicle_id,
            "node_indices": route_nodes,
            "node_ids": [node_ids[n] for n in route_nodes],
            "distance_meters": route_dist_m,
            "distance_km": round(route_dist_m / 1000.0, 2),
            "duration_seconds": route_dur_s,
            "duration_minutes": round(route_dur_s / 60.0, 1),
            "load": route_load,
            "capacity": vehicle_capacities[vehicle_id],
            "load_percentage": round((route_load / vehicle_capacities[vehicle_id]) * 100, 1) if vehicle_capacities[vehicle_id] > 0 else 0,
            "active": has_demands
        })

        total_distance_m += route_dist_m
        total_duration_s += route_dur_s
        total_load_delivered += route_load

    # Find unserved / dropped demand nodes
    unfulfilled_nodes = []
    for node in range(num_nodes):
        if node not in depot_nodes and node not in served_nodes:
            unfulfilled_nodes.append({
                "node_index": node,
                "node_id": node_ids[node],
                "demand": demands[node],
                "priority": priorities[node] if node < len(priorities) else "MEDIUM"
            })

    return {
        "status": "OPTIMAL" if len(unfulfilled_nodes) == 0 else "FEASIBLE",
        "routes": routes,
        "metrics": {
            "total_distance_km": round(total_distance_m / 1000.0, 2),
            "total_duration_minutes": round(total_duration_s / 60.0, 1),
            "total_load_delivered": total_load_delivered,
            "active_vehicles": sum(1 for r in routes if r["active"]),
            "unfulfilled_count": len(unfulfilled_nodes),
            "served_count": len(served_nodes) - len(depot_nodes)
        },
        "unfulfilled": unfulfilled_nodes
    }

def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"status": "ERROR", "message": "No input provided"}))
            return
        data = json.loads(raw_input)

    result = solve_vrp(data)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
