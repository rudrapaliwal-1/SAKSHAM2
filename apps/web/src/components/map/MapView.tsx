import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Incident } from '../../types/incident';
import type { ResourceItem } from '../../types/resource';
import type { Vehicle } from '../../types/vehicle';
import type { Shelter } from '../../types/shelter';
import type { ResponderItem } from '../../data/mockResponders';
import type { HazardZone } from '../../data/mockHazardZones';
import type { FeatureCollection } from 'geojson';
import { Compass, ZoomIn, ZoomOut, Maximize2, Navigation, Crosshair, Radio, Play, Pause, Activity } from 'lucide-react';
import styles from './MapView.module.css';

export type BasemapMode = 'SATELLITE_HYBRID' | 'TACTICAL_DARK' | 'STREETS';

interface MapViewProps {
  incidents?: Incident[];
  resources?: ResourceItem[];
  vehicles?: Vehicle[];
  shelters?: Shelter[];
  demands?: any[];
  hospitals?: any[];
  responders?: ResponderItem[];
  hazardZones?: HazardZone[];
  missions?: any[];
  selectedIncident?: Incident | null;
  selectedVehicle?: Vehicle | null;
  hoveredIncidentId?: string | null;
  focusMode?: boolean;
  showControls?: boolean;
  showBasemapSelector?: boolean;
  defaultBasemap?: BasemapMode;
  onBasemapChange?: (mode: BasemapMode) => void;
  onSelectIncident?: (incident: Incident) => void;
  onSelectShelter?: (shelter: Shelter) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onSelectDemand?: (demand: any) => void;
  onSelectResource?: (resource: any) => void;
  onSelectMission?: (mission: any) => void;
  routeGeometries?: Record<string, [number, number][]>;
  alternativeRouteGeometries?: Record<string, [number, number][]>;
  showTacticalGrid?: boolean;
  showResponseRings?: boolean;
  simulateFleetMovement?: boolean;
  activeTrackingVehicleId?: string | null;
  showRadarSweep?: boolean;
  onVehicleTelemetryUpdate?: (
    vehicleId: string,
    telemetry: {
      currentCoord: [number, number];
      speedKmh: number;
      headingDeg: number;
      distanceRemainingKm: number;
      etaMin: number;
      progressPct: number;
    }
  ) => void;
  layerFilters?: {
    incidents?: boolean;
    resources?: boolean;
    vehicles?: boolean;
    shelters?: boolean;
    routes?: boolean;
    responders?: boolean;
    hazardZones?: boolean;
    [key: string]: boolean | undefined;
  };
}

// ─── Tactical GeoJSON Generator Helpers ─────────────────────────────────────
function createGeoJSONCircle(center: [number, number], radiusKm: number, points = 64): [number, number][] {
  const coords: [number, number][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([Number((center[0] + x).toFixed(5)), Number((center[1] + y).toFixed(5))]);
  }
  return coords;
}

