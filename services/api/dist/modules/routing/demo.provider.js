"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoRoutingProvider = void 0;
const coordinates_js_1 = require("./coordinates.js");
class DemoRoutingProvider {
    name = 'SimulationFallback';
    /**
     * Generates high-fidelity interpolated road route geometry with road-winding coefficients.
     */
    async getRoute(waypoints) {
        if (!waypoints || waypoints.length < 2) {
            throw new Error('At least 2 waypoints required for routing');
        }
        let totalDistanceKm = 0;
        const fullLatLngs = [];
        const legs = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
            const start = waypoints[i];
            const end = waypoints[i + 1];
            const directDist = (0, coordinates_js_1.calculateHaversineKm)(start, end);
            // Real urban road distance is typically 1.25x to 1.35x direct straight-line distance
            const roadDistKm = Math.round(directDist * 1.28 * 100) / 100;
            totalDistanceKm += roadDistKm;
            const legSteps = (0, coordinates_js_1.generateInterpolatedCorridor)(start, end, 8);
            if (i > 0) {
                fullLatLngs.push(...legSteps.slice(1));
            }
            else {
                fullLatLngs.push(...legSteps);
            }
            const legDurSeconds = Math.round((roadDistKm / 35.0) * 3600); // 35 km/h urban emergency transit
            legs.push({
                distanceMeters: Math.round(roadDistKm * 1000),
                durationSeconds: legDurSeconds,
                summary: `Corridor Sector ${i + 1}`,
            });
        }
        const distanceMeters = Math.round(totalDistanceKm * 1000);
        const durationSeconds = Math.round((totalDistanceKm / 35.0) * 3600);
        const coordinates = fullLatLngs.map(pt => (0, coordinates_js_1.toOsrmLngLat)(pt));
        return {
            source: 'SIMULATION_FALLBACK',
            coordinates,
            latLngs: fullLatLngs,
            distanceMeters,
            distanceKm: Math.round(totalDistanceKm * 100) / 100,
            durationSeconds,
            durationMinutes: Math.round((durationSeconds / 60) * 10) / 10,
            legs,
            confidence: 0.85,
        };
    }
    /**
     * Generates full distance and duration matrix using road-winding model.
     */
    async getTable(locations) {
        if (!locations || locations.length < 2) {
            throw new Error('At least 2 locations required for table matrix');
        }
        const numLocs = locations.length;
        const distanceMatrix = [];
        const durationMatrix = [];
        for (let i = 0; i < numLocs; i++) {
            const distRow = [];
            const durRow = [];
            for (let j = 0; j < numLocs; j++) {
                if (i === j) {
                    distRow.push(0);
                    durRow.push(0);
                }
                else {
                    const directKm = (0, coordinates_js_1.calculateHaversineKm)(locations[i], locations[j]);
                    const roadDistMeters = Math.round(directKm * 1.28 * 1000);
                    const durSeconds = Math.round((roadDistMeters / 1000 / 35.0) * 3600);
                    distRow.push(roadDistMeters);
                    durRow.push(durSeconds);
                }
            }
            distanceMatrix.push(distRow);
            durationMatrix.push(durRow);
        }
        return {
            source: 'SIMULATION_FALLBACK',
            distanceMatrix,
            durationMatrix,
            numLocations: numLocs,
            status: 'FALLBACK',
        };
    }
}
exports.DemoRoutingProvider = DemoRoutingProvider;
