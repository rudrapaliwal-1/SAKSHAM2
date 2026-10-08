import { LatLng, calculateHaversineKm, formatOsrmCoordinateString } from './coordinates.js';
import { IRoutingProvider, RouteGeometryResult, MatrixResult, RoutingSource, RoadDisruption } from './routing.types.js';
import { OSRMProvider } from './osrm.provider.js';
import { DemoRoutingProvider } from './demo.provider.js';

export class RoutingService {
  private static osrmProvider = new OSRMProvider();
  private static demoProvider = new DemoRoutingProvider();
  private static activeSource: RoutingSource = 'OSRM_LIVE';

  // Matrix and route in-memory caches
  private static matrixCache = new Map<string, { result: MatrixResult; timestamp: number }>();
  private static routeCache = new Map<string, { result: RouteGeometryResult; timestamp: number }>();
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 mins

  // Active simulated road disruptions
  private static disruptions: RoadDisruption[] = [
    {
      id: 'DISRUPT-DEL-01',
      name: 'Yamuna Old Iron Bridge Inundated',
      location: { lat: 28.6635, lng: 77.2340 },
      radiusMeters: 600,
      severity: 'BLOCKED',
      penaltySeconds: 900, // 15 min detour
      description: 'Water level crossed 208.5m; bridge closed for all heavy vehicular movement.',
    },
    {
      id: 'DISRUPT-DEL-02',
      name: 'ISBT Kashmiri Gate Underpass Waterlogged',
      location: { lat: 28.6675, lng: 77.2285 },
      radiusMeters: 400,
      severity: 'WATERLOGGED',
      penaltySeconds: 600, // 10 min detour
      description: 'Water accumulation of 3.2 feet; traffic redirected via Ring Road flyover.',
    }
  ];

  static getActiveSource(): RoutingSource {
    return this.activeSource;
  }

  static getDisruptions(): RoadDisruption[] {
    return [...this.disruptions];
  }

  static addDisruption(disruption: RoadDisruption): void {
    this.disruptions.push(disruption);
    // Clear caches when network topology changes
    this.matrixCache.clear();
    this.routeCache.clear();
  }

  static clearDisruptions(): void {
    this.disruptions = [];
    this.matrixCache.clear();
    this.routeCache.clear();
  }

  /**
   * Fetches the road route between waypoints, using OSRM Live with seamless fallback.
   */
  static async getRoute(waypoints: LatLng[], forceFallback: boolean = false): Promise<RouteGeometryResult> {
    if (!waypoints || waypoints.length < 2) {
      throw new Error('At least 2 waypoints required for routing');
    }

    const cacheKey = `${formatOsrmCoordinateString(waypoints)}|${forceFallback ? 'sim' : 'osrm'}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }

    if (!forceFallback) {
      try {
        const result = await this.osrmProvider.getRoute(waypoints);
        this.activeSource = 'OSRM_LIVE';
        this.routeCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      } catch (err: any) {
        console.warn(`[ROUTING SERVICE] OSRM Live route failed (${err.message}). Falling back to Simulation Routing Provider.`);
      }
    }

    // Fallback
    this.activeSource = 'SIMULATION_FALLBACK';
    const fallbackResult = await this.demoProvider.getRoute(waypoints);
    this.routeCache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
    return fallbackResult;
  }

  /**
   * Builds an NxN travel distance & duration matrix using OSRM Table Service.
   */
  static async getTable(locations: LatLng[], forceFallback: boolean = false): Promise<MatrixResult> {
    if (!locations || locations.length < 2) {
      throw new Error('At least 2 locations required for table matrix');
    }

    const cacheKey = `${formatOsrmCoordinateString(locations)}|${forceFallback ? 'sim' : 'osrm'}`;
    const cached = this.matrixCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }

    let matrixResult: MatrixResult;

    if (!forceFallback) {
      try {
        matrixResult = await this.osrmProvider.getTable(locations);
        this.activeSource = 'OSRM_LIVE';
      } catch (err: any) {
        console.warn(`[ROUTING SERVICE] OSRM Live table failed (${err.message}). Falling back to Simulation Table Provider.`);
        matrixResult = await this.demoProvider.getTable(locations);
        this.activeSource = 'SIMULATION_FALLBACK';
      }
    } else {
      matrixResult = await this.demoProvider.getTable(locations);
      this.activeSource = 'SIMULATION_FALLBACK';
    }

    // Apply active road disruptions / penalties if any segment intersects a hazard point
    if (this.disruptions.length > 0) {
      for (let i = 0; i < locations.length; i++) {
        for (let j = 0; j < locations.length; j++) {
          if (i !== j) {
            for (const d of this.disruptions) {
              const distFromD = calculateHaversineKm(locations[i], d.location);
              const distToD = calculateHaversineKm(locations[j], d.location);
              // If corridor passes near disruption
              if (distFromD < 2.0 || distToD < 2.0) {
                matrixResult.durationMatrix[i][j] += d.penaltySeconds;
                matrixResult.distanceMatrix[i][j] += Math.round(d.penaltySeconds * 8); // detour distance
              }
            }
          }
        }
      }
    }

    this.matrixCache.set(cacheKey, { result: matrixResult, timestamp: Date.now() });
    return matrixResult;
  }

  /**
   * Simulates a route blockage and produces a replanned alternate route geometry.
   */
  static async simulateBlockage(disruptionId: string, waypoints: LatLng[]): Promise<{
    originalRoute: RouteGeometryResult;
    alternateRoute: RouteGeometryResult;
    deltaMinutes: number;
    deltaKm: number;
    disruption: RoadDisruption;
    reason: string;
  }> {
    const disruption = this.disruptions.find(d => d.id === disruptionId) || this.disruptions[0];
    const originalRoute = await this.getRoute(waypoints);

    // Create detoured waypoints avoiding the disruption epicenter
    const detouredWaypoints: LatLng[] = waypoints.map((pt, idx) => {
      if (idx > 0 && idx < waypoints.length - 1) {
        const dist = calculateHaversineKm(pt, disruption.location);
        if (dist < 1.5) {
          // Detour offset
          return {
            lat: pt.lat + 0.015,
            lng: pt.lng - 0.018,
          };
        }
      }
      return pt;
    });

    const alternateRoute = await this.getRoute(detouredWaypoints);
    // Add detour penalty
    alternateRoute.durationMinutes = Math.round((alternateRoute.durationMinutes + disruption.penaltySeconds / 60) * 10) / 10;
    alternateRoute.distanceKm = Math.round((alternateRoute.distanceKm + 2.4) * 10) / 10;

    const deltaMinutes = Math.max(1, Math.round((alternateRoute.durationMinutes - originalRoute.durationMinutes) * 10) / 10);
    const deltaKm = Math.max(0.5, Math.round((alternateRoute.distanceKm - originalRoute.distanceKm) * 10) / 10);

    return {
      originalRoute,
      alternateRoute,
      deltaMinutes,
      deltaKm,
      disruption,
      reason: `Segment blocked: ${disruption.name} (${disruption.description}). Alternate route routed via higher ground.`,
    };
  }
}