export const MapView: React.FC<MapViewProps> = ({
  incidents = [],
  resources = [],
  vehicles = [],
  shelters = [],
  responders = [],
  hazardZones = [],
  selectedIncident,
  selectedVehicle,
  hoveredIncidentId,
  focusMode = false,
  showControls = true,
  showBasemapSelector = true,
  defaultBasemap = 'SATELLITE_HYBRID',
  onBasemapChange,
  onSelectIncident,
  onSelectShelter,
  onSelectVehicle,
  onSelectResource,
  routeGeometries = {},
  alternativeRouteGeometries = {},
  showTacticalGrid = false,
  showResponseRings = false,
  simulateFleetMovement = true,
  activeTrackingVehicleId = null,
  showRadarSweep = false,
  onVehicleTelemetryUpdate,
  layerFilters = {
    incidents: true,
    resources: true,
    vehicles: true,
    shelters: true,
    routes: true,
    responders: true,
    hazardZones: true
  }
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const incidentMarkerEls = useRef<Map<string, HTMLElement>>(new Map());
  const vehicleMarkerItems = useRef<Map<string, { marker: maplibregl.Marker; arrowEl: HTMLElement | null; vehicle: Vehicle }>>(new Map());
  const vehicleProgressRef = useRef<Map<string, number>>(new Map());

  const [currentBasemap, setCurrentBasemap] = useState<BasemapMode>(defaultBasemap);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  const [tacticalGridActive, setTacticalGridActive] = useState<boolean>(showTacticalGrid);
  const [responseRingsActive, setResponseRingsActive] = useState<boolean>(showResponseRings);
  const [fleetSimActive, setFleetSimActive] = useState<boolean>(simulateFleetMovement);
  const [radarSweepActive, setRadarSweepActive] = useState<boolean>(showRadarSweep);

  useEffect(() => { setTacticalGridActive(showTacticalGrid); }, [showTacticalGrid]);
  useEffect(() => { setResponseRingsActive(showResponseRings); }, [showResponseRings]);
  useEffect(() => { setFleetSimActive(simulateFleetMovement); }, [simulateFleetMovement]);
  useEffect(() => { setRadarSweepActive(showRadarSweep); }, [showRadarSweep]);

  // ─── 1. Initialize Map with High-Resolution Multi-Layer Basemap ────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          // 1. High-Resolution Satellite Base (Esri World Imagery)
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; Esri, Maxar, Earthstar Geographics'
          },
          // 2. High-Contrast Road Network Overlay (Esri Transportation)
          'esri-roads': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; Esri Transportation'
          },
          // 3. Boundaries and City Labels Overlay (Esri Places)
          'esri-boundaries': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; Esri Boundaries'
          },
          // 4. Tactical Dark Matter Basemap (CartoDB)
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; CARTO, OpenStreetMap'
          },
          // 5. Street Navigation Basemap (CartoDB Voyager)
          'carto-streets': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; CARTO, OpenStreetMap'
          }
        },
        layers: [
          // Tactical Dark layer
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20,
            layout: {
              visibility: defaultBasemap === 'TACTICAL_DARK' ? 'visible' : 'none'
            }
          },
          // Street Navigation layer
          {
            id: 'carto-streets-layer',
            type: 'raster',
            source: 'carto-streets',
            minzoom: 0,
            maxzoom: 20,
            layout: {
              visibility: defaultBasemap === 'STREETS' ? 'visible' : 'none'
            }
          },
          // Satellite Imagery layer
          {
            id: 'satellite-base-layer',
            type: 'raster',
            source: 'esri-satellite',
            minzoom: 0,
            maxzoom: 20,
            paint: {
              'raster-saturation': 0.1,
              'raster-contrast': 0.08
            },
            layout: {
              visibility: defaultBasemap === 'SATELLITE_HYBRID' ? 'visible' : 'none'
            }
          },
          // Satellite Roads overlay
          {
            id: 'satellite-roads-layer',
            type: 'raster',
            source: 'esri-roads',
            minzoom: 6,
            maxzoom: 20,
            paint: {
              'raster-opacity': 0.85
            },
            layout: {
              visibility: defaultBasemap === 'SATELLITE_HYBRID' ? 'visible' : 'none'
            }
          },
          // Satellite Boundaries & Labels overlay
          {
            id: 'satellite-boundaries-layer',
            type: 'raster',
            source: 'esri-boundaries',
            minzoom: 2,
            maxzoom: 20,
            paint: {
              'raster-opacity': 0.95
            },
            layout: {
              visibility: defaultBasemap === 'SATELLITE_HYBRID' ? 'visible' : 'none'
            }
          }
        ]
      },
      center: [77.228, 28.618], // Delhi NCR Operations Hub
      zoom: 11.2,
      minZoom: 4,
      maxZoom: 18,
      pitch: 0,
      bearing: 0
    });

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  // ─── 2. Handle Basemap Switching ──────────────────────────────
  const handleBasemapChange = useCallback((mode: BasemapMode) => {
    setCurrentBasemap(mode);
    onBasemapChange?.(mode);

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const isSat = mode === 'SATELLITE_HYBRID';
    const isDark = mode === 'TACTICAL_DARK';
    const isStr = mode === 'STREETS';

    try {
      if (map.getLayer('satellite-base-layer')) {
        map.setLayoutProperty('satellite-base-layer', 'visibility', isSat ? 'visible' : 'none');
      }
      if (map.getLayer('satellite-roads-layer')) {
        map.setLayoutProperty('satellite-roads-layer', 'visibility', isSat ? 'visible' : 'none');
      }
      if (map.getLayer('satellite-boundaries-layer')) {
        map.setLayoutProperty('satellite-boundaries-layer', 'visibility', isSat ? 'visible' : 'none');
      }
      if (map.getLayer('carto-dark-layer')) {
        map.setLayoutProperty('carto-dark-layer', 'visibility', isDark ? 'visible' : 'none');
      }
      if (map.getLayer('carto-streets-layer')) {
        map.setLayoutProperty('carto-streets-layer', 'visibility', isStr ? 'visible' : 'none');
      }
    } catch (e) {
      console.warn('[MapView] Basemap toggle error:', e);
    }
  }, [onBasemapChange]);

  // ─── 3. Toggle 3D Perspective Tilt ───────────────────────────
  const toggle3DTilt = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextMode = !is3DMode;
    setIs3DMode(nextMode);

    map.easeTo({
      pitch: nextMode ? 48 : 0,
      bearing: nextMode ? -18 : 0,
      duration: 1000
    });
  }, [is3DMode]);

  // ─── 4. Reset Bearing & Zoom Controls ─────────────────────────
  const resetBearing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
    setIs3DMode(false);
  }, []);

  const zoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 300 });
  }, []);

  const zoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 300 });
  }, []);

  const fitActiveBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || incidents.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    incidents.forEach(inc => {
      bounds.extend([inc.coordinates.lng, inc.coordinates.lat]);
    });
    vehicles.forEach(veh => {
      bounds.extend([veh.location.lng, veh.location.lat]);
    });

    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 300 },
      maxZoom: 14,
      duration: 1000
    });
  }, [incidents, vehicles]);

  // ─── 5. Draw Hazard Zones (GeoJSON Polygons) ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = 'hazard-zones-source';
    const fillLayerId = 'hazard-zones-fill';
    const outlineLayerId = 'hazard-zones-outline';

    const updateHazardZones = () => {
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!layerFilters.hazardZones || hazardZones.length === 0) return;

      const geojsonData: FeatureCollection = {
        type: 'FeatureCollection',
        features: hazardZones.map(hz => ({
          type: 'Feature',
          properties: {
            id: hz.id,
            name: hz.name,
            severity: hz.severity,
            type: hz.type,
            description: hz.description
          },
          geometry: {
            type: 'Polygon',
            coordinates: [hz.polygonCoordinates]
          }
        }))
      };

      map.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData
      });

      map.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': [
            'match',
            ['get', 'severity'],
            'CRITICAL', '#ef4444',
            'HIGH', '#f97316',
            '#eab308'
          ],
          'fill-opacity': 0.22
        }
      });

      map.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': [
            'match',
            ['get', 'severity'],
            'CRITICAL', '#ef4444',
            'HIGH', '#f97316',
            '#eab308'
          ],
          'line-width': 2,
          'line-dasharray': [3, 2]
        }
      });
    };

    updateHazardZones();
  }, [hazardZones, layerFilters.hazardZones, mapLoaded]);

  // ─── 5b. Tactical Overlays: Response Distance Rings & MGRS Grid ─
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const ringsSourceId = 'tactical-rings-source';
    const ringsFillId = 'tactical-rings-fill';
    const ringsLineId = 'tactical-rings-line';

    const gridSourceId = 'tactical-grid-source';
    const gridLineId = 'tactical-grid-line';

    const updateTacticalOverlays = () => {
      // Clean up previous layers
      if (map.getLayer(ringsFillId)) map.removeLayer(ringsFillId);
      if (map.getLayer(ringsLineId)) map.removeLayer(ringsLineId);
      if (map.getSource(ringsSourceId)) map.removeSource(ringsSourceId);

      if (map.getLayer(gridLineId)) map.removeLayer(gridLineId);
      if (map.getSource(gridSourceId)) map.removeSource(gridSourceId);

      // A. Response Distance Rings (5km & 10km Isochrones around Key Logistics Depots)
      if (responseRingsActive) {
        const aiimsHub: [number, number] = [77.2080, 28.5680]; // AIIMS Trauma Depot
        const ndrfHub: [number, number] = [77.2550, 28.6580]; // Geeta Colony NDRF Hub

        const ringFeatures: any[] = [
          {
            type: 'Feature',
            properties: { id: 'aiims-5k', name: 'AIIMS 5km Rapid Triage Reach', color: '#38bdf8' },
            geometry: { type: 'Polygon', coordinates: [createGeoJSONCircle(aiimsHub, 5)] }
          },
          {
            type: 'Feature',
            properties: { id: 'aiims-10k', name: 'AIIMS 10km Response Isochrone', color: '#0284c7' },
            geometry: { type: 'Polygon', coordinates: [createGeoJSONCircle(aiimsHub, 10)] }
          },
          {
            type: 'Feature',
            properties: { id: 'ndrf-5k', name: 'NDRF 5km Tactical Deployment Zone', color: '#f59e0b' },
            geometry: { type: 'Polygon', coordinates: [createGeoJSONCircle(ndrfHub, 5)] }
          },
          {
            type: 'Feature',
            properties: { id: 'ndrf-10k', name: 'NDRF 10km Evacuation Reach', color: '#ea580c' },
            geometry: { type: 'Polygon', coordinates: [createGeoJSONCircle(ndrfHub, 10)] }
          }
        ];

        map.addSource(ringsSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: ringFeatures }
        });

        map.addLayer({
          id: ringsFillId,
          type: 'fill',
          source: ringsSourceId,
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.08
          }
        });

        map.addLayer({
          id: ringsLineId,
          type: 'line',
          source: ringsSourceId,
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.6,
            'line-dasharray': [4, 4],
            'line-opacity': 0.85
          }
        });
      }

      // B. MGRS Tactical Coordinate Grid lines
      if (tacticalGridActive) {
        const gridFeatures: any[] = [];
        // Longitudinal lines
        for (let lng = 77.05; lng <= 77.40; lng += 0.05) {
          gridFeatures.push({
            type: 'Feature',
            properties: { label: `${lng.toFixed(2)}°E` },
            geometry: { type: 'LineString', coordinates: [[lng, 28.45], [lng, 28.80]] }
          });
        }
        // Latitudinal lines
        for (let lat = 28.45; lat <= 28.80; lat += 0.05) {
          gridFeatures.push({
            type: 'Feature',
            properties: { label: `${lat.toFixed(2)}°N` },
            geometry: { type: 'LineString', coordinates: [[77.05, lat], [77.40, lat]] }
          });
        }

        map.addSource(gridSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: gridFeatures }
        });

        map.addLayer({
          id: gridLineId,
          type: 'line',
          source: gridSourceId,
          paint: {
            'line-color': '#38bdf8',
            'line-width': 1,
            'line-dasharray': [2, 6],
            'line-opacity': 0.35
          }
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateTacticalOverlays();
    } else {
      map.once('style.load', updateTacticalOverlays);
    }
  }, [responseRingsActive, tacticalGridActive, mapLoaded]);

  // ─── 5c. Smooth Real-Time Fleet Movement & Telemetry Engine ────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !fleetSimActive) return;

    let animTimer: number | null = null;
    let lastTelemetryEmit = 0;

    const stepSimulation = () => {
      vehicleMarkerItems.current.forEach(({ marker, arrowEl, vehicle }) => {
        if (vehicle.status !== 'EN_ROUTE' && vehicle.status !== 'DISPATCHED') return;

        const route = routeGeometries[vehicle.id] || (vehicle.destination ? [
          [vehicle.location.lng, vehicle.location.lat],
          [(vehicle.location.lng + vehicle.destination.lng) / 2 + 0.012, (vehicle.location.lat + vehicle.destination.lat) / 2 - 0.004],
          [vehicle.destination.lng, vehicle.destination.lat]
        ] : null);

        if (!route || route.length < 2) return;

        // Cumulative segment lengths
        const segLengths: number[] = [];
        let totalLen = 0;
        for (let i = 0; i < route.length - 1; i++) {
          const dx = (route[i + 1][0] - route[i][0]) * 111.32 * Math.cos((route[i][1] * Math.PI) / 180);
          const dy = (route[i + 1][1] - route[i][1]) * 110.574;
          const d = Math.sqrt(dx * dx + dy * dy);
          segLengths.push(d);
          totalLen += d;
        }

        if (totalLen <= 0) return;

        // Current progress
        let progress = vehicleProgressRef.current.get(vehicle.id) ?? 0.05;
        // Move forward slightly on each tick (~48 km/h)
        const step = 0.0025;
        progress += step;
        if (progress >= 1) progress = 0;
        vehicleProgressRef.current.set(vehicle.id, progress);

        // Find current point along route
        const targetDist = progress * totalLen;
        let accumDist = 0;
        let curCoord: [number, number] = route[0];
        let headingDeg = 0;

        for (let i = 0; i < segLengths.length; i++) {
          if (accumDist + segLengths[i] >= targetDist) {
            const segRatio = (targetDist - accumDist) / (segLengths[i] || 1);
            const p1 = route[i];
            const p2 = route[i + 1];
            const lng = p1[0] + (p2[0] - p1[0]) * segRatio;
            const lat = p1[1] + (p2[1] - p1[1]) * segRatio;
            curCoord = [lng, lat];

            // Calculate compass heading (0 = North, 90 = East)
            const angleRad = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
            headingDeg = (90 - (angleRad * 180) / Math.PI + 360) % 360;
            break;
          }
          accumDist += segLengths[i];
        }

        // Update maplibre marker position smoothly
        marker.setLngLat(curCoord);

        // Rotate heading arrow
        if (arrowEl) {
          arrowEl.style.transform = `rotate(${Math.round(headingDeg)}deg)`;
        }

        // Camera auto-tracking if this vehicle is locked
        if (activeTrackingVehicleId === vehicle.id) {
          map.easeTo({ center: curCoord, duration: 120 });
        }

        // Emit telemetry throttled to ~500ms
        const now = Date.now();
        if (now - lastTelemetryEmit > 500) {
          lastTelemetryEmit = now;
          const remainingKm = Math.max(0.1, Number(((1 - progress) * totalLen).toFixed(1)));
          const simulatedSpeed = Math.round((vehicle.speedKmh || 48) + Math.sin(now / 1500) * 4);
          const etaMin = Math.max(1, Math.round(remainingKm / (simulatedSpeed / 60)));

          onVehicleTelemetryUpdate?.(vehicle.id, {
            currentCoord: curCoord,
            speedKmh: simulatedSpeed,
            headingDeg: Math.round(headingDeg),
            distanceRemainingKm: remainingKm,
            etaMin,
            progressPct: Math.round(progress * 100)
          });
        }
      });
    };

    animTimer = window.setInterval(stepSimulation, 120);

    return () => {
      if (animTimer !== null) clearInterval(animTimer);
    };
  }, [fleetSimActive, mapLoaded, routeGeometries, vehicles, activeTrackingVehicleId, onVehicleTelemetryUpdate]);

  // ─── 6. Draw Optimized & Alternative Routes ───────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const drawAllRoutes = () => {
      // Clean up previous route layers
      vehicles.forEach(vehicle => {
        const glowId = `route-glow-${vehicle.id}`;
        const layerId = `route-layer-${vehicle.id}`;
        const sourceId = `route-source-${vehicle.id}`;
        if (map.getLayer(glowId)) map.removeLayer(glowId);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });

      Object.keys(alternativeRouteGeometries).forEach(altId => {
        const altLayerId = `alt-route-layer-${altId}`;
        const altSourceId = `alt-route-source-${altId}`;
        if (map.getLayer(altLayerId)) map.removeLayer(altLayerId);
        if (map.getSource(altSourceId)) map.removeSource(altSourceId);
      });

      if (!layerFilters.routes) return;

      // Draw primary road-following optimized routes (Vibrant Orange with Glowing Halo)
      vehicles.forEach(vehicle => {
        if (!vehicle.destination && !routeGeometries[vehicle.id]) return;

        const sourceId = `route-source-${vehicle.id}`;
        const glowId = `route-glow-${vehicle.id}`;
        const layerId = `route-layer-${vehicle.id}`;

        const realGeometry = routeGeometries[vehicle.id];
        const coordinates = realGeometry && realGeometry.length > 1
          ? realGeometry
          : vehicle.destination
            ? [
                [vehicle.location.lng, vehicle.location.lat],
                [
                  (vehicle.location.lng + vehicle.destination.lng) / 2 + 0.012,
                  (vehicle.location.lat + vehicle.destination.lat) / 2 - 0.004
                ],
                [vehicle.destination.lng, vehicle.destination.lat]
              ]
            : null;

        if (!coordinates) return;

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates
            }
          }
        });

        // 1. Route outer ambient neon glow
        map.addLayer({
          id: glowId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ff6b00',
            'line-width': 8,
            'line-opacity': 0.38,
            'line-blur': 3
          }
        });

        // 2. High-contrast road-following solid line
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ff7700',
            'line-width': 3.8,
            'line-opacity': 0.95
          }
        });
      });

      // Draw alternative contingency routes (Cyan / Blue Dashed)
      Object.entries(alternativeRouteGeometries).forEach(([altId, coords]) => {
        if (!coords || coords.length < 2) return;
        const altSourceId = `alt-route-source-${altId}`;
        const altLayerId = `alt-route-layer-${altId}`;

        map.addSource(altSourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coords
            }
          }
        });

        map.addLayer({
          id: altLayerId,
          type: 'line',
          source: altSourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#00f2fe',
            'line-width': 2.8,
            'line-dasharray': [4, 3],
            'line-opacity': 0.85
          }
        });
      });
    };

    if (map.isStyleLoaded()) {
      drawAllRoutes();
    } else {
      map.once('style.load', drawAllRoutes);
    }
  }, [vehicles, layerFilters.routes, routeGeometries, alternativeRouteGeometries, mapLoaded]);

  // ─── 7. Render Colourful High-DPI Markers ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    incidentMarkerEls.current.clear();
    vehicleMarkerItems.current.clear();

    // ── A. Incidents (Red/Coral, Orange/Amber, Green/Teal) ──
    if (layerFilters.incidents) {
      incidents.forEach(incident => {
        const el = document.createElement('div');
        el.className = `${styles.marker}`;
        el.setAttribute('data-incident-id', incident.id);

        const isCritical = incident.severity === 'CRITICAL';
        const isHigh = incident.severity === 'HIGH';

        // Animated radar wave ring for CRITICAL/HIGH
        if (isCritical) {
          const ring = document.createElement('div');
          ring.className = styles.radarRing;
          el.appendChild(ring);
        } else if (isHigh) {
          const ring = document.createElement('div');
          ring.className = `${styles.radarRing} ${styles.radarRingHigh}`;
          el.appendChild(ring);
        }

        // Marker core badge
        const core = document.createElement('div');
        core.className = `${styles.markerCore} ${
          isCritical
            ? styles.coreCritical
            : isHigh
              ? styles.coreHigh
              : incident.severity === 'MEDIUM'
                ? styles.coreMedium
                : styles.coreLow
        }`;

        // Inline SVG Alert Icon
        core.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${isCritical
              ? '<path d="M12 2L2 22h20L12 2z"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="12" y1="18" x2="12.01" y2="18"/>'
              : '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
            }
          </svg>
        `;
        el.appendChild(core);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectIncident?.(incident);
        });

        // Rich interactive dark-glass popup
        const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <div class="${styles.popupHeaderRow}">
                <span class="${styles.popupBadge} ${styles['badge' + incident.severity]}">${incident.severity} PRIORITY</span>
                <span class="${styles.popupId}">${incident.id}</span>
              </div>
              <h4 class="${styles.popupTitle}">${incident.type.replace(/_/g, ' ')}</h4>
              <p class="${styles.popupLoc}">${incident.location}</p>
              ${incident.displacedCount ? `<p class="${styles.popupCapText}">⚠️ ~${incident.displacedCount.toLocaleString()} Citizens Displaced</p>` : ''}
              ${incident.assignedTeam ? `<div class="${styles.popupMetaRow}"><span>🛡️ Assigned:</span> <strong style="color: #38bdf8;">${incident.assignedTeam}</strong></div>` : ''}
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([incident.coordinates.lng, incident.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        incidentMarkerEls.current.set(incident.id, el);
      });
    }

    // ── B. Vehicles (Electric Blue with Heading) ──
    if (layerFilters.vehicles) {
      vehicles.forEach(vehicle => {
        const el = document.createElement('div');
        el.className = `${styles.marker}`;

        const core = document.createElement('div');
        core.className = `${styles.markerCore} ${styles.coreVehicle}`;

        // Directional heading arrow if moving
        let arrowEl: HTMLElement | null = null;
        if (vehicle.status === 'EN_ROUTE' || vehicle.status === 'DISPATCHED') {
          const arrow = document.createElement('div');
          arrow.className = styles.vehicleHeadingArrow;
          core.appendChild(arrow);
          arrowEl = arrow;
        }

        // Vehicle icon
        core.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 3h15v13H1z M16 8h4l3 3v5h-7z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        `;
        el.appendChild(core);

        // Callsign badge
        const badge = document.createElement('div');
        badge.className = styles.markerCalloutBadge;
        badge.innerText = vehicle.name.split(' ')[0] || vehicle.id;
        el.appendChild(badge);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectVehicle?.(vehicle);
        });

        const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <div class="${styles.popupHeaderRow}">
                <span class="${styles.popupBadge} ${styles.badgeVehicle}">${vehicle.type} · ${vehicle.status}</span>
                <span class="${styles.popupId}">${vehicle.id}</span>
              </div>
              <h4 class="${styles.popupTitle}">${vehicle.name}</h4>
              <p class="${styles.popupCapText}">Capacity: ${vehicle.capacity}</p>
              ${vehicle.driverName ? `<p class="${styles.popupCapText}">Pilot: ${vehicle.driverName}</p>` : ''}
              ${vehicle.cargo ? `<p class="${styles.popupCargo}">📦 ${vehicle.cargo}</p>` : ''}
              ${vehicle.etaMinutes ? `<p class="${styles.popupMetaRow}">⚡ ETA: <strong>${vehicle.etaMinutes} min</strong></p>` : ''}
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([vehicle.location.lng, vehicle.location.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        vehicleMarkerItems.current.set(vehicle.id, { marker, arrowEl, vehicle });
      });
    }

    // ── C. Shelters (Emerald / Cyan Safe Zone Shield) ──
    if (layerFilters.shelters) {
      shelters.forEach(shelter => {
        const el = document.createElement('div');
        el.className = `${styles.marker}`;

        const isFull = shelter.status === 'FULL';
        const core = document.createElement('div');
        core.className = `${styles.markerCore} ${isFull ? styles.coreShelterFull : styles.coreShelter}`;

        core.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        `;
        el.appendChild(core);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectShelter?.(shelter);
        });

        const pct = Math.round((shelter.capacityOccupied / shelter.capacityTotal) * 100);
        const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <div class="${styles.popupHeaderRow}">
                <span class="${styles.popupBadge} ${styles.badgeShelter}">RELIEF SHELTER · ${shelter.status}</span>
                <span class="${styles.popupId}">${shelter.id}</span>
              </div>
              <h4 class="${styles.popupTitle}">${shelter.name}</h4>
              <p class="${styles.popupLoc}">${shelter.locationName}</p>
              <div class="${styles.popupCapacityBar}">
                <div class="${styles.popupCapacityFill}" style="width: ${pct}%"></div>
              </div>
              <p class="${styles.popupCapText}">${shelter.capacityOccupied}/${shelter.capacityTotal} occupied · ${pct}% capacity</p>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([shelter.coordinates.lng, shelter.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // ── D. Responders / Rescue Teams (Violet Squad) ──
    if (layerFilters.responders && responders.length > 0) {
      responders.forEach(resp => {
        const el = document.createElement('div');
        el.className = `${styles.marker}`;

        const core = document.createElement('div');
        core.className = `${styles.markerCore} ${styles.coreResponder}`;

        core.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
        `;
        el.appendChild(core);

        const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <div class="${styles.popupHeaderRow}">
                <span class="${styles.popupBadge} ${styles.badgeResponder}">${resp.role.replace(/_/g, ' ')}</span>
                <span class="${styles.popupId}">${resp.id}</span>
              </div>
              <h4 class="${styles.popupTitle}">${resp.name}</h4>
              <p class="${styles.popupLoc}">${resp.agency} · ${resp.locationName}</p>
              <p class="${styles.popupCapText}">Status: <strong>${resp.status}</strong></p>
              ${resp.contactRadio ? `<p class="${styles.popupCapText}">Radio: ${resp.contactRadio}</p>` : ''}
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([resp.coordinates.lng, resp.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // ── E. Resources / Depots ──
    if (layerFilters.resources) {
      resources.forEach(res => {
        if (!res.coordinates) return;

        const el = document.createElement('div');
        el.className = `${styles.marker}`;

        const core = document.createElement('div');
        core.className = `${styles.markerCore} ${styles.coreResource}`;

        core.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
        `;
        el.appendChild(core);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectResource?.(res);
        });

        const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <div class="${styles.popupHeaderRow}">
                <span class="${styles.popupBadge} ${styles.badgeResource}">${res.category}</span>
                <span class="${styles.popupId}">${res.id}</span>
              </div>
              <h4 class="${styles.popupTitle}">${res.name}</h4>
              <p class="${styles.popupLoc}">${res.locationName}</p>
              <p class="${styles.popupCapText}">Stock: <strong>${res.quantity} ${res.unit}</strong></p>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([res.coordinates.lng, res.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

  }, [incidents, resources, vehicles, shelters, responders, layerFilters, onSelectIncident, onSelectShelter, onSelectVehicle, onSelectResource]);

  // ─── 8. Handle Hover & Focus Marker Highlighting ──────────────
  useEffect(() => {
    incidentMarkerEls.current.forEach((el, id) => {
      if (id === hoveredIncidentId) {
        el.classList.add(styles.markerHovered);
      } else {
        el.classList.remove(styles.markerHovered);
      }
    });
  }, [hoveredIncidentId]);

  useEffect(() => {
    incidentMarkerEls.current.forEach((el, id) => {
      if (!focusMode) {
        el.classList.remove(styles.markerDimmed);
        el.classList.remove(styles.markerActive);
      } else {
        if (selectedIncident && id === selectedIncident.id) {
          el.classList.remove(styles.markerDimmed);
          el.classList.add(styles.markerActive);
        } else {
          el.classList.add(styles.markerDimmed);
          el.classList.remove(styles.markerActive);
        }
      }
    });
  }, [focusMode, selectedIncident]);

  // ─── 9. Fly-To Coordinates on Selection ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedIncident) return;
    map.flyTo({
      center: [selectedIncident.coordinates.lng, selectedIncident.coordinates.lat],
      zoom: 14.2,
      pitch: is3DMode ? 52 : 0,
      duration: 1100,
      essential: true
    });
  }, [selectedIncident, is3DMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVehicle) return;
    map.flyTo({
      center: [selectedVehicle.location.lng, selectedVehicle.location.lat],
      zoom: 14.2,
      pitch: is3DMode ? 52 : 0,
      duration: 1100,
      essential: true
    });
  }, [selectedVehicle, is3DMode]);

  return (
    <div className={styles.mapWrapper}>
      <div ref={mapContainerRef} className={styles.mapContainer} />
      <div className={styles.overlayOverlay} />

      {/* Floating Top Controls: Basemap Switcher */}
      {showControls && showBasemapSelector && (
        <div className={styles.mapControlsTop}>
          <div className={styles.basemapSelector}>
            <button
              type="button"
              className={`${styles.basemapBtn} ${currentBasemap === 'SATELLITE_HYBRID' ? styles.basemapBtnActive : ''}`}
              onClick={() => handleBasemapChange('SATELLITE_HYBRID')}
              title="Satellite Reconnaissance + Road Infrastructure"
            >
              🛰️ SATELLITE
            </button>
            <button
              type="button"
              className={`${styles.basemapBtn} ${currentBasemap === 'TACTICAL_DARK' ? styles.basemapBtnActive : ''}`}
              onClick={() => handleBasemapChange('TACTICAL_DARK')}
              title="Dark Tactical Common Operating Picture"
            >
              🌑 TACTICAL
            </button>
            <button
              type="button"
              className={`${styles.basemapBtn} ${currentBasemap === 'STREETS' ? styles.basemapBtnActive : ''}`}
              onClick={() => handleBasemapChange('STREETS')}
              title="Street Navigation Vector Style"
            >
              🗺️ STREETS
            </button>
          </div>
        </div>
      )}

      {/* Tactical Radar Sweep Overlay */}
      {radarSweepActive && (
        <div className={styles.radarSweepOverlay}>
          <div className={styles.radarSweepBeam} />
          <div className={styles.radarSweepCenter} />
        </div>
      )}

      {/* Floating Tactical Tools (Bottom Right) */}
      {showControls && (
        <div className={styles.mapFloatingTools}>
          <button
            type="button"
            className={`${styles.toolIconBtn} ${fleetSimActive ? styles.toolIconBtnActive : ''}`}
            onClick={() => setFleetSimActive(!fleetSimActive)}
            title={fleetSimActive ? "Pause Fleet Telemetry Simulation" : "Resume Fleet Telemetry Simulation"}
          >
            {fleetSimActive ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            className={`${styles.toolIconBtn} ${responseRingsActive ? styles.toolIconBtnActive : ''}`}
            onClick={() => setResponseRingsActive(!responseRingsActive)}
            title="Toggle Tactical 5km/10km Response Distance Rings"
          >
            <Radio size={14} />
          </button>
          <button
            type="button"
            className={`${styles.toolIconBtn} ${tacticalGridActive ? styles.toolIconBtnActive : ''}`}
            onClick={() => setTacticalGridActive(!tacticalGridActive)}
            title="Toggle MGRS Tactical Coordinate Grid"
          >
            <Crosshair size={14} />
          </button>
          <button
            type="button"
            className={`${styles.toolIconBtn} ${radarSweepActive ? styles.toolIconBtnActive : ''}`}
            onClick={() => setRadarSweepActive(!radarSweepActive)}
            title="Toggle Rotary Command Radar Sweep"
          >
            <Activity size={14} />
          </button>
          <button
            type="button"
            className={`${styles.toolIconBtn} ${is3DMode ? styles.toolIconBtnActive : ''}`}
            onClick={toggle3DTilt}
            title={is3DMode ? "Switch to 2D Top-Down Nadir" : "Switch to 3D Reconnaissance Perspective"}
          >
            <Navigation size={15} style={{ transform: is3DMode ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
          </button>
          <button
            type="button"
            className={styles.toolIconBtn}
            onClick={resetBearing}
            title="Reset North Compass"
          >
            <Compass size={15} />
          </button>
          <button
            type="button"
            className={styles.toolIconBtn}
            onClick={fitActiveBounds}
            title="Fit Map to Active Incidents & Fleet"
          >
            <Maximize2 size={15} />
          </button>
          <button
            type="button"
            className={styles.toolIconBtn}
            onClick={zoomIn}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            className={styles.toolIconBtn}
            onClick={zoomOut}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default MapView;
