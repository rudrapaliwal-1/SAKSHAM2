import { LatLng } from './coordinates.js';

export type RoutingSource = 'OSRM_LIVE' | 'SIMULATION_FALLBACK';

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
  summary?: string;
  steps?: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
    name: string;
  }>;
}

export interface RouteGeometryResult {
  source: RoutingSource;
  coordinates: [number, number][]; // [lng, lat] GeoJSON LineString coordinates
  latLngs: LatLng[];
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  legs?: RouteLeg[];
  confidence: number;
}

export interface MatrixResult {
  source: RoutingSource;
  distanceMatrix: number[][]; // meters
  durationMatrix: number[][]; // seconds
  numLocations: number;
  status: 'OK' | 'FALLBACK';
}

export interface IRoutingProvider {
  name: string;
  getRoute(waypoints: LatLng[]): Promise<RouteGeometryResult>;
  getTable(locations: LatLng[]): Promise<MatrixResult>;
}

export interface RoadDisruption {
  id: string;
  name: string;
  location: LatLng;
  radiusMeters: number;
  severity: 'BLOCKED' | 'HEAVY_CONGESTION' | 'WATERLOGGED';
  penaltySeconds: number;
  description: string;
}
