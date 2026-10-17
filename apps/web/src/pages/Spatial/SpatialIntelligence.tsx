import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import {
  Layers,
  Search,
  ChevronDown,
  AlertTriangle,
  MapPin,
  Flame,
  Compass,
  Sparkles,
  Users,
  Droplets,
  Waves,
  ShieldAlert,
  FileText,
  Navigation,
  X,
  ArrowLeft,
  Trees,
  Maximize2
} from 'lucide-react';
import styles from './SpatialIntelligence.module.css';

// Data & Services
import {
  CLIMATE_NEIGHBORHOODS,
  COOLING_FACILITIES,
  URBAN_THERMAL_BLOCKS,
  type ClimateNeighborhood,
  type UrbanThermalBlock,
  type CandidateInterventionSite
} from '../../data/climateData';
import { mockShelters } from '../../data/mockShelters';
import { mockResources } from '../../data/mockResources';
import { mockHospitals } from '../../data/mockHospitals';
import { mockIncidents } from '../../data/mockIncidents';
import { fetchLiveWeatherData, type WeatherData } from '../../services/weatherService';
import {
  computeVulnerabilityScore,
  DEFAULT_VULNERABILITY_WEIGHTS,
  type VulnerabilityWeights
} from '../../utils/vulnerabilityScoring';
import { useOperationalState } from '../../context/OperationalStateContext';

// Components & Modals
import { ClimateInterventionSimulator, type SavedScenario } from '../../components/climate/ClimateInterventionSimulator';
import {
  CommunityNeedModal,
  NearbyResourcesDrawer,
  CreateResponsePlanModal
} from '../../components/climate/ClimateModals';
import { FullRiskReportModal } from '../../components/climate/FullRiskReportModal';

