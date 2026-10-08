import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Incident } from '../../types/incident';
import type { ResourceItem } from '../../types/resource';
import type { Vehicle } from '../../types/vehicle';
import type { Shelter } from '../../types/shelter';
import styles from './MapView.module.css';

interface MapViewProps {
  incidents?: Incident[];
  resources?: ResourceItem[];
  vehicles?: Vehicle[];
  shelters?: Shelter[];
  demands?: any[];
  hospitals?: any[];
  responders?: any[];
  hazardZones?: any[];
  missions?: any[];
  selectedIncident?: Incident | null;
  selectedVehicle?: Vehicle | null;
  hoveredIncidentId?: string | null;
  focusMode?: boolean;
  showControls?: boolean;
  onSelectIncident?: (incident: Incident) => void;
  onSelectShelter?: (shelter: Shelter) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onSelectDemand?: (demand: any) => void;
  onSelectResource?: (resource: any) => void;
  onSelectMission?: (mission: any) => void;
  /**
   * Real road-following route geometry, keyed by vehicle id, as returned
   * by GET /api/v1/routing/dispatch/{dispatchId}/route (GeoJSON-style
   * [lng, lat] pairs). When a vehicle has an entry here, MapView draws
   * this actual road route instead of the approximate curve. Populate
   * this by calling apiClient.getDispatchRoute() for each vehicle's
   * active dispatch — MapView itself does not fetch.
   */
  routeGeometries?: Record<string, [number, number][]>;
  layerFilters: {
    incidents?: boolean;
    resources?: boolean;
    vehicles?: boolean;
    shelters?: boolean;
    routes?: boolean;
    [key: string]: boolean | undefined;
  };
}

