"""
Thin wrapper around the OSRM HTTP API.

Two OSRM services are used:
  - /table/v1  -> bulk distance & duration matrix (used to feed OR-Tools)
  - /route/v1  -> actual road-following geometry for a single ordered
                  sequence of stops (used to draw the route on the map)

Local-first: tries OSRM_LOCAL_URL (your india-260819.osrm build) and
falls back to the public demo server if the local instance is down,
matching your "Public OSRM fallback" checklist item.
"""
from typing import List, Tuple
import requests

from .config import (
    OSRM_LOCAL_URL,
    OSRM_PUBLIC_URL,
    OSRM_PROFILE,
    OSRM_TIMEOUT_SECONDS,
)
from .schemas import Coordinate


class OSRMError(Exception):
    pass


def _coords_to_osrm_str(coords: List[Coordinate]) -> str:
    # OSRM expects "lon,lat;lon,lat;..."
    return ";".join(f"{c.lon},{c.lat}" for c in coords)


def _get_with_fallback(path: str) -> Tuple[dict, str]:
    """
    Try the local OSRM server first, fall back to the public one.
    Returns (json_body, source) where source is "local" or "public_fallback".
    """
    for base_url, source in ((OSRM_LOCAL_URL, "local"), (OSRM_PUBLIC_URL, "public_fallback")):
        try:
            resp = requests.get(f"{base_url}{path}", timeout=OSRM_TIMEOUT_SECONDS)
            resp.raise_for_status()
            body = resp.json()
            if body.get("code") != "Ok":
                raise OSRMError(f"OSRM returned code={body.get('code')} message={body.get('message')}")
            return body, source
        except (requests.RequestException, OSRMError):
            if source == "public_fallback":
                raise OSRMError(
                    "Both local OSRM and public fallback failed. "
                    "Check that your local OSRM container is running "
                    "(osrm-routed on india-260819.osrm) or that you have internet access."
                )
            continue  # try the fallback
    raise OSRMError("Unreachable OSRM code path")


def get_distance_duration_matrix(coords: List[Coordinate]) -> Tuple[List[List[float]], List[List[float]], str]:
    """
    Calls OSRM /table service. Returns (distances_m, durations_s, source).
    """
    coord_str = _coords_to_osrm_str(coords)
    path = f"/table/v1/{OSRM_PROFILE}/{coord_str}?annotations=distance,duration"
    body, source = _get_with_fallback(path)
    return body["distances"], body["durations"], source


def get_route_geometry(coords: List[Coordinate]) -> Tuple[List[List[float]], float, float, str]:
    """
    Calls OSRM /route service for an ORDERED list of stops (depot -> stop1 -> stop2 -> ...).
    Returns (geojson_coordinates [[lon,lat],...], distance_m, duration_s, source).
    """
    if len(coords) < 2:
        return [], 0.0, 0.0, "local"

    coord_str = _coords_to_osrm_str(coords)
    path = f"/route/v1/{OSRM_PROFILE}/{coord_str}?overview=full&geometries=geojson"
    body, source = _get_with_fallback(path)

    route = body["routes"][0]
    geometry_coords = route["geometry"]["coordinates"]  # [[lon, lat], ...]
    return geometry_coords, route["distance"], route["duration"], source