export const SpatialIntelligence: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const candidateMarkersRef = useRef<maplibregl.Marker[]>([]);

  const { addToast, addManualRequest, addAuditLog } = useOperationalState();

  // ── Primary Geospatial Experience Modes ──
  // 1. '3D_GIS': Perspective 3D Climate Hazard Map
  // 2. 'IR_THERMAL': Infrared Thermal Heat Risk Map (LST Sensor)
  // 3. '2D_FLAT': Orthographic 2D Flat Map
  const [mapExperience, setMapExperience] = useState<'3D_GIS' | 'IR_THERMAL' | '2D_FLAT'>('3D_GIS');
  const [thermalSubMetric, setThermalSubMetric] = useState<'LST' | 'HEAT_INDEX' | 'RADIATIVE_TRAP' | 'CANOPY_GAP' | 'EXPOSED_POP'>('LST');

  // ── Floating Hazard Overlay Controller State (Reference Image 2) ──
  const [hazardOverlayEnabled, setHazardOverlayEnabled] = useState(true);
  const [activeHazardType, setActiveHazardType] = useState<'FLOOD' | 'HEAT' | 'VULNERABILITY' | 'CANOPY' | 'POPULATION'>('FLOOD');

  // ── Right Inspector Tabs State (Reference Image 2) ──
  const [inspectorTab, setInspectorTab] = useState<'RISK_REPORT' | 'ZONE_DETAILS'>('RISK_REPORT');

  // ── Full Risk Report Modal State (Reference Image 2 Full report button) ──
  const [isFullReportOpen, setIsFullReportOpen] = useState(false);

  // ── Left Histogram Risk Tier Filter State (Reference Image 2) ──
  const [selectedRiskTier, setSelectedRiskTier] = useState<'ALL' | '0-2' | '2-4' | '4-6' | '6-8' | '8-10'>('ALL');

  // ── UI State Controls ──
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [basemap, setBasemap] = useState<'SATELLITE' | 'STREETS' | 'DARK'>('DARK');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(85);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MODERATE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  // ── 10 Independent Layer Toggles (Phase 4.B) ──
  const [showHeatRisk, setShowHeatRisk] = useState(true);
  const [showFloodRisk, setShowFloodRisk] = useState(true);
  const [showVulnerability, setShowVulnerability] = useState(true);
  const [showPopulation, setShowPopulation] = useState(false);
  const [showCanopy, setShowCanopy] = useState(false);
  const [showShelters, setShowShelters] = useState(true);
  const [showWaterPoints, setShowWaterPoints] = useState(true);
  const [showHealthcare, setShowHealthcare] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  // ── Selected Entities ──
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<ClimateNeighborhood | null>(CLIMATE_NEIGHBORHOODS[1]); // Default Seelampur
  const [selectedBlock, setSelectedBlock] = useState<UrbanThermalBlock | null>(URBAN_THERMAL_BLOCKS[0]);

  // ── Live Weather Data ──
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // ── Vulnerability Weights ──
  const [vulnerabilityWeights] = useState<VulnerabilityWeights>(DEFAULT_VULNERABILITY_WEIGHTS);

  // ── Modals State ──
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);
  const [isNearbyDrawerOpen, setIsNearbyDrawerOpen] = useState(false);
  const [isResponsePlanOpen, setIsResponsePlanOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeCandidateSites, setActiveCandidateSites] = useState<CandidateInterventionSite[]>([]);

  // Fetch live weather data for Delhi
  useEffect(() => {
    let isMounted = true;
    fetchLiveWeatherData('New Delhi').then(data => {
      if (isMounted) setWeather(data);
    });
    return () => { isMounted = false; };
  }, []);

  // Filtered neighborhoods based on search, severity & selected histogram tier
  const filteredNeighborhoods = useMemo(() => {
    return CLIMATE_NEIGHBORHOODS.filter(n => {
      if (severityFilter !== 'ALL' && n.severity !== severityFilter) return false;

      // Risk tier filter from histogram
      if (selectedRiskTier !== 'ALL') {
        const score = n.severity === 'CRITICAL' ? 8.8 : n.severity === 'HIGH' ? 6.8 : n.severity === 'MODERATE' ? 4.2 : 1.8;
        if (selectedRiskTier === '8-10' && score < 8) return false;
        if (selectedRiskTier === '6-8' && (score < 6 || score >= 8)) return false;
        if (selectedRiskTier === '4-6' && (score < 4 || score >= 6)) return false;
        if (selectedRiskTier === '2-4' && (score < 2 || score >= 4)) return false;
        if (selectedRiskTier === '0-2' && score >= 2) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.name.toLowerCase().includes(q) ||
          n.wardNumber.toLowerCase().includes(q) ||
          n.primaryHazard.toLowerCase().includes(q) ||
          n.zone.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [severityFilter, searchQuery, selectedRiskTier]);

  // Summary Metrics derivation
  const totalExposed = useMemo(() => {
    return CLIMATE_NEIGHBORHOODS.reduce((acc, n) => acc + n.exposedPopulation, 0);
  }, []);

  const criticalCount = useMemo(() => {
    return CLIMATE_NEIGHBORHOODS.filter(n => n.severity === 'CRITICAL').length;
  }, []);

  const floodCount = useMemo(() => {
    return CLIMATE_NEIGHBORHOODS.filter(n => n.primaryHazard === 'FLOOD_SURGE').length;
  }, []);

  // Compute current vulnerability assessment
  const currentAssessment = useMemo(() => {
    if (!selectedNeighborhood) return null;
    return computeVulnerabilityScore({
      hazardScore: selectedNeighborhood.severity === 'CRITICAL' ? 88 : selectedNeighborhood.severity === 'HIGH' ? 68 : 42,
      exposedPopulation: selectedNeighborhood.exposedPopulation,
      facilitiesCount: selectedNeighborhood.facilitiesCount,
      resourceSufficiencyRatio: selectedNeighborhood.resourceSufficiencyRatio,
      demographicSensitivityPct: selectedNeighborhood.demographicSensitivityPct
    }, vulnerabilityWeights);
  }, [selectedNeighborhood, vulnerabilityWeights]);

  // Basemap style specification helper
  const getBasemapStyleSpec = (type: 'SATELLITE' | 'STREETS' | 'DARK'): maplibregl.StyleSpecification => {
    if (type === 'STREETS') {
      return {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }]
      };
    }
    if (type === 'DARK') {
      return {
        version: 8,
        sources: {
          'dark-tiles': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256
          }
        },
        layers: [{
          id: 'dark-layer',
          type: 'raster',
          source: 'dark-tiles',
          paint: {
            'raster-brightness-max': 0.38,
            'raster-saturation': -1.0,
            'raster-contrast': 0.55
          }
        }]
      };
    }
    // Default: SATELLITE
    return {
      version: 8,
      sources: {
        'satellite-tiles': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics'
        }
      },
      layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', minzoom: 0, maxzoom: 20 }]
    };
  };

  // Render tactical markers
  const renderTacticalMarkers = useCallback((map: maplibregl.Map) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const createMarkerElement = (
      svgPath: string,
      bg: string,
      border: string,
      glow: string,
      title: string
    ) => {
      const el = document.createElement('div');
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.background = bg;
      el.style.border = `2px solid ${border}`;
      el.style.boxShadow = `0 0 12px ${glow}`;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';
      el.style.transition = 'transform 0.15s';
      el.title = title;
      el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
      el.onmouseenter = () => { el.style.transform = 'scale(1.25)'; };
      el.onmouseleave = () => { el.style.transform = 'scale(1)'; };
      return el;
    };

    // 1. Shelters
    if (showShelters) {
      mockShelters.forEach(s => {
        const el = createMarkerElement(
          '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
          '#0284c7',
          '#38bdf8',
          'rgba(56, 189, 248, 0.8)',
          `Shelter: ${s.name} (${s.status})`
        );
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map.flyTo({ center: [s.coordinates.lng, s.coordinates.lat], zoom: 16.5, pitch: viewMode === '3D' ? 58 : 0, duration: 800 });
          addToast('INFO', `Shelter: ${s.name} | Status: ${s.status} (${s.capacityOccupied}/${s.capacityTotal} occupied) | Supplies: ${s.resourcesAvailable.join(', ')}`);
        });
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([s.coordinates.lng, s.coordinates.lat])
          .addTo(map);
        markersRef.current.push(m);
      });
    }

    // 2. Water Points
    if (showWaterPoints) {
      COOLING_FACILITIES.filter(f => f.type === 'WATER_KIOSK').forEach(w => {
        const el = createMarkerElement(
          '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
          '#0891b2',
          '#06b6d4',
          'rgba(6, 182, 212, 0.8)',
          `Water ATM: ${w.name} (${w.waterSupplyLiters}L)`
        );
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map.flyTo({ center: w.coordinates, zoom: 16.5, pitch: viewMode === '3D' ? 58 : 0, duration: 800 });
          addToast('INFO', `Water Point: ${w.name} | Potable Supply: ${w.waterSupplyLiters.toLocaleString()}L | Status: ${w.status}`);
        });
        const m = new maplibregl.Marker({ element: el })
          .setLngLat(w.coordinates)
          .addTo(map);
        markersRef.current.push(m);
      });
    }

    // 3. Healthcare Facilities
    if (showHealthcare) {
      mockHospitals.slice(0, 3).forEach(h => {
        const el = createMarkerElement(
          '<path d="M12 6v12M6 12h12"/>',
          '#dc2626',
          '#f87171',
          'rgba(239, 68, 68, 0.8)',
          `Hospital: ${h.name} (${h.bedsAvailable} beds free)`
        );
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map.flyTo({ center: [h.coordinates.lng, h.coordinates.lat], zoom: 16.5, pitch: viewMode === '3D' ? 58 : 0, duration: 800 });
          addToast('INFO', `Healthcare Center: ${h.name} | Available Beds: ${h.bedsAvailable}/${h.bedsTotal} | ICU: ${h.icuAvailable > 0 ? `${h.icuAvailable} ICUs Active` : 'General Ward'}`);
        });
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([h.coordinates.lng, h.coordinates.lat])
          .addTo(map);
        markersRef.current.push(m);
      });
    }

    // 4. Logistics Depots
    if (showDepots) {
      mockResources.slice(0, 4).forEach(r => {
        const el = createMarkerElement(
          '<path d="M16.5 9.4 7.55 4.24a2 2 0 0 0-2 0L2.5 6.1a2 2 0 0 0-1 1.73v7.34a2 2 0 0 0 1 1.73l3.05 1.76a2 2 0 0 0 2 0l8.95-5.16a2 2 0 0 0 1-1.73V11.13a2 2 0 0 0-1-1.73z"/>',
          '#d97706',
          '#fbbf24',
          'rgba(245, 158, 11, 0.8)',
          `Logistics Depot: ${r.locationName} (${r.quantity} ${r.unit})`
        );
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map.flyTo({ center: [r.coordinates.lng, r.coordinates.lat], zoom: 16.5, pitch: viewMode === '3D' ? 58 : 0, duration: 800 });
          addToast('INFO', `Stockpile Depot: ${r.locationName} | ${r.name}: ${r.quantity.toLocaleString()} ${r.unit} (${r.status})`);
        });
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([r.coordinates.lng, r.coordinates.lat])
          .addTo(map);
        markersRef.current.push(m);
      });
    }

    // 5. Active Incidents
    if (showIncidents) {
      mockIncidents.slice(0, 3).forEach(inc => {
        const el = createMarkerElement(
          '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
          '#7f1d1d',
          '#ef4444',
          'rgba(239, 68, 68, 0.95)',
          `Active Incident: ${inc.id} (${inc.type})`
        );
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map.flyTo({ center: [inc.coordinates.lng, inc.coordinates.lat], zoom: 16.5, pitch: viewMode === '3D' ? 58 : 0, duration: 800 });
          addToast('WARNING', `Active Incident ${inc.id} [${inc.type}]: ${inc.location} | Status: ${inc.status} | Displaced: ${inc.displacedCount}`);
        });
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([inc.coordinates.lng, inc.coordinates.lat])
          .addTo(map);
        markersRef.current.push(m);
      });
    }
  }, [showShelters, showWaterPoints, showHealthcare, showDepots, showIncidents, viewMode, addToast]);

  // Idempotent setup of MapLibre layers & sources (Fixes Basemap bug, handles style.load)
  const setupMapLayersAndMarkers = useCallback((map: maplibregl.Map) => {
    if (!map) return;

    // 1. Add/Update Climate Neighborhoods GeoJSON Source
    const geojsonData: FeatureCollection = {
      type: 'FeatureCollection',
      features: CLIMATE_NEIGHBORHOODS.map(n => ({
        type: 'Feature',
        properties: {
          id: n.id,
          name: n.name,
          wardNumber: n.wardNumber,
          primaryHazard: n.primaryHazard,
          severity: n.severity,
          height: viewMode === '2D' ? 1 : n.height,
          color: n.color,
          temp: n.apparentTempC,
          floodDepth: n.floodDepthMeters,
          canopyCoverPct: n.canopyCoverPct,
          exposedPopulation: n.exposedPopulation,
          vulnScore: n.severity === 'CRITICAL' ? 88 : n.severity === 'HIGH' ? 68 : 42
        },
        geometry: {
          type: 'Polygon',
          coordinates: n.coordinates
        }
      }))
    };

    if (!map.getSource('climate-neighborhoods')) {
      map.addSource('climate-neighborhoods', {
        type: 'geojson',
        data: geojsonData
      });
    }

    // 2. Add Fill Extrusion Layer for Climate Wards
    if (!map.getLayer('climate-extrusion')) {
      map.addLayer({
        id: 'climate-extrusion',
        type: 'fill-extrusion',
        source: 'climate-neighborhoods',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': !hazardOverlayEnabled ? 0.05 : mapExperience === 'IR_THERMAL' ? 0.35 : overlayOpacity / 100
        }
      });
    }

    // 3. Add Line Borders Layer
    if (!map.getLayer('climate-borders')) {
      map.addLayer({
        id: 'climate-borders',
        type: 'line',
        source: 'climate-neighborhoods',
        paint: {
          'line-color': mapExperience === 'IR_THERMAL' ? '#f59e0b' : '#38bdf8',
          'line-width': 2.5,
          'line-opacity': 0.9
        }
      });
    }

    // 4. Add 3D Urban Thermal Building Blocks GeoJSON Source (LiDAR 3D scanning)
    const thermalBlocksGeoJSON: FeatureCollection = {
      type: 'FeatureCollection',
      features: URBAN_THERMAL_BLOCKS.map(b => ({
        type: 'Feature',
        properties: {
          id: b.id,
          name: b.name,
          neighborhoodId: b.neighborhoodId,
          buildingType: b.buildingType,
          height: viewMode === '2D' ? 1 : b.heightMeters,
          surfaceTempC: b.surfaceTempC,
          apparentTempC: b.apparentTempC,
          albedo: b.albedo,
          treeCanopyPct: b.treeCanopyPct,
          roofType: b.roofType,
          heatStressCategory: b.heatStressCategory,
          coolingDeficitPct: b.coolingDeficitPct
        },
        geometry: {
          type: 'Polygon',
          coordinates: b.coordinates
        }
      }))
    };

    if (!map.getSource('urban-thermal-blocks')) {
      map.addSource('urban-thermal-blocks', {
        type: 'geojson',
        data: thermalBlocksGeoJSON
      });
    }

    // 5. Add 3D Urban Thermal Blocks Extrusion Layer
    if (!map.getLayer('thermal-blocks-extrusion')) {
      map.addLayer({
        id: 'thermal-blocks-extrusion',
        type: 'fill-extrusion',
        source: 'urban-thermal-blocks',
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'surfaceTempC'],
            34, '#1e1b4b', // Deep violet / indigo (coolest shaded)
            37, '#0284c7', // Cool blue
            39, '#06b6d4', // Cyan
            41, '#10b981', // Emerald green
            44, '#eab308', // Amber / bright yellow
            46, '#f97316', // Fiery orange
            48, '#ef4444', // Burning red
            50, '#be123c'  // Extreme magenta anomaly
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.95
        }
      });
    }

    // 6. Render tactical markers
    renderTacticalMarkers(map);
  }, [overlayOpacity, viewMode, mapExperience, hazardOverlayEnabled, renderTacticalMarkers]);

  // Initialize MapLibre ONCE with map-level delegated click & mousemove handlers
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialBasemap = mapExperience === 'IR_THERMAL' ? 'DARK' : 'DARK';
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getBasemapStyleSpec(initialBasemap),
      center: [77.221, 28.616],
      zoom: 15.6,
      pitch: viewMode === '3D' ? 58 : 0,
      bearing: viewMode === '3D' ? -24 : 0
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    mapRef.current = map;

    // Attach Map-level Delegated Click Handler (Never duplicated across setStyle calls)
    map.on('click', (e) => {
      // Check 3D thermal building block first
      if (map.getLayer('thermal-blocks-extrusion')) {
        const blockFeats = map.queryRenderedFeatures(e.point, { layers: ['thermal-blocks-extrusion'] });
        if (blockFeats && blockFeats.length > 0) {
          const props = blockFeats[0].properties;
          const foundBlock = URBAN_THERMAL_BLOCKS.find(b => b.id === props?.id);
          if (foundBlock) {
            setSelectedBlock(foundBlock);
            const parent = CLIMATE_NEIGHBORHOODS.find(n => n.id === foundBlock.neighborhoodId);
            if (parent) setSelectedNeighborhood(parent);
            map.flyTo({ center: foundBlock.center, zoom: 17.2, pitch: viewMode === '3D' ? 56 : 0, duration: 800 });
            addToast('INFO', `Inspected: ${foundBlock.name} | LST: ${foundBlock.surfaceTempC}°C | ${foundBlock.roofType}`);
            return;
          }
        }
      }

      // Check climate neighborhood zones
      if (map.getLayer('climate-extrusion')) {
        const zoneFeats = map.queryRenderedFeatures(e.point, { layers: ['climate-extrusion'] });
        if (zoneFeats && zoneFeats.length > 0) {
          const featureId = zoneFeats[0].properties?.id;
          const found = CLIMATE_NEIGHBORHOODS.find(n => n.id === featureId);
          if (found) {
            setSelectedNeighborhood(found);
            setSelectedBlock(null);
            map.flyTo({
              center: found.center,
              zoom: 16.2,
              pitch: viewMode === '3D' ? 58 : 0,
              duration: 900
            });
            addToast('INFO', `Selected Sector: ${found.name} (${found.wardNumber})`);
          }
        }
      }
    });

    // Delegated Cursor Pointer
    map.on('mousemove', (e) => {
      const activeLayers = ['thermal-blocks-extrusion', 'climate-extrusion'].filter(l => map.getLayer(l));
      if (activeLayers.length === 0) return;
      const feats = map.queryRenderedFeatures(e.point, { layers: activeLayers });
      map.getCanvas().style.cursor = feats && feats.length > 0 ? 'pointer' : '';
    });

    // Idempotent restoration on initial load
    map.on('load', () => {
      setupMapLayersAndMarkers(map);
    });

    // Idempotent restoration on style changes (Solves Basemap switching bug!)
    map.on('style.load', () => {
      setupMapLayersAndMarkers(map);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      candidateMarkersRef.current.forEach(m => m.remove());
      candidateMarkersRef.current = [];
      map.remove();
    };
  }, []); // Run once on mount

  // Basemap switcher
  const handleBasemapChange = (type: 'SATELLITE' | 'STREETS' | 'DARK') => {
    setBasemap(type);
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(getBasemapStyleSpec(type));
  };

  // Re-render tactical markers when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.isStyleLoaded()) {
      renderTacticalMarkers(map);
    }
  }, [renderTacticalMarkers]);

  // Mode Transition Handler (IR Thermal vs 3D GIS vs 2D Flat)
  const handleExperienceModeChange = (mode: '3D_GIS' | 'IR_THERMAL' | '2D_FLAT') => {
    setMapExperience(mode);
    const map = mapRef.current;
    if (!map) return;

    if (mode === 'IR_THERMAL') {
      setViewMode('3D');
      setActiveHazardType('HEAT');
      setHazardOverlayEnabled(true);
      setBasemap('DARK');
      map.setStyle(getBasemapStyleSpec('DARK'));
      map.easeTo({ pitch: 56, bearing: -20, duration: 900 });
      addToast('INFO', 'Activated IR Sensor / Thermal Heat Risk GIS Mode. Satellite Radiometric LST Telemetry active.');
    } else if (mode === '3D_GIS') {
      setViewMode('3D');
      map.easeTo({ pitch: 58, bearing: -24, duration: 900 });
      addToast('INFO', 'Switched to 3D Climate Hazard GIS View.');
    } else {
      setViewMode('2D');
      map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
      addToast('INFO', 'Switched to 2D Orthographic Map.');
    }
  };

  // Candidate site preview markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    candidateMarkersRef.current.forEach(m => m.remove());
    candidateMarkersRef.current = [];

    if (activeCandidateSites.length === 0) return;

    activeCandidateSites.forEach(site => {
      const el = document.createElement('div');
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor =
        site.type === 'COOL_ROOFS' ? '#f59e0b' :
        site.type === 'TREE_CANOPY' ? '#10b981' :
        site.type === 'WATER_KIOSKS' ? '#38bdf8' :
        site.type === 'RAINWATER_HARVESTING' ? '#06b6d4' : '#0284c7';
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = '0 0 15px rgba(56, 189, 248, 0.9)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#fff';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      el.innerText = '★';
      el.title = `${site.name} (₹${(site.estimatedCostINR / 100000).toFixed(1)}L)`;

      el.addEventListener('click', () => {
        map.flyTo({ center: site.coordinates, zoom: 17.2, pitch: 58, duration: 800 });
        addToast('INFO', `Candidate Site: ${site.name} — ${site.capacityOrUnits} (${site.projectedBenefit})`);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(site.coordinates)
        .addTo(map);

      candidateMarkersRef.current.push(marker);
    });

    if (activeCandidateSites[0]) {
      map.flyTo({ center: activeCandidateSites[0].coordinates, zoom: 16.5, pitch: 58, duration: 900 });
    }
  }, [activeCandidateSites, addToast]);

  // Thermal sub-metric styling updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('thermal-blocks-extrusion')) return;

    try {
      if (thermalSubMetric === 'LST') {
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'surfaceTempC'],
          34, '#1e1b4b',
          37, '#0284c7',
          39, '#06b6d4',
          41, '#10b981',
          44, '#eab308',
          46, '#f97316',
          48, '#ef4444',
          50, '#be123c'
        ]);
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : ['get', 'height']);
      } else if (thermalSubMetric === 'HEAT_INDEX') {
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'apparentTempC'],
          36, '#38bdf8',
          40, '#f59e0b',
          45, '#ea580c',
          48, '#be123c'
        ]);
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : ['*', ['get', 'apparentTempC'], 1.2]);
      } else if (thermalSubMetric === 'RADIATIVE_TRAP') {
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-color', [
          'case',
          ['<', ['get', 'albedo'], 0.18], '#be123c', // Low albedo = high heat trap
          ['<', ['get', 'albedo'], 0.35], '#f97316',
          '#10b981' // High albedo = cool
        ]);
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : 38);
      } else if (thermalSubMetric === 'CANOPY_GAP') {
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'coolingDeficitPct'],
          10, '#10b981',
          40, '#eab308',
          70, '#ea580c',
          85, '#be123c'
        ]);
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : 30);
      } else if (thermalSubMetric === 'EXPOSED_POP') {
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'apparentTempC'],
          36, '#a855f7',
          42, '#7c3aed',
          48, '#4c1d95'
        ]);
        map.setPaintProperty('thermal-blocks-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : 40);
      }
    } catch {}
  }, [thermalSubMetric, viewMode]);

  // Update map extrusion style based on activeHazardType / activeTab / hazardOverlayEnabled
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('climate-extrusion')) return;

    try {
      // Visibility / Opacity
      const currentOpacity = !hazardOverlayEnabled ? 0.05 : mapExperience === 'IR_THERMAL' ? 0.35 : overlayOpacity / 100;
      map.setPaintProperty('climate-extrusion', 'fill-extrusion-opacity', currentOpacity);

      const effectiveHazard = mapExperience === 'IR_THERMAL' ? 'HEAT' : activeHazardType;

      if (effectiveHazard === 'HEAT') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'temp'],
          38, '#1e1b4b',
          40, '#06b6d4',
          42, '#10b981',
          44, '#eab308',
          46, '#f97316',
          48, '#ef4444'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : ['*', ['get', 'temp'], 1.6]);
      } else if (effectiveHazard === 'FLOOD') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'floodDepth'],
          0, '#06b6d4',
          0.3, '#0284c7',
          1.0, '#1d4ed8',
          1.8, '#1e3a8a'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : ['+', 15, ['*', ['get', 'floodDepth'], 40]]);
      } else if (effectiveHazard === 'CANOPY') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'case',
          ['<', ['get', 'canopyCoverPct'], 5], '#78350f',
          ['<', ['get', 'canopyCoverPct'], 12], '#eab308',
          '#10b981'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : 35);
      } else if (effectiveHazard === 'POPULATION') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'exposedPopulation'],
          5000, '#a855f7',
          15000, '#7c3aed',
          30000, '#4c1d95'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : ['/', ['get', 'exposedPopulation'], 250]);
      } else if (effectiveHazard === 'VULNERABILITY') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'vulnScore'],
          40, '#10b981',
          65, '#f59e0b',
          85, '#ef4444'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', viewMode === '2D' ? 1 : ['get', 'height']);
      }
    } catch {}
  }, [activeHazardType, hazardOverlayEnabled, mapExperience, overlayOpacity, viewMode]);

  // Synchronize GeoJSON layer filter with search, severity & selected histogram tier
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('climate-extrusion')) return;

    const filterExpr: any = ['all'];

    if (severityFilter !== 'ALL') {
      filterExpr.push(['==', ['get', 'severity'], severityFilter]);
    }
    if (!showHeatRisk) {
      filterExpr.push(['!=', ['get', 'primaryHazard'], 'URBAN_HEAT']);
    }
    if (!showFloodRisk) {
      filterExpr.push(['!=', ['get', 'primaryHazard'], 'FLOOD_SURGE']);
    }
    if (searchQuery.trim() || selectedRiskTier !== 'ALL') {
      const matchedIds = filteredNeighborhoods.map(n => n.id);
      filterExpr.push(['in', ['get', 'id'], ['literal', matchedIds]]);
    }

    try {
      map.setFilter('climate-extrusion', filterExpr.length > 1 ? filterExpr : null);
      if (map.getLayer('climate-borders')) {
        map.setFilter('climate-borders', filterExpr.length > 1 ? filterExpr : null);
      }
    } catch {}
  }, [severityFilter, showHeatRisk, showFloodRisk, searchQuery, selectedRiskTier, filteredNeighborhoods]);

  // Primary Action 1 Handler: Submit verified relief request
  const handleSubmitNeed = (need: any) => {
    if (!selectedNeighborhood) return;
    addManualRequest({
      zoneName: selectedNeighborhood.name,
      coordinates: { lat: selectedNeighborhood.center[1], lng: selectedNeighborhood.center[0] },
      itemNeeded: need.itemNeeded,
      category: need.category,
      quantity: need.quantity,
      unit: need.unit,
      priority: need.urgency,
      affectedCount: Math.round(selectedNeighborhood.exposedPopulation * 0.15)
    });
    addAuditLog({
      actor: 'Command Center Operator',
      action: 'DEMAND_LOGGED',
      target: selectedNeighborhood.name,
      result: `Created urgent relief demand: ${need.quantity} ${need.unit} of ${need.itemNeeded}`,
      type: 'PRIORITIZE'
    });
    addToast('SUCCESS', `Created relief demand for ${selectedNeighborhood.name}: ${need.quantity} ${need.unit} (${need.urgency} Priority). Logged to live SAKSHAM dispatch.`);
  };

  // Primary Action 3 Handler: Plan created & dispatched
  const handlePlanCreated = (plan: any) => {
    addAuditLog({
      actor: 'Incident Commander',
      action: 'RESPONSE_PLAN_DISPATCHED',
      target: plan.neighborhoodName,
      result: `Authorized response plan ${plan.planReference}. Assigned: ${plan.assignedUnits.join(', ')}`,
      type: 'DISPATCH'
    });
    addToast('SUCCESS', `Authorized & Dispatched Response Plan ${plan.planReference} for ${plan.neighborhoodName}! Units alerted.`);
  };

  // Save intervention scenario handler
  const handleSaveScenario = (scenario: SavedScenario) => {
    setSavedScenarios(prev => [scenario, ...prev]);
    addToast('SUCCESS', `Saved Scenario: ${scenario.interventionType.replace('_', ' ')} for ${scenario.neighborhoodName}! (-${scenario.surfaceTempDeltaC}°C projected)`);
  };

  const riskRankDisplay = currentAssessment ? (currentAssessment.compositeScore / 10).toFixed(1) : '7.9';

  return (
    <div className={styles.spatialWrapper}>
      {/* ── TOP SAKSHAM COMMAND HEADER ── */}
      <header className={styles.topHudBar}>
        {/* Left Section: Breadcrumb & Opacity */}
        <div className={styles.hudLeft}>
          <div className={styles.titleBadge}>
            <ShieldAlert size={15} className={styles.badgeIcon} />
            <div>
              <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 700 }}>
                SAKSHAM / OPERATIONS
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
                Spatial Intelligence & 3D Climate GIS
              </div>
            </div>
          </div>

          <div className={styles.opacityControl}>
            <div className={styles.opacityLabel}>
              <span>GIS OPACITY</span>
              <strong>{overlayOpacity}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className={styles.rangeSlider}
            />
          </div>
        </div>

        {/* Center Section: Search, Scope & Basemap */}
        <div className={styles.hudCenter}>
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search ward, hazard, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Operational City Selector */}
          <div className={styles.pillDropdown} title="Delhi NCT is the verified operational grid with mapped polygon boundaries">
            <MapPin size={13} className={styles.dropdownIcon} />
            <span>Delhi NCT (Operational Grid)</span>
            <span className={styles.pillStatus}>ACTIVE</span>
          </div>

          {/* Severity Filter */}
          <button
            className={styles.pillDropdown}
            onClick={() => {
              const modes: ('ALL' | 'CRITICAL' | 'HIGH' | 'MODERATE')[] = ['ALL', 'CRITICAL', 'HIGH', 'MODERATE'];
              const nextIdx = (modes.indexOf(severityFilter) + 1) % modes.length;
              setSeverityFilter(modes[nextIdx]);
            }}
          >
            <span>SEVERITY: {severityFilter}</span>
            <ChevronDown size={13} />
          </button>

          {/* Basemap Selector */}
          <button
            className={`${styles.pillButton} ${basemap === 'DARK' ? styles.pillActive : ''}`}
            onClick={() => handleBasemapChange(basemap === 'DARK' ? 'SATELLITE' : basemap === 'SATELLITE' ? 'STREETS' : 'DARK')}
            title="Toggle between Tactical Dark, Satellite 3D, and Streets"
          >
            <Layers size={13} />
            <span>{basemap === 'DARK' ? 'Dark Tactical' : basemap === 'SATELLITE' ? 'Satellite 3D' : 'Streets'}</span>
          </button>

          {/* Layer Controls Dropdown Button */}
          <button
            className={`${styles.pillButton} ${isLayersOpen ? styles.pillActive : ''}`}
            onClick={() => setIsLayersOpen(!isLayersOpen)}
          >
            <Layers size={13} />
            <span>Layers (10 GIS)</span>
            <ChevronDown size={13} />
          </button>
        </div>

        {/* Right Section: Mode Selector (2D Flat, 3D GIS, Heat Risk) */}
        <div className={styles.hudRight}>
          <div className={styles.viewModeToggle}>
            <button
              className={`${styles.modeBtn} ${mapExperience === '2D_FLAT' ? styles.modeBtnActive : ''}`}
              onClick={() => handleExperienceModeChange('2D_FLAT')}
            >
              2D Flat
            </button>
            <button
              className={`${styles.modeBtn} ${mapExperience === '3D_GIS' ? styles.modeBtnActive : ''}`}
              onClick={() => handleExperienceModeChange('3D_GIS')}
            >
              3D GIS
            </button>
            <button
              className={`${styles.modeBtn} ${mapExperience === 'IR_THERMAL' ? styles.modeBtnActiveThermal : ''}`}
              onClick={() => handleExperienceModeChange('IR_THERMAL')}
            >
              <Flame size={12} className={styles.thermalFlameIcon} />
              Heat Risk (IR Sensor)
            </button>
          </div>
        </div>
      </header>

      {/* ── TOP OPERATIONAL SUMMARY METRICS ROW ── */}
      <div className={styles.topMetricsRow}>
        <div
          className={`${styles.topMetricCard} ${mapExperience === 'IR_THERMAL' ? styles.topMetricCardActive : ''}`}
          onClick={() => handleExperienceModeChange('IR_THERMAL')}
          style={{ cursor: 'pointer' }}
          title="Click to launch IR Sensor / Thermal Heat Risk Map"
        >
          <div className={styles.topMetricHeader}>
            <Flame size={14} className={styles.textWarning} />
            <span>Heat Risk (IR Sensor Mode)</span>
          </div>
          <strong className={styles.topMetricValue}>{criticalCount} Critical Wards</strong>
          <span className={styles.topMetricSub}>Max Heat Index: 48.6°C • Radiometric LST Telemetry</span>
        </div>

        <div
          className={`${styles.topMetricCard} ${mapExperience === '3D_GIS' && activeHazardType === 'FLOOD' ? styles.topMetricCardActive : ''}`}
          onClick={() => {
            handleExperienceModeChange('3D_GIS');
            setActiveHazardType('FLOOD');
          }}
          style={{ cursor: 'pointer' }}
          title="Click to focus on 3D Flood Inundation GIS"
        >
          <div className={styles.topMetricHeader}>
            <Waves size={14} className={styles.textInfo} />
            <span>Flood Risk (3D Inundation)</span>
          </div>
          <strong className={styles.topMetricValue}>{floodCount} Inundated Wards</strong>
          <span className={styles.topMetricSub}>Yamuna: 205.85m (Warning: 205.33m)</span>
        </div>

        <div className={styles.topMetricCard}>
          <div className={styles.topMetricHeader}>
            <Users size={14} className={styles.textSuccess} />
            <span>Exposed Population</span>
          </div>
          <strong className={styles.topMetricValue}>{totalExposed.toLocaleString()} Total</strong>
          <span className={styles.topMetricSub}>High-density informal settlement clusters</span>
        </div>

        <div className={styles.topMetricCard}>
          <div className={styles.topMetricHeader}>
            <AlertTriangle size={14} className={styles.textDanger} />
            <span>Authoritative Alerts</span>
          </div>
          <strong className={styles.topMetricValue}>2 Active Advisories</strong>
          <span className={styles.topMetricSub}>IMD Orange Heatwave & CWC Yamuna Flood</span>
        </div>
      </div>

      {/* ── 10-LAYER CONTROLS FLYOUT POPOVER ── */}
      {isLayersOpen && (
        <div className={styles.layerPopover}>
          <div className={styles.layerPopoverHeader}>
            <h5><Layers size={13} /> INDEPENDENT GIS LAYERS</h5>
            <button onClick={() => setIsLayersOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
          <div className={styles.layerList}>
            <div className={styles.layerRow} onClick={() => setShowHeatRisk(!showHeatRisk)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#f59e0b' }} /> 1. Heat-stress risk</span>
              <input type="checkbox" checked={showHeatRisk} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowFloodRisk(!showFloodRisk)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#0284c7' }} /> 2. Flood & rainfall risk</span>
              <input type="checkbox" checked={showFloodRisk} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowVulnerability(!showVulnerability)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#ef4444' }} /> 3. Vulnerability index</span>
              <input type="checkbox" checked={showVulnerability} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowPopulation(!showPopulation)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#a855f7' }} /> 4. Exposed population</span>
              <input type="checkbox" checked={showPopulation} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowCanopy(!showCanopy)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#10b981' }} /> 5. Tree canopy deficit</span>
              <input type="checkbox" checked={showCanopy} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowShelters(!showShelters)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#38bdf8' }} /> 6. Emergency shelters</span>
              <input type="checkbox" checked={showShelters} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowWaterPoints(!showWaterPoints)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#06b6d4' }} /> 7. Drinking-water points</span>
              <input type="checkbox" checked={showWaterPoints} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowHealthcare(!showHealthcare)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#dc2626' }} /> 8. Healthcare facilities</span>
              <input type="checkbox" checked={showHealthcare} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowDepots(!showDepots)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#fbbf24' }} /> 9. Relief depots & stock</span>
              <input type="checkbox" checked={showDepots} readOnly className={styles.layerCheckbox} />
            </div>
            <div className={styles.layerRow} onClick={() => setShowIncidents(!showIncidents)}>
              <span className={styles.layerLabel}><span className={styles.layerDot} style={{ background: '#ef4444' }} /> 10. Active incidents</span>
              <input type="checkbox" checked={showIncidents} readOnly className={styles.layerCheckbox} />
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN MAP & OPERATOR DASHBOARD VIEWPORT ── */}
      <div className={styles.mapViewport}>
        {/* Map Container */}
        <div ref={mapContainerRef} className={styles.mapCanvas} />

        {/* ── FLOATING HAZARD OVERLAY WIDGET (REFERENCE IMAGE 2) ── */}
        <div className={styles.floatingHazardOverlay}>
          <div className={styles.floatingHazardHeader}>
            <span className={styles.floatingHazardTitle}>HAZARD OVERLAY</span>
            <label className={styles.switchToggle} title="Toggle hazard overlay visibility">
              <input
                type="checkbox"
                checked={hazardOverlayEnabled}
                onChange={(e) => setHazardOverlayEnabled(e.target.checked)}
              />
              <span className={styles.switchSlider} />
            </label>
          </div>

          <div className={styles.floatingHazardBody}>
            {/* Dropdown Hazard Selector */}
            <select
              value={activeHazardType}
              onChange={(e) => setActiveHazardType(e.target.value as any)}
              className={styles.hazardSelectDropdown}
            >
              <option value="FLOOD">🌊 Flood Risk</option>
              <option value="HEAT">🌡️ Urban Heat</option>
              <option value="VULNERABILITY">👥 Vulnerability Index</option>
              <option value="CANOPY">🌳 Canopy Deficit</option>
              <option value="POPULATION">🏘️ Exposed Population</option>
            </select>

            {/* Discrete 0-10 Severity Legend (Reference Image 2) */}
            <div className={styles.discreteScaleList}>
              <div className={styles.discreteScaleRow}>
                <span className={styles.discreteSwatch} style={{ background: '#be123c' }} />
                <span>8–10 (Critical Exposure)</span>
              </div>
              <div className={styles.discreteScaleRow}>
                <span className={styles.discreteSwatch} style={{ background: '#f97316' }} />
                <span>6–8 (High Hazard)</span>
              </div>
              <div className={styles.discreteScaleRow}>
                <span className={styles.discreteSwatch} style={{ background: '#eab308' }} />
                <span>4–6 (Moderate Buffer)</span>
              </div>
              <div className={styles.discreteScaleRow}>
                <span className={styles.discreteSwatch} style={{ background: '#06b6d4' }} />
                <span>2–4 (Low Risk)</span>
              </div>
              <div className={styles.discreteScaleRow}>
                <span className={styles.discreteSwatch} style={{ background: '#0284c7' }} />
                <span>0–2 (Minimal / Resilient)</span>
              </div>
              <div className={styles.discreteScaleRow}>
                <span className={styles.discreteSwatch} style={{ background: '#334155' }} />
                <span>No Data</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── DEDICATED IR SENSOR TELEMETRY HUD BANNER (REFERENCE IMAGE 1) ── */}
        {mapExperience === 'IR_THERMAL' && (
          <div className={styles.thermalHudBanner}>
            <div className={styles.thermalTelemetryLeft}>
              <div className={styles.thermalSensorLed} />
              <div className={styles.thermalSensorTitle}>
                <strong>TIR SENSOR STREAM: 10.8µm - 12.0µm</strong>
                <span>Radiometric Land Surface Temperature (LST) Calibration Active</span>
              </div>
            </div>

            {/* Thermal Palette Scale */}
            <div className={styles.thermalScaleWrapper}>
              <div className={styles.thermalScaleBar} />
              <div className={styles.thermalScaleLabels}>
                <span>34°C (Cool)</span>
                <span>38°C</span>
                <span>42°C</span>
                <span>46°C</span>
                <span>50°C (Extreme)</span>
              </div>
            </div>

            {/* Thermal Sub-Metric Toggles */}
            <div className={styles.thermalSubSelectGroup}>
              {(['LST', 'HEAT_INDEX', 'RADIATIVE_TRAP', 'CANOPY_GAP', 'EXPOSED_POP'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setThermalSubMetric(m)}
                  className={`${styles.thermalSubBtn} ${thermalSubMetric === m ? styles.thermalSubBtnActive : ''}`}
                >
                  {m === 'LST' ? 'LST Surface' : m === 'HEAT_INDEX' ? 'Heat Index' : m === 'RADIATIVE_TRAP' ? 'Tin Roof Trap' : m === 'CANOPY_GAP' ? 'Canopy Gap' : 'Exposed Pop'}
                </button>
              ))}
            </div>

            {/* Exit Button */}
            <button
              className={styles.thermalExitBtn}
              onClick={() => handleExperienceModeChange('3D_GIS')}
            >
              <X size={12} />
              Exit IR Thermal
            </button>
          </div>
        )}

        {/* Reticle Overlay when in Thermal Mode */}
        {mapExperience === 'IR_THERMAL' && (
          <div className={styles.thermalCrosshairReticle}>
            <svg width="90" height="90" viewBox="0 0 100 100" fill="none" stroke="#ef4444" strokeWidth="1.5">
              <circle cx="50" cy="50" r="30" strokeDasharray="3 3" opacity="0.7" />
              <circle cx="50" cy="50" r="3" fill="#ef4444" />
              <line x1="50" y1="10" x2="50" y2="35" />
              <line x1="50" y1="65" x2="50" y2="90" />
              <line x1="10" y1="50" x2="35" y2="50" />
              <line x1="65" y1="50" x2="90" y2="50" />
            </svg>
          </div>
        )}

        {/* ── LEFT FLOATING DASHBOARD (REFERENCE IMAGE 2 LAYOUT) ── */}
        <aside className={styles.leftDashboard}>
          {/* Header */}
          <div className={styles.dashHeader}>
            <div className={styles.dashTitleRow}>
              <div>
                <h3 style={{ fontSize: '12.5px', fontWeight: 900, color: '#fff', letterSpacing: '0.04em' }}>
                  SAKSHAM FULCRUM GIS
                </h3>
                <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                  Spatial Intelligence & Hazard Analytics
                </span>
              </div>
              <span className={styles.auditBadge}>{filteredNeighborhoods.length} Monitored Wards</span>
            </div>

            {/* Authoritative Live Alert Banner */}
            <div className={styles.forecastBox}>
              <div className={styles.forecastRow}>
                <span>IMD Heatwave Advisory:</span>
                <strong className={styles.textDanger}>Severe Heatwave (Orange Alert)</strong>
              </div>
              <div className={styles.forecastRow}>
                <span>Live Open-Meteo Heat Index:</span>
                <strong className={styles.textDanger}>{weather?.apparentTemperature ?? 46.2}°C</strong>
              </div>
              <div className={styles.forecastRow}>
                <span>Yamuna River Level:</span>
                <strong className={styles.textWarning}>205.85m (Warning: 205.33m)</strong>
              </div>
              <div className={styles.forecastRow}>
                <span>Rain Forecast:</span>
                <strong className={styles.textInfo}>{weather?.rainProbability ?? 65}% Probability</strong>
              </div>
            </div>
          </div>

          {/* Histogram: Exposure per Elevation / Risk Tier (Reference Image 2) */}
          <div className={styles.histogramBox}>
            <div className={styles.histogramTitleRow}>
              <span className={styles.histogramTitle}>Property & Exposure per Tier</span>
              {selectedRiskTier !== 'ALL' && (
                <button
                  onClick={() => setSelectedRiskTier('ALL')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Reset Filter
                </button>
              )}
            </div>

            {/* 5-bar histogram corresponding to 0.8, 4.3, 7.7, 11.1, 14.5, 17.9 ft elevation / risk tiers */}
            <div className={styles.histogramBarsGrid}>
              {[
                { tier: '0-2' as const, val: 193, label: '0–2' },
                { tier: '2-4' as const, val: 118, label: '2–4' },
                { tier: '4-6' as const, val: 53, label: '4–6' },
                { tier: '6-8' as const, val: 141, label: '6–8' },
                { tier: '8-10' as const, val: 128, label: '8–10' }
              ].map(bar => {
                const isSelected = selectedRiskTier === bar.tier;
                const heightPct = Math.round((bar.val / 200) * 100);
                return (
                  <div
                    key={bar.tier}
                    className={styles.histogramCol}
                    onClick={() => setSelectedRiskTier(isSelected ? 'ALL' : bar.tier)}
                    title={`Risk Tier ${bar.label}: ${bar.val} properties. Click to filter.`}
                  >
                    <span className={styles.histogramColVal} style={{ color: isSelected ? '#38bdf8' : '#fff' }}>
                      {bar.val}
                    </span>
                    <div
                      className={styles.histogramBarFill}
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: isSelected ? '#38bdf8' : '#10b981'
                      }}
                    />
                    <span className={styles.histogramColLabel} style={{ color: isSelected ? '#38bdf8' : '#64748b' }}>
                      {bar.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Climate Guidance Box (Reference Image 2) */}
          <div className={styles.aiGuidanceBox}>
            <p className={styles.aiGuidanceText}>
              I added the National Climate Hazard Layer to the map. You can now:
            </p>
            <ul className={styles.aiBulletList}>
              <li>Filter properties by flood inundation & thermal trap</li>
              <li>Identify high-risk informal settlements</li>
              <li>Correlate flood zones with elevation & drainage</li>
            </ul>

            {/* Quick Action Chips */}
            <button
              className={styles.aiQueryChip}
              onClick={() => {
                const found = CLIMATE_NEIGHBORHOODS.find(n => n.primaryHazard === 'FLOOD_SURGE');
                if (found) {
                  setSelectedNeighborhood(found);
                  setSelectedBlock(null);
                  if (mapRef.current) {
                    mapRef.current.flyTo({ center: found.center, zoom: 16.5, pitch: 58, duration: 900 });
                  }
                  addToast('INFO', 'Focusing on Yamuna Flood Surge zone (14,200 exposed residents).');
                }
              }}
            >
              <span>How many properties are at risk of flood surge?</span>
              <Navigation size={11} />
            </button>

            <button
              className={styles.aiQueryChip}
              onClick={() => {
                const found = CLIMATE_NEIGHBORHOODS.find(n => n.id === 'ZONE-DL-002');
                if (found) {
                  setSelectedNeighborhood(found);
                  setSelectedBlock(URBAN_THERMAL_BLOCKS[0]);
                  handleExperienceModeChange('IR_THERMAL');
                  if (mapRef.current) {
                    mapRef.current.flyTo({ center: found.center, zoom: 17.2, pitch: 56, duration: 900 });
                  }
                  addToast('INFO', 'Focusing on Seelampur extreme thermal radiant trap (48.6°C LST).');
                }
              }}
            >
              <span>Analyze extreme urban heat radiative trap...</span>
              <Flame size={11} />
            </button>
          </div>

          {/* Monitored Zones List */}
          <div className={styles.dashSection}>
            <div className={styles.sectionHeading}>
              <span>MONITORED CLIMATE SECTORS ({filteredNeighborhoods.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {filteredNeighborhoods.map(zone => (
                <div
                  key={zone.id}
                  onClick={() => {
                    setSelectedNeighborhood(zone);
                    setSelectedBlock(null);
                    if (mapRef.current) {
                      mapRef.current.flyTo({ center: zone.center, zoom: 16.2, pitch: viewMode === '3D' ? 58 : 0, duration: 900 });
                    }
                  }}
                  style={{
                    background: selectedNeighborhood?.id === zone.id ? 'rgba(56, 189, 248, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                    border: selectedNeighborhood?.id === zone.id ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>{zone.name}</div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>{zone.wardNumber} • {zone.primaryHazard.replace('_', ' ')}</div>
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '2px 5px',
                    borderRadius: '4px',
                    background: zone.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    color: zone.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b'
                  }}>
                    {zone.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── RIGHT CONTEXTUAL INSPECTION PANEL (REFERENCE IMAGE 2 LAYOUT) ── */}
        <aside className={styles.rightInspector}>
          <div className={styles.inspectorCard}>
            {/* Top Navigation Row (Back Button, Title, Subtitle, RiskRank Badge) */}
            <div className={styles.inspectorTopNav}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className={styles.backBtn}
                  onClick={() => {
                    setSelectedBlock(null);
                    if (mapRef.current) {
                      mapRef.current.flyTo({ center: [77.221, 28.616], zoom: 15.6, pitch: viewMode === '3D' ? 58 : 0, duration: 900 });
                    }
                  }}
                  title="Return to sector overview"
                >
                  <ArrowLeft size={14} />
                </button>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#ffffff' }}>
                    {selectedBlock ? selectedBlock.name : selectedNeighborhood ? selectedNeighborhood.name : 'Sector Overview'}
                  </h4>
                  <p style={{ margin: '1px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>
                    {selectedNeighborhood ? `${selectedNeighborhood.wardNumber}, East Delhi NCT` : 'Select a feature on the map'}
                  </p>
                </div>
              </div>

              {/* Dynamic RiskRank Badge (Reference Image 2) */}
              <div className={styles.riskRankBadge}>
                <ShieldAlert size={12} />
                <span>RiskRank {riskRankDisplay}</span>
              </div>
            </div>

            {/* Segmented Control Tabs (Risk report vs Property details - Reference Image 2) */}
            <div className={styles.segmentedTabGroup}>
              <button
                className={`${styles.segmentedTab} ${inspectorTab === 'RISK_REPORT' ? styles.segmentedTabActive : ''}`}
                onClick={() => setInspectorTab('RISK_REPORT')}
              >
                Risk report
              </button>
              <button
                className={`${styles.segmentedTab} ${inspectorTab === 'ZONE_DETAILS' ? styles.segmentedTabActive : ''}`}
                onClick={() => setInspectorTab('ZONE_DETAILS')}
              >
                Property details
              </button>
            </div>

            {selectedNeighborhood && currentAssessment ? (
              <div className={styles.parcelDetails}>
                {inspectorTab === 'RISK_REPORT' ? (
                  <>
                    {/* EXPOSURE OVERVIEW Narrative (Reference Image 2) */}
                    <div className={styles.exposureOverviewCard}>
                      <span className={styles.exposureOverviewHeader}>EXPOSURE OVERVIEW</span>
                      <p className={styles.exposureOverviewText}>
                        With a composite risk rank of <strong>{riskRankDisplay}</strong>, {selectedNeighborhood.name} faces
                        significant exposure to {selectedNeighborhood.primaryHazard === 'URBAN_HEAT' ? 'urban heat island radiation and tin-roof thermal trapping' : 'riverbed surge inundation and stormwater stagnation'}.
                        High density and limited tree canopy amplify daytime vulnerability. High exposure warrants reviewing current cooling-centre bed buffers, water supply coverage, and dispatching pre-positioned resources under SAKSHAM dispatch protocols.
                      </p>
                    </div>

                    {/* Hazard Score Rows (Flood 8.2, Hurricane 7.9 style) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className={styles.hazardScoreRow}>
                        <span className={styles.hazardScoreLabel}>
                          <Waves size={13} color="#38bdf8" />
                          <span>Flood Inundation</span>
                        </span>
                        <span className={styles.hazardScoreValue} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          {selectedNeighborhood.floodDepthMeters > 1.0 ? '8.2' : selectedNeighborhood.floodDepthMeters > 0.3 ? '6.5' : '2.1'}
                        </span>
                      </div>

                      <div className={styles.hazardScoreRow}>
                        <span className={styles.hazardScoreLabel}>
                          <Flame size={13} color="#ef4444" />
                          <span>Heatwave Stress</span>
                        </span>
                        <span className={styles.hazardScoreValue} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                          {selectedNeighborhood.apparentTempC > 46 ? '9.1' : selectedNeighborhood.apparentTempC > 43 ? '7.9' : '4.5'}
                        </span>
                      </div>

                      <div className={styles.hazardScoreRow}>
                        <span className={styles.hazardScoreLabel}>
                          <Users size={13} color="#a855f7" />
                          <span>Demographic Vulnerability</span>
                        </span>
                        <span className={styles.hazardScoreValue} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                          {(selectedNeighborhood.demographicSensitivityPct / 10).toFixed(1)}
                        </span>
                      </div>

                      <div className={styles.hazardScoreRow}>
                        <span className={styles.hazardScoreLabel}>
                          <Trees size={13} color="#10b981" />
                          <span>Tree Canopy Gap</span>
                        </span>
                        <span className={styles.hazardScoreValue} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                          {((25 - selectedNeighborhood.canopyCoverPct) / 2.5).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Sector Capacity & Stockpile Breakdown (Reference Image 2) */}
                    <div className={styles.exposureOverviewCard}>
                      <span className={styles.exposureOverviewHeader}>SECTOR RESOURCE BREAKDOWN</span>
                      <div className={styles.capacityBreakdownBox}>
                        <div className={styles.capacityRow}>
                          <span className={styles.capacityLabel}>Shelter Capacity:</span>
                          <strong className={styles.capacityVal}>{selectedNeighborhood.shelterBedsAvailable} Beds Available</strong>
                        </div>
                        <div className={styles.capacityRow}>
                          <span className={styles.capacityLabel}>Drinking Water ATMs:</span>
                          <strong className={styles.capacityVal}>{selectedNeighborhood.waterPointsCount} Active Kiosks</strong>
                        </div>
                        <div className={styles.capacityRow}>
                          <span className={styles.capacityLabel}>Exposed Residents:</span>
                          <strong className={styles.capacityVal}>{selectedNeighborhood.exposedPopulation.toLocaleString()}</strong>
                        </div>
                        <div className={styles.capacityRow}>
                          <span className={styles.capacityLabel}>Open Demands:</span>
                          <strong className={styles.capacityVal} style={{ color: '#f59e0b' }}>{selectedNeighborhood.openRequestsCount} Requests Logged</strong>
                        </div>
                      </div>
                    </div>

                    {/* Large Green FULL REPORT Button (Reference Image 2) */}
                    <button
                      className={styles.fullReportBtn}
                      onClick={() => setIsFullReportOpen(true)}
                      title="Open complete multi-hazard risk assessment and operational report"
                    >
                      <Maximize2 size={13} />
                      Full report
                    </button>
                  </>
                ) : (
                  <>
                    {/* Property / Zone Details Tab */}
                    {selectedBlock ? (
                      <>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Structure:</span>
                          <span className={styles.infoVal}>{selectedBlock.name} ({selectedBlock.heightMeters}m height)</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Radiometric LST:</span>
                          <strong className={styles.infoVal} style={{ color: '#ef4444', fontSize: '13px' }}>
                            {selectedBlock.surfaceTempC}°C (Physical Skin Radiance)
                          </strong>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Roof Thermal Mass:</span>
                          <span className={styles.infoVal}>{selectedBlock.roofType}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Solar Albedo:</span>
                          <span className={styles.infoVal}>{selectedBlock.albedo} (Reflectance)</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Ambient Dry Bulb:</span>
                          <span className={styles.infoVal}>{selectedNeighborhood.ambientTempC}°C (Air Temp)</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Apparent Heat Stress:</span>
                          <span className={styles.infoVal}>{selectedNeighborhood.apparentTempC}°C</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Microclimate Shade Gap:</span>
                          <span className={styles.infoVal}>{selectedBlock.coolingDeficitPct}% Deficit</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Ward Code:</span>
                          <span className={styles.infoVal}>{selectedNeighborhood.code}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Morphology:</span>
                          <span className={styles.infoVal}>{selectedNeighborhood.zone}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Dominant Hazard:</span>
                          <span className={`${styles.infoVal} ${styles.textDanger}`}>{selectedNeighborhood.primaryHazard.replace('_', ' ')}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Tree Canopy Cover:</span>
                          <span className={styles.infoVal}>{selectedNeighborhood.canopyCoverPct}%</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Assigned Unit:</span>
                          <span className={styles.infoVal} style={{ fontSize: '10px' }}>{selectedNeighborhood.assignedTeam}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Data Source:</span>
                          <span className={styles.infoVal} style={{ fontSize: '10px' }}>{selectedNeighborhood.dataSource}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Verification:</span>
                          <span className={styles.infoVal} style={{ color: '#10b981' }}>{selectedNeighborhood.lastUpdated}</span>
                        </div>
                      </>
                    )}

                    {/* Compounding Vulnerability Drivers */}
                    <div className={styles.vulnerabilityFactorsBox}>
                      <strong>Compounding Vulnerability Drivers:</strong>
                      <ul className={styles.factorsList}>
                        {selectedNeighborhood.vulnerabilityFactors.map((vf, i) => (
                          <li key={i}>{vf}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* ── THREE PRIMARY SAKSHAM OPERATIONAL RELIEF ACTIONS ── */}
                <div className={styles.actionButtons}>
                  {/* Action 1: Create Relief Request */}
                  <button
                    className={styles.actionCreateRequest}
                    onClick={() => setIsNeedModalOpen(true)}
                    title="Log an emergency relief request for this zone into SAKSHAM dispatch"
                  >
                    <Droplets size={14} />
                    1. Create Relief Request
                  </button>

                  {/* Action 2: Find Nearby Resources */}
                  <button
                    className={styles.actionFindResources}
                    onClick={() => setIsNearbyDrawerOpen(true)}
                    title="Find closest shelters, water kiosks, depots and hospitals"
                  >
                    <Navigation size={14} />
                    2. Find Nearby Resources
                  </button>

                  {/* Action 3: Create Response Plan */}
                  <button
                    className={styles.actionResponsePlan}
                    onClick={() => setIsResponsePlanOpen(true)}
                    title="Coordinate multi-agency dispatch, inventory matching and evacuation route check"
                  >
                    <FileText size={14} />
                    3. Create Response Plan
                  </button>

                  {/* Secondary Resilience Simulation Link */}
                  <button
                    className={styles.secondarySimulateLink}
                    onClick={() => setIsSimulatorOpen(true)}
                  >
                    <Sparkles size={12} />
                    Simulate Resilience Intervention (Secondary Planning)
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.emptyInspector}>
                <Compass size={28} className={styles.emptyIcon} />
                <h5>SELECT A ZONE OR BUILDING</h5>
                <p>Click any 3D extruded hazard zone or building footprint on the map to inspect live risk telemetry and trigger operational relief actions.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Bottom Corner Telemetry Footer */}
        <div className={styles.mapFooterStats}>
          <span>HEAT INDEX: {weather?.apparentTemperature ?? 46.2}°C</span>
          <span>HAZARDS MONITORED: {filteredNeighborhoods.length}/{CLIMATE_NEIGHBORHOODS.length}</span>
          <span>SAVED SCENARIOS: {savedScenarios.length}</span>
          <span>SENSOR STREAM: {mapExperience === 'IR_THERMAL' ? 'TIR RADIOMETRIC LST (MODIS/LANDSAT-9)' : 'OPEN-METEO SYNC'}</span>
        </div>
      </div>

      {/* ── CONTEXTUAL MODALS (THE 3 PRIMARY ACTIONS + FULL REPORT + SIMULATOR) ── */}
      {selectedNeighborhood && (
        <>
          {/* Action 1 Modal: Create Relief Request */}
          <CommunityNeedModal
            neighborhood={selectedNeighborhood}
            isOpen={isNeedModalOpen}
            onClose={() => setIsNeedModalOpen(false)}
            onSubmitNeed={handleSubmitNeed}
          />

          {/* Action 2 Drawer: Find Nearby Resources */}
          <NearbyResourcesDrawer
            neighborhood={selectedNeighborhood}
            isOpen={isNearbyDrawerOpen}
            onClose={() => setIsNearbyDrawerOpen(false)}
            onSelectFacility={(fac) => {
              if (mapRef.current) {
                mapRef.current.flyTo({ center: fac.coordinates, zoom: 17, pitch: viewMode === '3D' ? 58 : 0, duration: 1000 });
              }
            }}
          />

          {/* Action 3 Modal: Create Response Plan */}
          <CreateResponsePlanModal
            neighborhood={selectedNeighborhood}
            isOpen={isResponsePlanOpen}
            onClose={() => setIsResponsePlanOpen(false)}
            onPlanCreated={handlePlanCreated}
          />

          {/* Full Risk Report Modal (Reference Image 2) */}
          <FullRiskReportModal
            isOpen={isFullReportOpen}
            onClose={() => setIsFullReportOpen(false)}
            neighborhood={selectedNeighborhood}
            assessment={currentAssessment}
            selectedBlock={selectedBlock}
            onCreateDemand={() => setIsNeedModalOpen(true)}
            onCreatePlan={() => setIsResponsePlanOpen(true)}
            onFindResources={() => setIsNearbyDrawerOpen(true)}
          />

          {/* Secondary Resilience Simulator */}
          <ClimateInterventionSimulator
            neighborhood={selectedNeighborhood}
            allNeighborhoods={CLIMATE_NEIGHBORHOODS}
            isOpen={isSimulatorOpen}
            onClose={() => setIsSimulatorOpen(false)}
            onSaveScenario={handleSaveScenario}
            onPreviewCandidateSites={(sites) => setActiveCandidateSites(sites)}
            savedScenarios={savedScenarios}
          />
        </>
      )}
    </div>
  );
};

export default SpatialIntelligence;