export const MapView: React.FC<MapViewProps> = ({
  incidents = [],
  resources = [],
  vehicles = [],
  shelters = [],
  selectedIncident,
  selectedVehicle,
  hoveredIncidentId,
  focusMode = false,
  onSelectIncident,
  onSelectShelter,
  onSelectVehicle,
  routeGeometries = {},
  layerFilters
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // Map from incident ID → marker DOM element, for imperative class management
  const incidentMarkerEls = useRef<Map<string, HTMLElement>>(new Map());

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [77.22, 28.61],
      zoom: 11,
      minZoom: 9,
      maxZoom: 18
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    return () => { map.remove(); };
  }, []);

  // Update Markers when data or filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    incidentMarkerEls.current.clear();

    // 1. Draw Incidents
    if (layerFilters.incidents) {
      incidents.forEach(incident => {
        const el = document.createElement('div');
        el.className = `${styles.marker} ${
          incident.severity === 'CRITICAL'
            ? styles.markerCritical
            : incident.severity === 'HIGH'
              ? styles.markerHigh
              : styles.markerMedium
        }`;
        el.setAttribute('data-incident-id', incident.id);

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectIncident?.(incident);
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <span class="${styles.popupBadge} ${styles['badge' + incident.severity]}">${incident.severity}</span>
              <h4 class="${styles.popupTitle}">${incident.type.replace(/_/g, ' ')}</h4>
              <p class="${styles.popupLoc}">${incident.location}</p>
              ${incident.displacedCount ? `<p class="${styles.popupCapText}">~${incident.displacedCount} displaced</p>` : ''}
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

    // 2. Draw Shelters
    if (layerFilters.shelters) {
      shelters.forEach(shelter => {
        const el = document.createElement('div');
        el.className = `${styles.marker} ${styles.markerShelter} ${
          shelter.status === 'FULL' ? styles.markerShelterFull : ''
        }`;

        const label = document.createElement('span');
        label.innerText = 'S';
        el.appendChild(label);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectShelter?.(shelter);
        });

        const pct = Math.round((shelter.capacityOccupied / shelter.capacityTotal) * 100);
        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <span class="${styles.popupBadge} ${styles.badgeShelter}">SHELTER · ${shelter.status}</span>
              <h4 class="${styles.popupTitle}">${shelter.name}</h4>
              <p class="${styles.popupLoc}">${shelter.locationName}</p>
              <div class="${styles.popupCapacityBar}">
                <div class="${styles.popupCapacityFill}" style="width: ${pct}%"></div>
              </div>
              <p class="${styles.popupCapText}">${shelter.capacityOccupied}/${shelter.capacityTotal} occupied · ${pct}% full</p>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([shelter.coordinates.lng, shelter.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 3. Draw Vehicles
    if (layerFilters.vehicles) {
      vehicles.forEach(vehicle => {
        const el = document.createElement('div');
        el.className = `${styles.marker} ${styles.markerVehicle} ${
          styles['markerVehicle' + vehicle.status] || ''
        }`;

        const arrow = document.createElement('div');
        arrow.className = styles.vehicleInner;
        el.appendChild(arrow);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectVehicle?.(vehicle);
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <span class="${styles.popupBadge} ${styles.badgeVehicle}">${vehicle.type} · ${vehicle.status}</span>
              <h4 class="${styles.popupTitle}">${vehicle.name}</h4>
              <p class="${styles.popupCapText}">Capacity: ${vehicle.capacity}</p>
              ${vehicle.cargo ? `<p class="${styles.popupCargo}">Cargo: <strong>${vehicle.cargo}</strong></p>` : ''}
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([vehicle.location.lng, vehicle.location.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 4. Draw Resources
    if (layerFilters.resources) {
      resources.forEach(res => {
        if (!res.coordinates) return;
        const el = document.createElement('div');
        el.className = `${styles.marker} ${styles.markerResource} ${
          styles['markerResource' + res.status] || ''
        }`;

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
          .setHTML(`
            <div class="${styles.mapPopup}">
              <span class="${styles.popupBadge} ${styles.badgeResource}">${res.category} · ${res.status}</span>
              <h4 class="${styles.popupTitle}">${res.name}</h4>
              <p class="${styles.popupLoc}">${res.locationName}</p>
              <p class="${styles.popupCapText}">Stock: ${res.quantity} ${res.unit}</p>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([res.coordinates.lng, res.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

  }, [incidents, resources, vehicles, shelters, layerFilters, onSelectIncident, onSelectShelter, onSelectVehicle]);

  // ── Hover effect: highlight hovered incident marker ─────────────────────────
  useEffect(() => {
    incidentMarkerEls.current.forEach((el, id) => {
      if (id === hoveredIncidentId) {
        el.classList.add(styles.markerHovered);
      } else {
        el.classList.remove(styles.markerHovered);
      }
    });
  }, [hoveredIncidentId]);

  // ── Focus mode: dim unrelated markers ──────────────────────────────────────
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

  // ── Fly to selected incident ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedIncident) return;
    map.flyTo({
      center: [selectedIncident.coordinates.lng, selectedIncident.coordinates.lat],
      zoom: 14,
      essential: true,
      duration: 1000,
      easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
    });
  }, [selectedIncident]);

  // ── Fly to selected vehicle ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVehicle) return;
    map.flyTo({
      center: [selectedVehicle.location.lng, selectedVehicle.location.lat],
      zoom: 14,
      essential: true,
      duration: 1000,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  }, [selectedVehicle]);

  // ── Draw route overlays ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawRoutes = () => {
      vehicles.forEach(vehicle => {
        const sourceId = `route-source-${vehicle.id}`;
        const layerId = `route-layer-${vehicle.id}`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });

      if (!layerFilters.routes) return;

      vehicles.forEach(vehicle => {
        if (!vehicle.destination || (vehicle.status !== 'EN_ROUTE' && vehicle.status !== 'DISPATCHED')) return;

        const sourceId = `route-source-${vehicle.id}`;
        const layerId = `route-layer-${vehicle.id}`;

        // Prefer the real, road-following route from OSRM (via the
        // backend's /routing/dispatch/{id}/route endpoint) when the
        // caller has fetched and passed it in. Otherwise fall back to
        // the approximate curved line so vehicles without a resolved
        // dispatch (e.g. still on mock data) keep working as before.
        const realGeometry = routeGeometries[vehicle.id];
        const coordinates = realGeometry && realGeometry.length > 1
          ? realGeometry
          : [
              [vehicle.location.lng, vehicle.location.lat],
              [
                (vehicle.location.lng + vehicle.destination.lng) / 2 + 0.015,
                (vehicle.location.lat + vehicle.destination.lat) / 2 - 0.005,
              ],
              [vehicle.destination.lng, vehicle.destination.lat]
            ];
        const isRealRoute = !!(realGeometry && realGeometry.length > 1);

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

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: isRealRoute
            ? {
                // Solid line for a real, road-following route — visually
                // distinct from the dashed "approximate" fallback line.
                'line-color': '#E86F16',
                'line-width': 3,
                'line-opacity': 0.85
              }
            : {
                'line-color': '#E86F16',
                'line-width': 2.5,
                'line-dasharray': [4, 3],
                'line-opacity': 0.65
              }
        });
      });
    };

    if (map.isStyleLoaded()) {
      drawRoutes();
    } else {
      map.on('style.load', drawRoutes);
    }

    return () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      vehicles.forEach(vehicle => {
        const sourceId = `route-source-${vehicle.id}`;
        const layerId = `route-layer-${vehicle.id}`;
        try {
          if (currentMap.getLayer(layerId)) currentMap.removeLayer(layerId);
          if (currentMap.getSource(sourceId)) currentMap.removeSource(sourceId);
        } catch (_) {}
      });
    };
  }, [vehicles, layerFilters.routes, routeGeometries]);

  return (
    <div className={styles.mapWrapper}>
      <div ref={mapContainerRef} className={styles.mapContainer} />
      <div className={styles.overlayOverlay} />
    </div>
  );
};

export default MapView;
