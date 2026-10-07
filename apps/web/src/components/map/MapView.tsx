import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useNavigate } from 'react-router-dom';
import type { Incident } from '../../types/incident';
import type { ResourceItem } from '../../types/resource';
import type { Vehicle } from '../../types/vehicle';
import type { Shelter } from '../../types/shelter';
import type { DemandRequest } from '../../types/request';
import type { DispatchMission } from '../../context/OperationalStateContext';
import type { ResponderItem } from '../../data/mockResponders';
import type { HospitalItem } from '../../data/mockHospitals';
import type { HazardZone } from '../../data/mockHazardZones';
import { useOperationalState } from '../../context/OperationalStateContext';
import {
  X,
  ArrowRight,
  Layers as LayersIcon,
  Filter as FilterIcon,
  AlertTriangle,
  Route as RouteIcon,
  Navigation,
  Shield,
  HeartPulse,
  Package,
  Building,
  MapPin,
  Clock,
  Compass,
} from 'lucide-react';
import styles from './MapView.module.css';

export interface LayerFiltersState {
  incidents: boolean;
  demands: boolean;
  resources: boolean;
  vehicles: boolean;
  shelters: boolean;
  hospitals: boolean;
  responders: boolean;
  routes: boolean;
  hazardZones: boolean;
}

interface MapViewProps {
  incidents?: Incident[];
  resources?: ResourceItem[];
  vehicles?: Vehicle[];
  shelters?: Shelter[];
  demands?: DemandRequest[];
  responders?: ResponderItem[];
  hospitals?: HospitalItem[];
  hazardZones?: HazardZone[];
  missions?: DispatchMission[];
  selectedIncident?: Incident | null;
  selectedVehicle?: Vehicle | null;
  hoveredIncidentId?: string | null;
  focusMode?: boolean;
  showControls?: boolean;
  onSelectIncident?: (incident: Incident) => void;
  onSelectShelter?: (shelter: Shelter) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onSelectDemand?: (demand: DemandRequest) => void;
  onSelectResource?: (resource: ResourceItem) => void;
  onSelectMission?: (mission: DispatchMission) => void;
  layerFilters?: Partial<LayerFiltersState>;
}

type SelectedMapObject =
  | { type: 'incident'; data: Incident }
  | { type: 'demand'; data: DemandRequest }
  | { type: 'resource'; data: ResourceItem }
  | { type: 'vehicle'; data: Vehicle }
  | { type: 'mission'; data: DispatchMission }
  | { type: 'shelter'; data: Shelter }
  | { type: 'hospital'; data: HospitalItem }
  | { type: 'responder'; data: ResponderItem }
  | { type: 'hazardZone'; data: HazardZone };

