"use strict";
/**
 * SAKSHAM Centralized Coordinate Utility
 * Handles coordinate conversions between MapLibre [lat, lng] / {lat, lng} and OSRM [lng, lat] / "lng,lat"
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeLatLng = sanitizeLatLng;
exports.toOsrmLngLat = toOsrmLngLat;
exports.fromOsrmLngLat = fromOsrmLngLat;
exports.formatOsrmCoordinateString = formatOsrmCoordinateString;
exports.calculateHaversineKm = calculateHaversineKm;
exports.calculateHaversineMeters = calculateHaversineMeters;
exports.estimateDurationMinutes = estimateDurationMinutes;
exports.generateInterpolatedCorridor = generateInterpolatedCorridor;
/**
 * Validates and sanitizes a coordinate pair.
 */
function sanitizeLatLng(coord, fallback = { lat: 28.6139, lng: 77.2090 }) {
    if (!coord)
        return fallback;
    const lat = typeof coord.lat === 'number' && !isNaN(coord.lat) && isFinite(coord.lat) ? coord.lat : fallback.lat;
    const lng = typeof coord.lng === 'number' && !isNaN(coord.lng) && isFinite(coord.lng) ? coord.lng : fallback.lng;
    return { lat, lng };
}
/**
 * Converts {lat, lng} to OSRM [lng, lat] array.
 */
function toOsrmLngLat(coord) {
    return [coord.lng, coord.lat];
}
/**
 * Converts OSRM [lng, lat] array to {lat, lng}.
 */
function fromOsrmLngLat(tuple) {
    return { lat: tuple[1], lng: tuple[0] };
}
/**
 * Formats a list of coordinates into OSRM URL semicolon-separated string: "lng1,lat1;lng2,lat2;..."
 */
function formatOsrmCoordinateString(coords) {
    if (!coords || coords.length === 0)
        return '';
    return coords.map(c => `${c.lng.toFixed(6)},${c.lat.toFixed(6)}`).join(';');
}
/**
 * Calculates straight-line Haversine distance in kilometers.
 */
function calculateHaversineKm(c1, c2) {
    const R = 6371; // Earth's radius in km
    const dLat = (c2.lat - c1.lat) * (Math.PI / 180);
    const dLon = (c2.lng - c1.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
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
function calculateHaversineMeters(c1, c2) {
    return Math.round(calculateHaversineKm(c1, c2) * 1000);
}
/**
 * Estimates driving duration in minutes given road distance in km and average emergency speed.
 */
function estimateDurationMinutes(distanceKm, averageSpeedKmh = 38) {
    if (distanceKm <= 0)
        return 1;
    const hours = distanceKm / averageSpeedKmh;
    return Math.max(1, Math.round(hours * 60));
}
/**
 * Generates realistic interpolated road-like corridor waypoints between two points for fallback visualization.
 */
function generateInterpolatedCorridor(from, to, numIntermediatePoints = 6) {
    const points = [from];
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
