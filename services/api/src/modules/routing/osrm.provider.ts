import { LatLng, formatOsrmCoordinateString, fromOsrmLngLat } from './coordinates.js';
import { IRoutingProvider, RouteGeometryResult, MatrixResult } from './routing.types.js';

export class OSRMProvider implements IRoutingProvider {
  name = 'OSRM';
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl: string = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org', timeoutMs: number = 4000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  /**
   * Fetches real road route geometry and step details using OSRM Route Service.
   * Endpoint: GET /route/v1/driving/{coordinates}?overview=full&geometries=geojson&steps=true
   */
  async getRoute(waypoints: LatLng[]): Promise<RouteGeometryResult> {
    if (!waypoints || waypoints.length < 2) {
      throw new Error('At least 2 waypoints required for routing');
    }

    const coordStr = formatOsrmCoordinateString(waypoints);
    const url = `${this.baseUrl}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true&annotations=true`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`OSRM Route API returned HTTP ${resp.status}`);
      }

      const data = await resp.json() as any;
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`OSRM Route failed: ${data.message || data.code}`);
      }

      const topRoute = data.routes[0];
      const rawCoords: [number, number][] = topRoute.geometry?.coordinates || [];
      const latLngs: LatLng[] = rawCoords.map(c => fromOsrmLngLat(c));

      const legs = (topRoute.legs || []).map((l: any) => ({
        distanceMeters: Math.round(l.distance || 0),
        durationSeconds: Math.round(l.duration || 0),
        summary: l.summary || '',
        steps: (l.steps || []).map((s: any) => ({
          instruction: s.maneuver?.type ? `${s.maneuver.type} onto ${s.name || 'unnamed road'}` : 'Continue',
          distanceMeters: Math.round(s.distance || 0),
          durationSeconds: Math.round(s.duration || 0),
          name: s.name || '',
        })),
      }));

      const distanceMeters = Math.round(topRoute.distance || 0);
      const durationSeconds = Math.round(topRoute.duration || 0);

      return {
        source: 'OSRM_LIVE',
        coordinates: rawCoords,
        latLngs,
        distanceMeters,
        distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
        durationSeconds,
        durationMinutes: Math.round((durationSeconds / 60) * 10) / 10,
        legs,
        confidence: 0.98,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`OSRM Route Request failed: ${err.message}`);
    }
  }

  /**
   * Fetches all-pairs travel distance and duration matrix using OSRM Table Service.
   * Endpoint: GET /table/v1/driving/{coordinates}?annotations=duration,distance
   */
  async getTable(locations: LatLng[]): Promise<MatrixResult> {
    if (!locations || locations.length < 2) {
      throw new Error('At least 2 locations required for table matrix');
    }

    const coordStr = formatOsrmCoordinateString(locations);
    const url = `${this.baseUrl}/table/v1/driving/${coordStr}?annotations=duration,distance`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs + 2000);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`OSRM Table API returned HTTP ${resp.status}`);
      }

      const data = await resp.json() as any;
      if (data.code !== 'Ok' || !data.durations) {
        throw new Error(`OSRM Table query failed: ${data.message || data.code}`);
      }

      const numLocs = locations.length;
      const durationMatrix: number[][] = [];
      const distanceMatrix: number[][] = [];

      for (let i = 0; i < numLocs; i++) {
        const durRow: number[] = [];
        const distRow: number[] = [];
        for (let j = 0; j < numLocs; j++) {
          const rawDur = data.durations[i]?.[j];
          const rawDist = data.distances ? data.distances[i]?.[j] : null;

          // Replace null or NaN with large fallback or 0 on diagonal
          if (i === j) {
            durRow.push(0);
            distRow.push(0);
          } else {
            const dur = typeof rawDur === 'number' && !isNaN(rawDur) ? Math.round(rawDur) : 1800;
            const dist = typeof rawDist === 'number' && !isNaN(rawDist) ? Math.round(rawDist) : Math.round(dur * 11); // ~40 km/h approx
            durRow.push(dur);
            distRow.push(dist);
          }
        }
        durationMatrix.push(durRow);
        distanceMatrix.push(distRow);
      }

      return {
        source: 'OSRM_LIVE',
        distanceMatrix,
        durationMatrix,
        numLocations: numLocs,
        status: 'OK',
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`OSRM Table Request failed: ${err.message}`);
    }
  }
}