export const MapView: React.FC<MapViewProps> = ({
  incidents: propIncidents,
  resources: propResources,
  vehicles: propVehicles,
  shelters: propShelters,
  demands: propDemands,
  responders: propResponders,
  hospitals: propHospitals,
  hazardZones: propHazardZones,
  missions: propMissions,
  selectedIncident,
  selectedVehicle,
  hoveredIncidentId,
  focusMode = false,
  showControls = true,
  onSelectIncident,
  onSelectShelter,
  onSelectVehicle,
  onSelectDemand,
  onSelectResource,
  onSelectMission,
  layerFilters: propLayerFilters,
}) => {
  const navigate = useNavigate();
  const context = useOperationalState();

  // Unified data fallback to global operational state context
  const incidents = propIncidents ?? context.incidents ?? [];
  const resources = propResources ?? context.resources ?? [];
  const vehicles = propVehicles ?? context.vehicles ?? [];
  const shelters = propShelters ?? context.shelters ?? [];
  const demands = propDemands ?? context.requests ?? [];
  const responders = propResponders ?? context.responders ?? [];
  const hospitals = propHospitals ?? context.hospitals ?? [];
  const hazardZones = propHazardZones ?? context.hazardZones ?? [];
  const missions = propMissions ?? context.missions ?? [];

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const incidentMarkerEls = useRef<Map<string, HTMLElement>>(new Map());

  // Layer Toggles (All 9 layers)
  const [layers, setLayers] = useState<LayerFiltersState>({
    incidents: propLayerFilters?.incidents ?? true,
    demands: propLayerFilters?.demands ?? true,
    resources: propLayerFilters?.resources ?? true,
    vehicles: propLayerFilters?.vehicles ?? true,
    shelters: propLayerFilters?.shelters ?? true,
    hospitals: propLayerFilters?.hospitals ?? true,
    responders: propLayerFilters?.responders ?? true,
    routes: propLayerFilters?.routes ?? true,
    hazardZones: propLayerFilters?.hazardZones ?? true,
  });

  // Multi-dimensional Criteria Filters
  const [filterIncidentType, setFilterIncidentType] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterRequestStatus, setFilterRequestStatus] = useState<string>('ALL');
  const [filterResourceStatus, setFilterResourceStatus] = useState<string>('ALL');
  const [filterResponderStatus, setFilterResponderStatus] = useState<string>('ALL');

  // Inspector Drawer State
  const [selectedObject, setSelectedObject] = useState<SelectedMapObject | null>(null);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [77.22, 28.61],
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  // Filtered Datasets based on current criteria
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (filterIncidentType !== 'ALL' && inc.type !== filterIncidentType) return false;
      if (filterPriority !== 'ALL' && inc.severity !== filterPriority) return false;
      return true;
    });
  }, [incidents, filterIncidentType, filterPriority]);

  const filteredDemands = useMemo(() => {
    return demands.filter((dem) => {
      if (filterPriority !== 'ALL' && dem.priority !== filterPriority) return false;
      if (filterRequestStatus !== 'ALL' && dem.status !== filterRequestStatus) return false;
      return true;
    });
  }, [demands, filterPriority, filterRequestStatus]);

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      if (filterResourceStatus !== 'ALL' && res.status !== filterResourceStatus) return false;
      return true;
    });
  }, [resources, filterResourceStatus]);

  const filteredResponders = useMemo(() => {
    return responders.filter((rsp) => {
      if (filterResponderStatus !== 'ALL' && rsp.status !== filterResponderStatus) return false;
      return true;
    });
  }, [responders, filterResponderStatus]);

  // Synchronize external selected vehicle or incident
  useEffect(() => {
    if (selectedVehicle) {
      const activeMission = missions.find(m => m.vehicleId === selectedVehicle.id);
      if (activeMission) {
        setSelectedObject({ type: 'mission', data: activeMission });
      } else {
        setSelectedObject({ type: 'vehicle', data: selectedVehicle });
      }
    }
  }, [selectedVehicle, missions]);

  const safeLngLat = (coords?: { lat?: number; lng?: number } | null): [number, number] => {
    const lng = Number(coords?.lng);
    const lat = Number(coords?.lat);
    if (!isNaN(lng) && !isNaN(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      return [lng, lat];
    }
    return [77.2090, 28.6139]; // Safe Delhi Central fallback
  };

  // Render Operational Markers on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    incidentMarkerEls.current.clear();

    // 1. INCIDENTS
    if (layers.incidents) {
      filteredIncidents.forEach((incident) => {
        const el = document.createElement('div');
        const isHovered = hoveredIncidentId === incident.id;
        const isSelected = selectedIncident?.id === incident.id || (selectedObject?.type === 'incident' && selectedObject.data.id === incident.id);
        const isDimmed = focusMode && !isSelected && !isHovered;

        el.className = `${styles.marker} ${
          incident.severity === 'CRITICAL'
            ? styles.markerCritical
            : incident.severity === 'HIGH'
            ? styles.markerHigh
            : styles.markerMedium
        } ${isSelected ? styles.markerActive : ''} ${isHovered ? styles.markerHovered : ''} ${isDimmed ? styles.markerDimmed : ''}`;
        el.setAttribute('data-incident-id', incident.id);

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedObject({ type: 'incident', data: incident });
          onSelectIncident?.(incident);
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="${styles.mapPopup}">
            <span class="${styles.popupBadge} ${styles['badge' + incident.severity]}">${incident.severity} · INCIDENT</span>
            <h4 class="${styles.popupTitle}">${incident.type.replace(/_/g, ' ')}</h4>
            <p class="${styles.popupLoc}">${incident.location}</p>
            <p class="${styles.popupCapText}">~${incident.peopleAffected || incident.displacedCount || 0} affected · Status: ${incident.status}</p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(safeLngLat(incident.coordinates))
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        incidentMarkerEls.current.set(incident.id, el);
      });
    }

    // 2. DEMANDS / REQUESTS
    if (layers.demands) {
      filteredDemands.forEach((demand) => {
        const el = document.createElement('div');
        const isSelected = selectedObject?.type === 'demand' && selectedObject.data.id === demand.id;
        el.className = `${styles.marker} ${styles.markerDemand} ${
          demand.priority === 'CRITICAL' ? styles.markerDemandCritical : ''
        } ${isSelected ? styles.markerActive : ''}`;

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedObject({ type: 'demand', data: demand });
          onSelectDemand?.(demand);
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="${styles.mapPopup}">
            <span class="${styles.popupBadge} ${styles.badgeDemand}">${demand.priority} · DEMAND</span>
            <h4 class="${styles.popupTitle}">${demand.itemNeeded}</h4>
            <p class="${styles.popupLoc}">${demand.zoneName}</p>
            <p class="${styles.popupCapText}">Qty: ${demand.quantity.toLocaleString()} ${demand.unit} · ${demand.status}</p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(safeLngLat(demand.coordinates))
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 3. RESOURCES & DEPOTS
    if (layers.resources) {
      filteredResources.forEach((res) => {
        if (!res.coordinates) return;
        const el = document.createElement('div');
        const isSelected = selectedObject?.type === 'resource' && selectedObject.data.id === res.id;
        el.className = `${styles.marker} ${styles.markerResource} ${
          styles['markerResource' + res.status] || ''
        } ${isSelected ? styles.markerActive : ''}`;

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedObject({ type: 'resource', data: res });
          onSelectResource?.(res);
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="${styles.mapPopup}">
            <span class="${styles.popupBadge} ${styles.badgeResource}">${res.category} · ${res.status}</span>
            <h4 class="${styles.popupTitle}">${res.name}</h4>
            <p class="${styles.popupLoc}">${res.locationName}</p>
            <p class="${styles.popupCapText}">Available: ${res.quantity.toLocaleString()} ${res.unit} (Allocated: ${res.allocatedQuantity ?? 0})</p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(safeLngLat(res.coordinates))
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 4. VEHICLES & DISPATCH MISSIONS
    if (layers.vehicles) {
      vehicles.forEach((veh) => {
        const el = document.createElement('div');
        const isSelected = selectedObject?.type === 'vehicle' && selectedObject.data.id === veh.id;
        el.className = `${styles.marker} ${styles.markerVehicle} ${
          styles['markerVeh' + veh.status] || ''
        } ${isSelected ? styles.markerActive : ''}`;

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const linkedMission = missions.find(m => m.vehicleId === veh.id);
          if (linkedMission) {
            setSelectedObject({ type: 'mission', data: linkedMission });
            onSelectMission?.(linkedMission);
          } else {
            setSelectedObject({ type: 'vehicle', data: veh });
            onSelectVehicle?.(veh);
          }
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="${styles.mapPopup}">
            <span class="${styles.popupBadge} ${styles.badgeVehicle}">${veh.type} · ${veh.status}</span>
            <h4 class="${styles.popupTitle}">${veh.name}</h4>
            <p class="${styles.popupLoc}">Operator: ${veh.driverName}</p>
            <p class="${styles.popupCapText}">Speed: ${veh.speedKmh || 45} km/h · Cap: ${veh.capacity}</p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(safeLngLat(veh.location))
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 5. SHELTERS
    if (layers.shelters) {
      shelters.forEach((shelter) => {
        const el = document.createElement('div');
        const isSelected = selectedObject?.type === 'shelter' && selectedObject.data.id === shelter.id;
        el.className = `${styles.marker} ${styles.markerShelter} ${isSelected ? styles.markerActive : ''}`;

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedObject({ type: 'shelter', data: shelter });
          onSelectShelter?.(shelter);
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="${styles.mapPopup}">
            <span class="${styles.popupBadge} ${styles.badgeShelter}">RELIEF SHELTER</span>
            <h4 class="${styles.popupTitle}">${shelter.name}</h4>
            <p class="${styles.popupLoc}">${shelter.locationName}</p>
            <p class="${styles.popupCapText}">Capacity: ${shelter.capacityOccupied} / ${shelter.capacityTotal} (${Math.round((shelter.capacityOccupied / shelter.capacityTotal) * 100)}%)</p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(safeLngLat(shelter.coordinates))
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 6. HOSPITALS & TRIAGE CENTERS
    if (layers.hospitals) {
      hospitals.forEach((hosp) => {
        const el = document.createElement('div');
        const isSelected = selectedObject?.type === 'hospital' && selectedObject.data.id === hosp.id;
        el.className = `${styles.marker} ${styles.markerHospital} ${isSelected ? styles.markerActive : ''}`;

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedObject({ type: 'hospital', data: hosp });
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="${styles.mapPopup}">
            <span class="${styles.popupBadge} ${styles.badgeHospital}">TRIAGE HOSPITAL</span>
            <h4 class="${styles.popupTitle}">${hosp.name}</h4>
            <p class="${styles.popupLoc}">${hosp.locationName}</p>
            <p class="${styles.popupCapText}">Beds: ${hosp.bedsAvailable}/${hosp.bedsTotal} · ICU: ${hosp.icuAvailable} · Blood: ${hosp.bloodUnitsAvailable} units</p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(safeLngLat(hosp.coordinates))
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }

    // 7. RESPONDERS & FIELD PERSONNEL
    if (layers.responders) {
      filteredResponders.forEach((rsp) => {
        const el = document.createElement('div');
        const isSelected = selectedObject?.type === 'responder' && selectedObject.data.id === rsp.id;
        el.className = `${styles.marker} ${styles.markerResponder} ${isSelected ? styles.markerActive : ''}`;

        const dot = document.createElement('div');
        dot.className = styles.markerDot;
        el.appendChild(dot);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedObject({ type: 'responder', data: rsp });
        });

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
          <div class="${styles.mapPopup}">
            <span class="${styles.popupBadge} ${styles.badgeResponder}">${rsp.role} · ${rsp.status}</span>
            <h4 class="${styles.popupTitle}">${rsp.name}</h4>
            <p class="${styles.popupLoc}">${rsp.agency} · ${rsp.locationName}</p>
            <p class="${styles.popupCapText}">Radio: ${rsp.contactRadio || 'Alpha-1'} · Unit: ${rsp.assignedUnit || 'Field Active'}</p>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(safeLngLat(rsp.coordinates))
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    }
  }, [
    layers,
    filteredIncidents,
    filteredDemands,
    filteredResources,
    vehicles,
    shelters,
    hospitals,
    filteredResponders,
    missions,
    selectedIncident,
    selectedObject,
    hoveredIncidentId,
    focusMode,
    onSelectIncident,
    onSelectShelter,
    onSelectVehicle,
    onSelectDemand,
    onSelectResource,
    onSelectMission,
  ]);

  // Render GeoJSON Layers: Hazard Inundation Zones & Deterministic Route Corridors
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderGeoJsonLayers = () => {
      // ── HAZARD AREAS (AFFECTED ZONES) ─────────────────────────────────
      hazardZones.forEach((hz) => {
        const sourceId = `hz-source-${hz.id}`;
        const fillLayerId = `hz-fill-${hz.id}`;
        const lineLayerId = `hz-line-${hz.id}`;

        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });

      if (layers.hazardZones) {
        hazardZones.forEach((hz) => {
          const sourceId = `hz-source-${hz.id}`;
          const fillLayerId = `hz-fill-${hz.id}`;
          const lineLayerId = `hz-line-${hz.id}`;

          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { name: hz.name, severity: hz.severity },
              geometry: {
                type: 'Polygon',
                coordinates: [hz.polygonCoordinates],
              },
            },
          });

          map.addLayer({
            id: fillLayerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': hz.severity === 'CRITICAL' ? '#EF4444' : '#F97316',
              'fill-opacity': 0.18,
            },
          });

          map.addLayer({
            id: lineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': hz.severity === 'CRITICAL' ? '#EF4444' : '#F97316',
              'line-width': 1.5,
              'line-dasharray': [3, 2],
              'line-opacity': 0.6,
            },
          });
        });
      }

      // ── ROUTES & CORRIDORS (Deterministic Demo Routing Provider) ────────────
      vehicles.forEach((v) => {
        const sourceId = `route-source-${v.id}`;
        const layerId = `route-layer-${v.id}`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });

      if (layers.routes) {
        vehicles.forEach((vehicle) => {
          if (!vehicle.destination || (vehicle.status !== 'EN_ROUTE' && vehicle.status !== 'DISPATCHED')) return;

          const sourceId = `route-source-${vehicle.id}`;
          const layerId = `route-layer-${vehicle.id}`;

          // Deterministic corridor path routing around central Delhi arteries
          const midLng = (vehicle.location.lng + vehicle.destination.lng) / 2 + 0.012;
          const midLat = (vehicle.location.lat + vehicle.destination.lat) / 2 - 0.006;

          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [vehicle.location.lng, vehicle.location.lat],
                  [midLng, midLat],
                  [vehicle.destination.lng, vehicle.destination.lat],
                ],
              },
            },
          });

          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#E86F16',
              'line-width': 3,
              'line-dasharray': [4, 3],
              'line-opacity': 0.75,
            },
          });
        });
      }
    };

    if (map.isStyleLoaded()) {
      renderGeoJsonLayers();
    } else {
      map.on('style.load', renderGeoJsonLayers);
    }

    return () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      hazardZones.forEach((hz) => {
        try {
          if (currentMap.getLayer(`hz-fill-${hz.id}`)) currentMap.removeLayer(`hz-fill-${hz.id}`);
          if (currentMap.getLayer(`hz-line-${hz.id}`)) currentMap.removeLayer(`hz-line-${hz.id}`);
          if (currentMap.getSource(`hz-source-${hz.id}`)) currentMap.removeSource(`hz-source-${hz.id}`);
        } catch (_) {}
      });
      vehicles.forEach((v) => {
        try {
          if (currentMap.getLayer(`route-layer-${v.id}`)) currentMap.removeLayer(`route-layer-${v.id}`);
          if (currentMap.getSource(`route-source-${v.id}`)) currentMap.removeSource(`route-source-${v.id}`);
        } catch (_) {}
      });
    };
  }, [hazardZones, vehicles, layers.hazardZones, layers.routes]);

  // Fly to selected incident
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedIncident) return;
    map.flyTo({
      center: [selectedIncident.coordinates.lng, selectedIncident.coordinates.lat],
      zoom: 14,
      essential: true,
      duration: 1000,
    });
  }, [selectedIncident]);

  return (
    <div className={styles.mapWrapper}>
      <div ref={mapContainerRef} className={styles.mapContainer} />
      <div className={styles.overlayOverlay} />

      {/* ─── Control Bar: Layer Toggles & Operational Filters ─── */}
      {showControls && (
        <div className={styles.mapControlsTop}>
          <div className={styles.filterBar}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#FFAE73', letterSpacing: '0.04em', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <LayersIcon size={12} /> LAYERS:
            </span>
            <button
              className={`${styles.layerToggleBtn} ${layers.incidents ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, incidents: !prev.incidents }))}
            >
              ⚠️ Incidents ({filteredIncidents.length})
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.demands ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, demands: !prev.demands }))}
            >
              ⚡ Demands ({filteredDemands.length})
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.resources ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, resources: !prev.resources }))}
            >
              📦 Resources ({filteredResources.length})
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.vehicles ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, vehicles: !prev.vehicles }))}
            >
              🚒 Fleet ({vehicles.length})
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.shelters ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, shelters: !prev.shelters }))}
            >
              ⛺ Shelters ({shelters.length})
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.hospitals ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, hospitals: !prev.hospitals }))}
            >
              🏥 Hospitals ({hospitals.length})
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.responders ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, responders: !prev.responders }))}
            >
              👮 Personnel ({filteredResponders.length})
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.routes ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, routes: !prev.routes }))}
            >
              🛣️ Routes
            </button>
            <button
              className={`${styles.layerToggleBtn} ${layers.hazardZones ? styles.layerToggleBtnActive : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, hazardZones: !prev.hazardZones }))}
            >
              🌊 Hazard Areas ({hazardZones.length})
            </button>
          </div>

          {/* Quick Dropdown Criteria Filters */}
          <div className={styles.filterBar} style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(250,248,243,0.5)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <FilterIcon size={11} /> FILTERS:
            </span>
            <select
              className={styles.filterSelect}
              value={filterIncidentType}
              onChange={(e) => setFilterIncidentType(e.target.value)}
              title="Filter by Incident Type"
            >
              <option value="ALL">All Incident Types</option>
              <option value="FLOOD">Flood</option>
              <option value="STRUCTURAL_COLLAPSE">Structural Collapse</option>
              <option value="FIRE">Fire</option>
              <option value="MEDICAL_EMERGENCY">Medical Emergency</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              title="Filter by Severity / Priority"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filterRequestStatus}
              onChange={(e) => setFilterRequestStatus(e.target.value)}
              title="Filter by Request Status"
            >
              <option value="ALL">All Request Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="MATCHED">Matched</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filterResourceStatus}
              onChange={(e) => setFilterResourceStatus(e.target.value)}
              title="Filter by Resource Status"
            >
              <option value="ALL">All Resource Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="PARTIALLY_AVAILABLE">Partially Allocated</option>
              <option value="DEPLETED">Depleted</option>
            </select>
            <select
              className={styles.filterSelect}
              value={filterResponderStatus}
              onChange={(e) => setFilterResponderStatus(e.target.value)}
              title="Filter by Responder Status"
            >
              <option value="ALL">All Responder Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="DEPLOYED">Deployed</option>
              <option value="RESTING">Resting</option>
            </select>
          </div>
        </div>
      )}

      {/* ─── Deterministic Demo Routing Notice Banner ─── */}
      <div className={styles.demoRoutingNotice}>
        <RouteIcon size={14} color="#FFAE73" />
        <span className={styles.demoRoutingTag}>DEMO ROUTING PROVIDER</span>
        <span>Deterministic emergency transit paths calculated across Delhi NCR arterial network.</span>
      </div>

      {/* ─── Interactive Inspector Slide-Over Drawer ─── */}
      {selectedObject && (
        <div className={styles.inspectorDrawer}>
          <div className={styles.inspectorHeader}>
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: '9px',
                  fontWeight: 800,
                  color: '#FFAE73',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                OPERATIONAL INSPECTOR · {selectedObject.type}
              </span>
              <h3 className={styles.inspectorTitle}>
                {selectedObject.type === 'incident' && selectedObject.data.type.replace(/_/g, ' ')}
                {selectedObject.type === 'demand' && selectedObject.data.itemNeeded}
                {selectedObject.type === 'resource' && selectedObject.data.name}
                {selectedObject.type === 'vehicle' && selectedObject.data.name}
                {selectedObject.type === 'mission' && `Mission ${selectedObject.data.id}`}
                {selectedObject.type === 'shelter' && selectedObject.data.name}
                {selectedObject.type === 'hospital' && selectedObject.data.name}
                {selectedObject.type === 'responder' && selectedObject.data.name}
                {selectedObject.type === 'hazardZone' && selectedObject.data.name}
              </h3>
              <span className={styles.inspectorSubtitle}>
                ID:{' '}
                {selectedObject.type === 'incident' && selectedObject.data.id}
                {selectedObject.type === 'demand' && selectedObject.data.id}
                {selectedObject.type === 'resource' && selectedObject.data.id}
                {selectedObject.type === 'vehicle' && selectedObject.data.id}
                {selectedObject.type === 'mission' && selectedObject.data.id}
                {selectedObject.type === 'shelter' && selectedObject.data.id}
                {selectedObject.type === 'hospital' && selectedObject.data.id}
                {selectedObject.type === 'responder' && selectedObject.data.id}
                {selectedObject.type === 'hazardZone' && selectedObject.data.id}
              </span>
            </div>
            <button className={styles.inspectorCloseBtn} onClick={() => setSelectedObject(null)}>
              <X size={14} />
            </button>
          </div>

          {/* 1. Demand Request Detail Card */}
          {selectedObject.type === 'demand' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>PRIORITY</span>
                  <span
                    className={styles.inspectorValue}
                    style={{
                      color: selectedObject.data.priority === 'CRITICAL' ? '#EF4444' : '#F97316',
                    }}
                  >
                    {selectedObject.data.priority}
                  </span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>REQUIRED VOLUME</span>
                  <span className={styles.inspectorValue}>
                    {selectedObject.data.quantity.toLocaleString()} {selectedObject.data.unit}
                  </span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>STATUS</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.status}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>POPULATION IN PERIL</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.affectedCount.toLocaleString()}</span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <MapPin size={11} /> TARGET RELIEF LOCATION
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>{selectedObject.data.zoneName}</p>
                <p style={{ fontSize: '9px', color: 'rgba(250,248,243,0.5)', fontFamily: 'var(--font-mono)', margin: '4px 0 0' }}>
                  Coordinates: {selectedObject.data.coordinates.lat.toFixed(4)}° N, {selectedObject.data.coordinates.lng.toFixed(4)}° E
                </p>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <Navigation size={11} /> RECOMMENDED ALLOCATION & RESPONDER
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>
                  Recommended Allocation: {selectedObject.data.allocatedResourceId ? `Depot Resource (${selectedObject.data.allocatedResourceId})` : 'AIIMS Apex Trauma Depot (100% Match)'}
                </p>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: '3px 0 0' }}>
                  Assigned Responder / Fleet: {selectedObject.data.allocatedVehicleId || 'NDRF Unit 8 (Havildar Rajesh Tanwar)'}
                </p>
                <p style={{ fontSize: '10px', color: '#FFAE73', margin: '4px 0 0' }}>
                  Corridor Route & Transit: Barapullah Bypass ➔ Ring Road (ETA: ~14 mins)
                </p>
              </div>

              <button
                className={styles.inspectorActionBtn}
                onClick={() => navigate(`/operations/matching?requestId=${selectedObject.data.id}`)}
              >
                OPEN IN MATCHING ENGINE <ArrowRight size={13} />
              </button>
            </>
          )}

          {/* 2. Resource Stockpile Detail Card */}
          {selectedObject.type === 'resource' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>RESOURCE TYPE</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.category}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>STATUS</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.status}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>AVAILABLE QUANTITY</span>
                  <span className={styles.inspectorValue} style={{ color: '#10B981' }}>
                    {selectedObject.data.quantity.toLocaleString()} {selectedObject.data.unit}
                  </span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>ALLOCATED QUANTITY</span>
                  <span className={styles.inspectorValue}>
                    {(selectedObject.data.allocatedQuantity ?? 0).toLocaleString()} {selectedObject.data.unit}
                  </span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <Building size={11} /> DEPOT LOCATION & PROVIDER
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>{selectedObject.data.locationName}</p>
                <p style={{ fontSize: '10px', color: 'rgba(250,248,243,0.7)', margin: '4px 0 0' }}>
                  Provider / Point of Contact: {selectedObject.data.contactPerson} ({selectedObject.data.contactNumber})
                </p>
                {selectedObject.data.coordinates && (
                  <p style={{ fontSize: '9px', color: 'rgba(250,248,243,0.45)', fontFamily: 'var(--font-mono)', margin: '3px 0 0' }}>
                    Location: {selectedObject.data.coordinates.lat.toFixed(4)}° N, {selectedObject.data.coordinates.lng.toFixed(4)}° E
                  </p>
                )}
              </div>

              <button
                className={styles.inspectorActionBtn}
                onClick={() => navigate('/operations/resources')}
              >
                VIEW DEPOT REGISTRY <ArrowRight size={13} />
              </button>
            </>
          )}

          {/* 3. Dispatch Mission Detail Card */}
          {selectedObject.type === 'mission' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>MISSION STATUS</span>
                  <span className={styles.inspectorValue} style={{ color: '#E86F16' }}>{selectedObject.data.status}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>DISTANCE</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.distanceKm} km</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>ESTIMATED ARRIVAL</span>
                  <span className={styles.inspectorValue} style={{ color: '#FFAE73' }}>
                    <Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                    ~{selectedObject.data.etaMinutes} mins
                  </span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>ASSIGNED OPERATOR</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.operatorName}</span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <Compass size={11} /> ORIGIN ➔ DESTINATION
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>
                  <strong>Origin:</strong> {selectedObject.data.routePath?.[0] || 'Central Delhi Storage Hub'}
                </p>
                <p style={{ fontSize: '11px', color: '#FFAE73', margin: '4px 0 0' }}>
                  <strong>Destination:</strong> {selectedObject.data.destinationName}
                </p>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <RouteIcon size={11} /> ROUTE CORRIDOR PATH
                </div>
                <p style={{ fontSize: '10px', color: 'rgba(250,248,243,0.85)', margin: 0 }}>
                  {selectedObject.data.routePath?.join(' ➔ ') || 'Inner Ring Road ➔ Kashmiri Gate Flyover'}
                </p>
                {selectedObject.data.alertMessage && (
                  <p style={{ fontSize: '9px', color: '#FFAE73', margin: '4px 0 0' }}>
                    {selectedObject.data.alertMessage}
                  </p>
                )}
              </div>

              <button
                className={styles.inspectorActionBtn}
                onClick={() => navigate('/operations/dispatch')}
              >
                OPEN IN DISPATCH COMMAND <ArrowRight size={13} />
              </button>
            </>
          )}

          {/* 4. Vehicle Detail Card */}
          {selectedObject.type === 'vehicle' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>TYPE</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.type}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>FLEET STATUS</span>
                  <span className={styles.inspectorValue} style={{ color: '#3B82F6' }}>{selectedObject.data.status}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>OPERATOR</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.driverName}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>SPEED</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.speedKmh || 48} km/h</span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <Package size={11} /> CARGO & PAYLOAD
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>
                  {selectedObject.data.cargo || 'Standby Payload'}
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(250,248,243,0.6)', margin: '3px 0 0' }}>
                  Total Capacity: {selectedObject.data.capacity}
                </p>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <RouteIcon size={11} /> CONVOY ROUTE & ETA
                </div>
                <p style={{ fontSize: '11px', color: '#FFAE73', margin: 0 }}>
                  ETA to Destination: ~{selectedObject.data.etaMinutes || 14} mins
                </p>
                <p style={{ fontSize: '9px', color: 'rgba(250,248,243,0.45)', fontFamily: 'var(--font-mono)', margin: '4px 0 0' }}>
                  Active Highway Corridor: Outer Ring Road Bypass ➔ Kashmiri Gate
                </p>
              </div>

              <button
                className={styles.inspectorActionBtn}
                onClick={() => navigate('/operations/dispatch')}
              >
                DISPATCH CONTROL BOARD <ArrowRight size={13} />
              </button>
            </>
          )}

          {/* 5. Incident Detail Card */}
          {selectedObject.type === 'incident' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>SEVERITY</span>
                  <span
                    className={styles.inspectorValue}
                    style={{
                      color: selectedObject.data.severity === 'CRITICAL' ? '#EF4444' : '#F97316',
                    }}
                  >
                    {selectedObject.data.severity}
                  </span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>STATUS</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.status}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>CASUALTIES</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.casualtiesCount || 0}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>DISPLACED</span>
                  <span className={styles.inspectorValue}>{(selectedObject.data.displacedCount || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <AlertTriangle size={11} /> SITUATION SUMMARY
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0, lineHeight: 1.4 }}>
                  {selectedObject.data.description}
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(250,248,243,0.6)', margin: '6px 0 0' }}>
                  Reporter: {selectedObject.data.reporterName} ({selectedObject.data.reporterContact})
                </p>
              </div>

              <button
                className={styles.inspectorActionBtn}
                onClick={() => navigate(`/operations/incidents/${selectedObject.data.id}`)}
              >
                OPEN INCIDENT CASE FILE <ArrowRight size={13} />
              </button>
            </>
          )}

          {/* 6. Hospital Detail Card */}
          {selectedObject.type === 'hospital' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>AVAILABLE BEDS</span>
                  <span className={styles.inspectorValue} style={{ color: '#06B6D4' }}>
                    {selectedObject.data.bedsAvailable} / {selectedObject.data.bedsTotal}
                  </span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>ICU CAPACITY</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.icuAvailable} Beds</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>BLOOD UNITS</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.bloodUnitsAvailable} Units</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>OXYGEN STATUS</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.oxygenStatus}</span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <HeartPulse size={11} /> EMERGENCY TRIAGE CENTER
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>{selectedObject.data.locationName}</p>
                <p style={{ fontSize: '10px', color: 'rgba(250,248,243,0.7)', margin: '4px 0 0' }}>
                  Emergency Hotline: {selectedObject.data.contactEmergency}
                </p>
              </div>
            </>
          )}

          {/* 7. Responder Detail Card */}
          {selectedObject.type === 'responder' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>ROLE</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.role}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>STATUS</span>
                  <span className={styles.inspectorValue} style={{ color: '#8B5CF6' }}>{selectedObject.data.status}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>AGENCY</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.agency}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>CONTACT RADIO</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.contactRadio}</span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <Shield size={11} /> FIELD UNIT & LOCATION
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>
                  Assigned Unit: {selectedObject.data.assignedUnit || 'Standby Unit'} {selectedObject.data.assignedMissionId ? `(Mission ${selectedObject.data.assignedMissionId})` : ''}
                </p>
                <p style={{ fontSize: '10px', color: 'rgba(250,248,243,0.7)', margin: '4px 0 0' }}>
                  Operational Location: {selectedObject.data.locationName} ({selectedObject.data.contactPhone})
                </p>
              </div>
            </>
          )}

          {/* 8. Shelter Detail Card */}
          {selectedObject.type === 'shelter' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>OCCUPANCY</span>
                  <span className={styles.inspectorValue} style={{ color: '#10B981' }}>
                    {selectedObject.data.capacityOccupied} / {selectedObject.data.capacityTotal}
                  </span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>STATUS</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.status}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>CAMP OFFICER</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.contactPerson}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>CONTACT</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.contactNumber}</span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <Building size={11} /> SHELTER LOCATION & PROVISIONS
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>{selectedObject.data.locationName}</p>
                <p style={{ fontSize: '10px', color: 'rgba(250,248,243,0.7)', margin: '4px 0 0' }}>
                  Facilities: {selectedObject.data.resourcesAvailable?.join(', ') || 'Water, Food, Medical First Aid'}
                </p>
              </div>
            </>
          )}

          {/* 9. Hazard Zone Detail Card */}
          {selectedObject.type === 'hazardZone' && (
            <>
              <div className={styles.inspectorGrid}>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>HAZARD TYPE</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.type}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>SEVERITY</span>
                  <span className={styles.inspectorValue} style={{ color: '#EF4444' }}>{selectedObject.data.severity}</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>AFFECTED RADIUS</span>
                  <span className={styles.inspectorValue}>{selectedObject.data.affectedRadiusMeters} m</span>
                </div>
                <div className={styles.inspectorCell}>
                  <span className={styles.inspectorLabel}>CENTER POINT</span>
                  <span className={styles.inspectorValue} style={{ fontSize: '10px' }}>
                    {selectedObject.data.centerCoordinates.lat.toFixed(3)}°N, {selectedObject.data.centerCoordinates.lng.toFixed(3)}°E
                  </span>
                </div>
              </div>

              <div className={styles.inspectorCard}>
                <div className={styles.inspectorCardTitle}>
                  <AlertTriangle size={11} /> PERIMETER DETAILS
                </div>
                <p style={{ fontSize: '11px', color: '#FAF8F3', margin: 0 }}>{selectedObject.data.description}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
