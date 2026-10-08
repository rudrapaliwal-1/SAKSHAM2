/**
 * SAKSHAM Centralized Coordinate Utility
 * Handles coordinate conversions between MapLibre [lat, lng] / {lat, lng} and OSRM [lng, lat] / "lng,lat"
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type OsrmLngLat = [number, number]; // [lng, lat]

/**
 * Validates and sanitizes a coordinate pair.
 */
export function sanitizeLatLng(coord: Partial<LatLng> | null | undefined, fallback: LatLng = { lat: 28.6139, lng: 77.2090 }): LatLng {
  if (!coord) return fallback;
  const lat = typeof coord.lat === 'number' && !isNaN(coord.lat) && isFinite(coord.lat) ? coord.lat : fallback.lat;
  const lng = typeof coord.lng === 'number' && !isNaN(coord.lng) && isFinite(coord.lng) ? coord.lng : fallback.lng;
  return { lat, lng };
}

/**
 * Converts {lat, lng} to OSRM [lng, lat] array.
 */
export function toOsrmLngLat(coord: LatLng): OsrmLngLat {
  return [coord.lng, coord.lat];
}

/**
 * Converts OSRM [lng, lat] array to {lat, lng}.
 */
export function fromOsrmLngLat(tuple: [number, number]): LatLng {
  return { lat: tuple[1], lng: tuple[0] };
}

/**
 * Formats a list of coordinates into OSRM URL semicolon-separated string: "lng1,lat1;lng2,lat2;..."
 */
export function formatOsrmCoordinateString(coords: LatLng[]): string {
  if (!coords || coords.length === 0) return '';
  return coords.map(c => `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`).join(';');
}

/**
 * Calculates straight-line Haversine distance in kilometers.
 */
export function calculateHaversineKm(c1: LatLng, c2: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = (c2.lat - c1.lat) * (Math.PI / 180);
  const dLon = (c2.lng - c1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1.lat * (Math.PI / 180)) *
      Math.cos(c2.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Calculates Haversine distance in meters (integer).
 */
export function calculateHaversineMeters(c1: LatLng, c2: LatLng): number {
  return Math.round(calculateHaversineKm(c1, c2) * 1000);
}

/**
 * Estimates driving duration in minutes given road distance in km and average emergency speed.
 */
export function estimateDurationMinutes(distanceKm: number, averageSpeedKmh: number = 38): number {
  if (distanceKm <= 0) return 1;
  const hours = distanceKm / averageSpeedKmh;
  return Math.max(1, Math.round(hours * 60));
}

/**
 * Generates realistic interpolated road-like corridor waypoints between two points for fallback visualization.
 */
export function generateInterpolatedCorridor(from: LatLng, to: LatLng, numIntermediatePoints: number = 6): LatLng[] {
  const points: LatLng[] = [from];
  const dLat = (to.lat - from.lat) / (numIntermediatePoints + 1);
  const dLng = (to.lng - from.lng) / (numIntermediatePoints + 1);

  // Deterministic slight curvature jitter simulating road bends
  for (let i = 1; i <= numIntermediatePoints; i++) {
    const factor = Math.sin((i / (numIntermediatePoints + 1)) * Math.PI);
    const perpLat = -dLng * 0.25 * factor;
    const perpLng = dLat * 0.25 * factor;

    points.push({
      lat: Number((from.lat + dLat * i + perpLat).toFixed(6)),
      lng: Number((from.lng + dLng * i + perpLng).toFixed(6)),
    });
  }

  points.push(to);
  return points;
}
