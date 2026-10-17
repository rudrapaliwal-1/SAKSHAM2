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
  Navigation
} from 'lucide-react';
import styles from './SpatialIntelligence.module.css';

// Data & Services
import {
  CLIMATE_NEIGHBORHOODS,
  COOLING_FACILITIES,
  type ClimateNeighborhood,
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

export const SpatialIntelligence: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const candidateMarkersRef = useRef<maplibregl.Marker[]>([]);

  const { addToast, addManualRequest, addAuditLog } = useOperationalState();

  // ── UI State Controls ──
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'HEAT_RISK' | 'FLOOD_RISK' | 'CANOPY' | 'POPULATION'>('ALERTS');
  const [basemap, setBasemap] = useState<'SATELLITE' | 'STREETS' | 'DARK'>('SATELLITE');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(85);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MODERATE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  // ── 10 Independent Layer Toggles (Phase 4.B) ──
  const [showHeatRisk, setShowHeatRisk] = useState(true);
  const [showFloodRisk, setShowFloodRisk] = useState(true);
  const [showVulnerability, setShowVulnerability] = useState(false);
  const [showPopulation, setShowPopulation] = useState(false);
  const [showCanopy, setShowCanopy] = useState(false);
  const [showShelters, setShowShelters] = useState(true);
  const [showWaterPoints, setShowWaterPoints] = useState(true);
  const [showHealthcare, setShowHealthcare] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  // ── Selected Entity ──
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<ClimateNeighborhood | null>(CLIMATE_NEIGHBORHOODS[0]);

  // ── Live Weather Data ──
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // ── Vulnerability Weights ──
  const [vulnerabilityWeights] = useState<VulnerabilityWeights>(DEFAULT_VULNERABILITY_WEIGHTS);

  // ── Modals State (3 Primary Actions + Secondary Simulator) ──
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

  // Filtered neighborhoods based on search & severity
  const filteredNeighborhoods = useMemo(() => {
    return CLIMATE_NEIGHBORHOODS.filter(n => {
      if (severityFilter !== 'ALL' && n.severity !== severityFilter) return false;
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
  }, [severityFilter, searchQuery]);

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
            'raster-brightness-max': 0.6,
            'raster-saturation': -0.9,
            'raster-contrast': 0.3
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
          map.flyTo({ center: [s.coordinates.lng, s.coordinates.lat], zoom: 16.5, pitch: 58, duration: 800 });
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
          map.flyTo({ center: w.coordinates, zoom: 16.5, pitch: 58, duration: 800 });
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
          map.flyTo({ center: [h.coordinates.lng, h.coordinates.lat], zoom: 16.5, pitch: 58, duration: 800 });
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
          map.flyTo({ center: [r.coordinates.lng, r.coordinates.lat], zoom: 16.5, pitch: 58, duration: 800 });
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
          map.flyTo({ center: [inc.coordinates.lng, inc.coordinates.lat], zoom: 16.5, pitch: 58, duration: 800 });
          addToast('WARNING', `Active Incident ${inc.id} [${inc.type}]: ${inc.location} | Status: ${inc.status} | Displaced: ${inc.displacedCount}`);
        });
        const m = new maplibregl.Marker({ element: el })
          .setLngLat([inc.coordinates.lng, inc.coordinates.lat])
          .addTo(map);
        markersRef.current.push(m);
      });
    }
  }, [showShelters, showWaterPoints, showHealthcare, showDepots, showIncidents, addToast]);

  // Idempotent setup of MapLibre layers & sources
  const setupMapLayersAndMarkers = useCallback((map: maplibregl.Map) => {
    if (!map) return;

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
          height: n.height,
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

    // 1. Add Source idempotently
    if (!map.getSource('climate-neighborhoods')) {
      map.addSource('climate-neighborhoods', {
        type: 'geojson',
        data: geojsonData
      });
    }

    // 2. Add 3D Extrusion Layer idempotently
    if (!map.getLayer('climate-extrusion')) {
      map.addLayer({
        id: 'climate-extrusion',
        type: 'fill-extrusion',
        source: 'climate-neighborhoods',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': overlayOpacity / 100
        }
      });

      map.on('click', 'climate-extrusion', (e) => {
        if (!e.features || !e.features[0]) return;
        const featureId = e.features[0].properties?.id;
        const found = CLIMATE_NEIGHBORHOODS.find(n => n.id === featureId);
        if (found) {
          setSelectedNeighborhood(found);
          map.flyTo({
            center: found.center,
            zoom: 16.2,
            pitch: viewMode === '3D' ? 58 : 0,
            duration: 1000
          });
        }
      });

      map.on('mouseenter', 'climate-extrusion', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'climate-extrusion', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // 3. Add Line Borders Layer idempotently
    if (!map.getLayer('climate-borders')) {
      map.addLayer({
        id: 'climate-borders',
        type: 'line',
        source: 'climate-neighborhoods',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-opacity': 0.9
        }
      });
    }

    // 4. Render markers
    renderTacticalMarkers(map);
  }, [overlayOpacity, viewMode, renderTacticalMarkers]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getBasemapStyleSpec('SATELLITE'),
      center: [77.221, 28.616],
      zoom: 15.6,
      pitch: viewMode === '3D' ? 58 : 0,
      bearing: viewMode === '3D' ? -24 : 0
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    mapRef.current = map;

    // Idempotent restoration on initial load
    map.on('load', () => {
      setupMapLayersAndMarkers(map);
    });

    // Idempotent restoration on style changes (Phase 6.A)
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

  // Update map extrusion style based on activeTab
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('climate-extrusion')) return;

    try {
      if (activeTab === 'HEAT_RISK') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'temp'],
          38, '#f59e0b',
          42, '#ea580c',
          45, '#dc2626',
          48, '#7f1d1d'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', [
          '*',
          ['get', 'temp'],
          1.8
        ]);
      } else if (activeTab === 'FLOOD_RISK') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'floodDepth'],
          0, '#06b6d4',
          0.3, '#0284c7',
          1.0, '#1d4ed8',
          1.8, '#1e3a8a'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', [
          '+',
          15,
          ['*', ['get', 'floodDepth'], 40]
        ]);
      } else if (activeTab === 'CANOPY') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'case',
          ['<', ['get', 'canopyCoverPct'], 5], '#78350f',
          ['<', ['get', 'canopyCoverPct'], 12], '#eab308',
          '#10b981'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', 35);
      } else if (activeTab === 'POPULATION') {
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', [
          'interpolate',
          ['linear'],
          ['get', 'exposedPopulation'],
          5000, '#a855f7',
          15000, '#7c3aed',
          30000, '#4c1d95'
        ]);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', [
          '/',
          ['get', 'exposedPopulation'],
          250
        ]);
      } else {
        // ALERTS mode: default severity color and base height
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-color', ['get', 'color']);
        map.setPaintProperty('climate-extrusion', 'fill-extrusion-height', ['get', 'height']);
      }
    } catch {}
  }, [activeTab]);

  // Synchronize GeoJSON layer filter with search & severity (Phase 6.C)
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
    if (searchQuery.trim()) {
      const matchedIds = filteredNeighborhoods.map(n => n.id);
      filterExpr.push(['in', ['get', 'id'], ['literal', matchedIds]]);
    }

    try {
      map.setFilter('climate-extrusion', filterExpr.length > 1 ? filterExpr : null);
      if (map.getLayer('climate-borders')) {
        map.setFilter('climate-borders', filterExpr.length > 1 ? filterExpr : null);
      }
    } catch {}
  }, [severityFilter, showHeatRisk, showFloodRisk, searchQuery, filteredNeighborhoods]);

  // Update fill extrusion opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('climate-extrusion')) {
      map.setPaintProperty('climate-extrusion', 'fill-extrusion-opacity', overlayOpacity / 100);
    }
  }, [overlayOpacity]);

  // 2D / 3D mode transitions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (viewMode === '3D') {
      map.easeTo({ pitch: 58, bearing: -24, duration: 800 });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    }
  }, [viewMode]);

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

  return (
    <div className={styles.spatialWrapper}>
      {/* ── TOP SAKSHAM COMMAND HEADER (PHASE 4.A) ── */}
      <header className={styles.topHudBar}>
        {/* Left Section: Breadcrumb & Title */}
        <div className={styles.hudLeft}>
          <div className={styles.titleBadge}>
            <ShieldAlert size={15} className={styles.badgeIcon} />
            <div>
              <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 700 }}>
                SAKSHAM / OPERATIONS
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
                Spatial Intelligence
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

        {/* Center Section: Search, Scope & Filters */}
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

          {/* Operational City Selector (Phase 6.B) */}
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

          {/* Basemap Selector (Phase 6.A) */}
          <button
            className={`${styles.pillButton} ${basemap === 'SATELLITE' ? styles.pillActive : ''}`}
            onClick={() => handleBasemapChange(basemap === 'SATELLITE' ? 'STREETS' : basemap === 'STREETS' ? 'DARK' : 'SATELLITE')}
            title="Toggle between Satellite 3D, Streets and Tactical Dark"
          >
            <Layers size={13} />
            <span>{basemap === 'SATELLITE' ? 'Satellite 3D' : basemap === 'STREETS' ? 'Streets' : 'Dark Tactical'}</span>
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

        {/* Right Section: 2D/3D View Mode Toggle & Telemetry Freshness */}
        <div className={styles.hudRight}>
          <div className={styles.viewModeToggle}>
            <button
              className={`${styles.modeBtn} ${viewMode === '2D' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('2D')}
            >
              2D Flat
            </button>
            <button
              className={`${styles.modeBtn} ${viewMode === '3D' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('3D')}
            >
              3D GIS
            </button>
          </div>

          <div className={styles.tabGroup}>
            {(['ALERTS', 'HEAT_RISK', 'FLOOD_RISK', 'CANOPY', 'POPULATION'] as const).map(tab => (
              <button
                key={tab}
                className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── TOP OPERATIONAL SUMMARY METRICS ROW (PHASE 4.C) ── */}
      <div className={styles.topMetricsRow}>
        <div className={styles.topMetricCard}>
          <div className={styles.topMetricHeader}>
            <Flame size={14} className={styles.textWarning} />
            <span>Heat Risk</span>
          </div>
          <strong className={styles.topMetricValue}>{criticalCount} Critical Wards</strong>
          <span className={styles.topMetricSub}>Max Heat Index: 48.6°C (By zone)</span>
        </div>

        <div className={styles.topMetricCard}>
          <div className={styles.topMetricHeader}>
            <Waves size={14} className={styles.textInfo} />
            <span>Flood Risk</span>
          </div>
          <strong className={styles.topMetricValue}>{floodCount} Inundated Wards</strong>
          <span className={styles.topMetricSub}>Yamuna: 205.85m (Warning: 205.33m)</span>
        </div>

        <div className={styles.topMetricCard}>
          <div className={styles.topMetricHeader}>
            <Users size={14} className={styles.textSuccess} />
            <span>Exposed People</span>
          </div>
          <strong className={styles.topMetricValue}>{totalExposed.toLocaleString()} Total</strong>
          <span className={styles.topMetricSub}>High-density informal clusters</span>
        </div>

        <div className={styles.topMetricCard}>
          <div className={styles.topMetricHeader}>
            <AlertTriangle size={14} className={styles.textDanger} />
            <span>Active Alerts</span>
          </div>
          <strong className={styles.topMetricValue}>2 Authoritative Alerts</strong>
          <span className={styles.topMetricSub}>IMD Orange Heatwave & CWC Yamuna Flood</span>
        </div>
      </div>

      {/* ── 10-LAYER CONTROLS FLYOUT POPOVER (PHASE 4.B) ── */}
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

        {/* ── LEFT FLOATING HAZARD & LEGEND PANEL ── */}
        <aside className={styles.leftDashboard}>
          <div className={styles.dashHeader}>
            <div className={styles.dashTitleRow}>
              <h3>CLIMATE HAZARD WATCH</h3>
              <span className={styles.auditBadge}>6 Wards Monitored</span>
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

          {/* Monitored Zones List */}
          <div className={styles.dashSection}>
            <div className={styles.sectionHeading}>
              <span>MONITORED CLIMATE SECTORS ({filteredNeighborhoods.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {filteredNeighborhoods.map(zone => (
                <div
                  key={zone.id}
                  onClick={() => {
                    setSelectedNeighborhood(zone);
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

          {/* Hazard Severity Legend */}
          <div className={styles.legendBox}>
            <span className={styles.legendHeading}>GIS HAZARD SEVERITY LEGEND</span>
            <div className={styles.legendList}>
              <div className={styles.legendRow}>
                <span className={styles.swatchSevere} />
                <span>Critical Risk: Extreme Heat &gt;44°C or Flood Depth &gt;1.5m</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchMod} />
                <span>High Risk: Severe Heat Stress / Inundation Buffer</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchMinor} />
                <span>Moderate Risk: Urban Canopy Deficit &lt;10%</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchClean} />
                <span>Low Risk: Shaded Resilient Precinct</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchLine} />
                <span>Emergency Evacuation & Logistics Corridor</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT FLOATING SELECTED-ZONE INSPECTOR (PHASE 4.D & 4.E) ── */}
        <aside className={styles.rightInspector}>
          <div className={styles.inspectorCard}>
            <div className={styles.inspectorHeader}>
              <div className={styles.insHeaderIcon}><ShieldAlert size={16} /></div>
              <div>
                <h4>ZONE CLIMATE INTELLIGENCE</h4>
                <p>{selectedNeighborhood ? selectedNeighborhood.wardNumber : 'Select a zone on map'}</p>
              </div>
            </div>

            {selectedNeighborhood && currentAssessment ? (
              <div className={styles.parcelDetails}>
                <div className={styles.detailHeader}>
                  <span className={`${styles.severityBadge} ${styles['badge' + selectedNeighborhood.severity]}`}>
                    {selectedNeighborhood.severity} RISK ({currentAssessment.compositeScore}/100)
                  </span>
                  <span className={styles.parcelId}>{selectedNeighborhood.code}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Zone Name:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.name}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Dominant Hazard:</span>
                  <span className={`${styles.infoVal} ${styles.textDanger}`}>{selectedNeighborhood.primaryHazard.replace('_', ' ')}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Apparent Heat Index:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.apparentTempC}°C (Ambient: {selectedNeighborhood.ambientTempC}°C)</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Flood Inundation Depth:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.floodDepthMeters} meters</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Tree Canopy Cover:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.canopyCoverPct}% (Deficit: {25 - selectedNeighborhood.canopyCoverPct}%)</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Exposed Population:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.exposedPopulation.toLocaleString()} residents</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Identified Deficits:</span>
                  <span className={`${styles.infoVal} ${styles.textWarning}`}>
                    {selectedNeighborhood.primaryHazard === 'FLOOD_SURGE' ? 'Emergency Boats & High-Plinth Shelters' : 'Drinking Water Tankers & Misting Respite'}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Data Source:</span>
                  <span className={styles.infoVal} style={{ fontSize: '10px' }}>{selectedNeighborhood.dataSource}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Freshness:</span>
                  <span className={styles.infoVal} style={{ color: '#10b981' }}>{selectedNeighborhood.lastUpdated}</span>
                </div>

                {/* Mathematical Risk Breakdown */}
                <div className={styles.vulnerabilityFactorsBox}>
                  <strong>Compounding Vulnerability Drivers:</strong>
                  <ul className={styles.factorsList}>
                    {selectedNeighborhood.vulnerabilityFactors.map((vf, i) => (
                      <li key={i}>{vf}</li>
                    ))}
                  </ul>
                </div>

                {/* ── EXACTLY THREE PRIMARY OPERATIONAL ACTIONS (PHASE 4.E) ── */}
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
                <h5>SELECT A ZONE</h5>
                <p>Click any 3D extruded climate hazard zone on the map to inspect live risk telemetry and trigger operational relief actions.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Bottom Corner Telemetry Footer */}
        <div className={styles.mapFooterStats}>
          <span>HEAT INDEX: {weather?.apparentTemperature ?? 46.2}°C</span>
          <span>HAZARDS MONITORED: {filteredNeighborhoods.length}/{CLIMATE_NEIGHBORHOODS.length}</span>
          <span>SAVED SCENARIOS: {savedScenarios.length}</span>
          <span>OPEN-METEO SYNC: LIVE</span>
        </div>
      </div>

      {/* ── CONTEXTUAL MODALS (THE 3 PRIMARY ACTIONS) ── */}
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
                mapRef.current.flyTo({ center: fac.coordinates, zoom: 17, pitch: 58, duration: 1000 });
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
