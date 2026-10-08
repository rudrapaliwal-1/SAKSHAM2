import { LatLng, calculateHaversineKm, generateInterpolatedCorridor, toOsrmLngLat } from './coordinates.js';
import { IRoutingProvider, RouteGeometryResult, MatrixResult } from './routing.types.js';

export class DemoRoutingProvider implements IRoutingProvider {
  name = 'SimulationFallback';

  /**
   * Generates high-fidelity interpolated road route geometry with road-winding coefficients.
   */
  async getRoute(waypoints: LatLng[]): Promise<RouteGeometryResult> {
    if (!waypoints || waypoints.length < 2) {
      throw new Error('At least 2 waypoints required for routing');
    }

    let totalDistanceKm = 0;
    const fullLatLngs: LatLng[] = [];
    const legs = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      const directDist = calculateHaversineKm(start, end);
      // Real urban road distance is typically 1.25x to 1.35x direct straight-line distance
      const roadDistKm = Math.round(directDist * 1.28 * 100) / 100;
      totalDistanceKm += roadDistKm;

      const legSteps = generateInterpolatedCorridor(start, end, 8);
      if (i > 0) {
        fullLatLngs.push(...legSteps.slice(1));
      } else {
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

    const coordinates: [number, number][] = fullLatLngs.map(pt => toOsrmLngLat(pt));

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
  async getTable(locations: LatLng[]): Promise<MatrixResult> {
    if (!locations || locations.length < 2) {
      throw new Error('At least 2 locations required for table matrix');
    }

    const numLocs = locations.length;
    const distanceMatrix: number[][] = [];
    const durationMatrix: number[][] = [];

    for (let i = 0; i < numLocs; i++) {
      const distRow: number[] = [];
      const durRow: number[] = [];
      for (let j = 0; j < numLocs; j++) {
        if (i === j) {
          distRow.push(0);
          durRow.push(0);
        } else {
          const directKm = calculateHaversineKm(locations[i], locations[j]);
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
