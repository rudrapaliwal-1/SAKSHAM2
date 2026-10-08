import os
import math
import requests
from typing import List, Tuple, Optional

OSRM_LOCAL_URL = os.getenv("OSRM_LOCAL_URL", "http://localhost:5000")
OSRM_PUBLIC_URL = os.getenv("OSRM_PUBLIC_URL", "https://router.project-osrm.org")
OSRM_PROFILE = os.getenv("OSRM_PROFILE", "driving")
OSRM_TIMEOUT_SECONDS = float(os.getenv("OSRM_TIMEOUT_SECONDS", "5"))


def _haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    coord_str = f"{lon1},{lat1};{lon2},{lat2}"
    for base_url in (OSRM_LOCAL_URL, OSRM_PUBLIC_URL):
        try:
            resp = requests.get(
                f"{base_url}/route/v1/{OSRM_PROFILE}/{coord_str}?overview=false",
                timeout=OSRM_TIMEOUT_SECONDS,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    return round(data["routes"][0]["distance"] / 1000.0, 2)
        except Exception:
            continue
    # Fallback to Haversine with road curvature factor (1.28)
    crow_flies = _haversine_distance_km(lat1, lon1, lat2, lon2)
    return round(crow_flies * 1.28, 2)


def get_route(
    waypoints: List[Tuple[float, float]],
) -> Tuple[List[List[float]], float, float, str]:
    """
    waypoints: List of (lat, lon) tuples
    Returns: (geometry [[lon, lat], ...], distance_meters, duration_seconds, source)
    """
    if len(waypoints) < 2:
        return [], 0.0, 0.0, "local"

    coord_str = ";".join(f"{lon},{lat}" for lat, lon in waypoints)
    for base_url, source in (
        (OSRM_LOCAL_URL, "local"),
        (OSRM_PUBLIC_URL, "public_fallback"),
    ):
        try:
            resp = requests.get(
                f"{base_url}/route/v1/{OSRM_PROFILE}/{coord_str}?overview=full&geometries=geojson",
                timeout=OSRM_TIMEOUT_SECONDS,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    return (
                        route["geometry"]["coordinates"],
                        route["distance"],
                        route["duration"],
                        source,
                    )
        except Exception:
            if source == "public_fallback":
                break
            continue

    # Synthetic fallback geometry connecting the waypoints
    total_dist_km = 0.0
    for i in range(len(waypoints) - 1):
        total_dist_km += (
            _haversine_distance_km(
                waypoints[i][0],
                waypoints[i][1],
                waypoints[i + 1][0],
                waypoints[i + 1][1],
            )
            * 1.28
        )

    dist_m = total_dist_km * 1000.0
    dur_s = (total_dist_km / 45.0) * 3600.0  # assume 45 km/h avg speed
    coords = [[lon, lat] for lat, lon in waypoints]
    return coords, dist_m, dur_s, "simulation_fallback"
