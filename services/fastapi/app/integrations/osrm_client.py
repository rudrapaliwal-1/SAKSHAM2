"""
Thin client for the OSRM HTTP API, used to get real road distances and
route geometry instead of straight-line (haversine) estimates.

Design goals for this integration specifically:
  - Local-first, public-fallback: tries settings.OSRM_LOCAL_URL (your
    india-260819.osrm build) first, falls back to the public demo
    server only if that's unreachable.
  - Never breaks the app: if OSRM_ENABLED is False, or both servers
    are unreachable, every function here degrades to a straight-line
    (haversine) approximation instead of raising. This means existing
    tests and any environment without OSRM running keep working
    exactly as before — OSRM is a quality upgrade, not a hard
    dependency.
"""
from typing import List, Tuple
import math
import requests

from app.core.config import settings

# (lat, lon) tuple, matching how coordinates are stored throughout this codebase
Coord = Tuple[float, float]


def _haversine_km(a: Coord, b: Coord) -> float:
    R = 6371.0
    lat1, lon1 = a
    lat2, lon2 = b
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    x = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(x), math.sqrt(1 - x))


def _straight_line_fallback(coords: List[Coord]):
    """Used when OSRM is disabled or unreachable. Assumes a flat 40 km/h
    average speed for the duration estimate — good enough for UI display,
    not for anything safety-critical."""
    geometry = [[lon, lat] for (lat, lon) in coords]  # GeoJSON order: [lon, lat]
    total_km = sum(_haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
    duration_s = (total_km / 40.0) * 3600.0
    return geometry, total_km * 1000.0, duration_s, "straight_line_fallback"


def _coords_to_osrm_str(coords: List[Coord]) -> str:
    # OSRM wants "lon,lat;lon,lat;..."
    return ";".join(f"{lon},{lat}" for (lat, lon) in coords)


def _get_with_local_then_public_fallback(path: str):
    for base_url, source in ((settings.OSRM_LOCAL_URL, "local"), (settings.OSRM_PUBLIC_URL, "public_fallback")):
        try:
            resp = requests.get(f"{base_url}{path}", timeout=settings.OSRM_TIMEOUT_SECONDS)
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") != "Ok":
                continue
            return body, source
        except requests.RequestException:
            continue
    return None, None


def get_route(coords: List[Coord]):
    """
    Returns (geometry, distance_m, duration_s, source) for an ORDERED
    sequence of stops, e.g. [vehicle_start, resource_depot, incident_site].
    geometry is GeoJSON-style [[lon, lat], ...], ready for Leaflet/Mapbox.
    source is "local", "public_fallback", or "straight_line_fallback".
    """
    if len(coords) < 2:
        return [], 0.0, 0.0, "n/a"

    if not settings.OSRM_ENABLED:
        return _straight_line_fallback(coords)

    coord_str = _coords_to_osrm_str(coords)
    path = f"/route/v1/{settings.OSRM_PROFILE}/{coord_str}?overview=full&geometries=geojson"
    body, source = _get_with_local_then_public_fallback(path)

    if body is None:
        return _straight_line_fallback(coords)

    route = body["routes"][0]
    return route["geometry"]["coordinates"], route["distance"], route["duration"], source


def get_distance_matrix(coords: List[Coord]):
    """
    Returns (distances_m, durations_s, source) for a full N x N matrix.
    Falls back to a haversine-derived matrix if OSRM is disabled/unreachable.
    """
    if not settings.OSRM_ENABLED:
        n = len(coords)
        distances = [[_haversine_km(coords[i], coords[j]) * 1000.0 for j in range(n)] for i in range(n)]
        durations = [[(d / 1000.0 / 40.0) * 3600.0 for d in row] for row in distances]
        return distances, durations, "straight_line_fallback"

    coord_str = _coords_to_osrm_str(coords)
    path = f"/table/v1/{settings.OSRM_PROFILE}/{coord_str}?annotations=distance,duration"
    body, source = _get_with_local_then_public_fallback(path)

    if body is None:
        n = len(coords)
        distances = [[_haversine_km(coords[i], coords[j]) * 1000.0 for j in range(n)] for i in range(n)]
        durations = [[(d / 1000.0 / 40.0) * 3600.0 for d in row] for row in distances]
        return distances, durations, "straight_line_fallback"

    return body["distances"], body["durations"], source


def get_road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Drop-in road-distance replacement for calculate_haversine_distance.
    Same signature, same return unit (km), but uses real OSRM road
    distance when available. Safe to call anywhere the old haversine
    function was called.
    """
    try:
        _, distance_m, _, _ = get_route([(lat1, lon1), (lat2, lon2)])
        return distance_m / 1000.0
    except Exception:
        # Absolute last resort — should be unreachable since get_route
        # already falls back internally, but never let a distance call
        # break a scoring endpoint.
        return _haversine_km((lat1, lon1), (lat2, lon2))
