import React, { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import {
  Layers,
  Search,
  ChevronDown,
  AlertTriangle,
  Shield,
  MapPin,
  Building,
  Flame,
  Compass,
  Sparkles,
  Users,
  Award,
  Sliders,
  Droplets,
  Waves,
  Sun,
  TreePine,
  CloudSun,
  ShieldAlert,
  FileText,
  History
} from 'lucide-react';
import styles from './SpatialIntelligence.module.css';

// Data & Services
import {
  CLIMATE_NEIGHBORHOODS,
  COOLING_FACILITIES,
  type ClimateNeighborhood,
  type CandidateInterventionSite
} from '../../data/climateData';
import { fetchLiveWeatherData, type WeatherData } from '../../services/weatherService';
import {
  computeVulnerabilityScore,
  DEFAULT_VULNERABILITY_WEIGHTS,
  type VulnerabilityWeights
} from '../../utils/vulnerabilityScoring';
import { useOperationalState } from '../../context/OperationalStateContext';

// Components & Modals
import { ClimateInterventionSimulator, type SavedScenario } from '../../components/climate/ClimateInterventionSimulator';
import { ClimateAIAssistant } from '../../components/climate/ClimateAIAssistant';
import { VolunteerCampaignHub } from '../../components/climate/VolunteerCampaignHub';
import { VerifiedImpactDashboard } from '../../components/climate/VerifiedImpactDashboard';
import {
  CommunityNeedModal,
  NearbyResourcesDrawer,
  VulnerabilityWeightsModal,
  CreateResponsePlanModal,
  LocationHistoryDrawer
} from '../../components/climate/ClimateModals';

export const SpatialIntelligence: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const candidateMarkersRef = useRef<maplibregl.Marker[]>([]);

  const { addToast, addManualRequest } = useOperationalState();

  // ── UI State Controls ──
  const [viewMode, setViewMode] = useState<'2D' | '3D' | 'COMPARE'>('3D');
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'HEAT_RISK' | 'FLOOD_RISK' | 'CANOPY' | 'POPULATION'>('ALERTS');
  const [basemap, setBasemap] = useState<'SATELLITE' | 'STREETS' | 'DARK'>('SATELLITE');
  const [selectedCity, setSelectedCity] = useState<'New Delhi' | 'Mumbai' | 'Kolkata' | 'Chennai'>('New Delhi');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(85);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CRITICAL' | 'HEAT' | 'FLOOD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Layer Toggles ──
  const [showHeatRisk, setShowHeatRisk] = useState(true);
  const [showFloodRisk, setShowFloodRisk] = useState(true);
  const [showCoolingPoints, setShowCoolingPoints] = useState(true);

  // ── Selected Entity ──
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<ClimateNeighborhood | null>(CLIMATE_NEIGHBORHOODS[0]);

  // ── Live Weather Data ──
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // ── Configurable Vulnerability Weights ──
  const [vulnerabilityWeights, setVulnerabilityWeights] = useState<VulnerabilityWeights>(DEFAULT_VULNERABILITY_WEIGHTS);

  // ── Modals & Drawers State ──
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isVolunteerHubOpen, setIsVolunteerHubOpen] = useState(false);
  const [isImpactDashboardOpen, setIsImpactDashboardOpen] = useState(false);
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);
  const [isNearbyDrawerOpen, setIsNearbyDrawerOpen] = useState(false);
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [isResponsePlanOpen, setIsResponsePlanOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeCandidateSites, setActiveCandidateSites] = useState<CandidateInterventionSite[]>([]);


  // Fetch live weather data on mount or city change
  useEffect(() => {
    let isMounted = true;
    fetchLiveWeatherData(selectedCity).then(data => {
      if (isMounted) setWeather(data);
    });
    return () => { isMounted = false; };
  }, [selectedCity]);

  // ── Map Initialization ──
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
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
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite-tiles',
            minzoom: 0,
            maxzoom: 20
          }
        ]
      },
      center: [77.221, 28.616],
      zoom: 15.6,
      pitch: viewMode === '3D' ? 58 : 0,
      bearing: viewMode === '3D' ? -24 : 0
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      // 1. Add Climate Neighborhoods GeoJSON
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
            exposedPopulation: n.exposedPopulation
          },
          geometry: {
            type: 'Polygon',
            coordinates: n.coordinates
          }
        }))
      };

      map.addSource('climate-neighborhoods', {
        type: 'geojson',
        data: geojsonData
      });

      // 3D Extrusion Layer for Climate Risk Height
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

      // Boundary Line Layer
      map.addLayer({
        id: 'climate-borders',
        type: 'line',
        source: 'climate-neighborhoods',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2,
          'line-opacity': 0.85
        }
      });

      // Click to select neighborhood
      map.on('click', 'climate-extrusion', (e) => {
        if (!e.features || !e.features[0]) return;
        const featureId = e.features[0].properties?.id;
        const found = CLIMATE_NEIGHBORHOODS.find(n => n.id === featureId);
        if (found) {
          setSelectedNeighborhood(found);
          map.flyTo({
            center: found.center,
            zoom: 16.2,
            pitch: 58,
            duration: 1200
          });
        }
      });

      // Cursor change on hover
      map.on('mouseenter', 'climate-extrusion', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'climate-extrusion', () => {
        map.getCanvas().style.cursor = '';
      });

      // 2. Add Cooling Center & Water Kiosk HTML Markers
      COOLING_FACILITIES.forEach(fac => {
        const el = document.createElement('div');
        el.className = 'climate-facility-marker';
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = fac.type === 'COOLING_CENTER' ? '#38bdf8' : '#10b981';
        el.style.border = '2px solid #ffffff';
        el.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.8)';
        el.style.cursor = 'pointer';
        el.title = `${fac.name} (${fac.type})`;

        el.addEventListener('click', () => {
          map.flyTo({ center: fac.coordinates, zoom: 17, duration: 800 });
          addToast('INFO', `Selected Facility: ${fac.name} (${fac.capacityPeople} capacity, ${fac.waterSupplyLiters}L water)`);
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(fac.coordinates)
          .addTo(map);

        markersRef.current.push(marker);
      });
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      candidateMarkersRef.current.forEach(m => m.remove());
      candidateMarkersRef.current = [];
      map.remove();
    };
  }, []);

  // Render candidate intervention sites directly on the 3D map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    candidateMarkersRef.current.forEach(m => m.remove());
    candidateMarkersRef.current = [];

    if (activeCandidateSites.length === 0) return;

    activeCandidateSites.forEach(site => {
      const el = document.createElement('div');
      el.className = 'candidate-site-marker';
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
  }, [activeCandidateSites]);

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
    } catch {
      // Map style loading check
    }
  }, [activeTab]);

  // Toggle cooling center markers visibility
  useEffect(() => {
    markersRef.current.forEach(m => {
      const el = m.getElement();
      if (el) {
        el.style.display = showCoolingPoints ? 'block' : 'none';
      }
    });
  }, [showCoolingPoints]);

  // Filter heat or flood risk polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('climate-extrusion')) return;

    const filterExpr: any = ['all'];
    if (!showHeatRisk) {
      filterExpr.push(['!=', ['get', 'primaryHazard'], 'URBAN_HEAT']);
    }
    if (!showFloodRisk) {
      filterExpr.push(['!=', ['get', 'primaryHazard'], 'FLOOD_SURGE']);
    }

    try {
      map.setFilter('climate-extrusion', filterExpr.length > 1 ? filterExpr : null);
    } catch {}
  }, [showHeatRisk, showFloodRisk]);

  // Update fill extrusion opacity dynamically
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer('climate-extrusion')) {
      map.setPaintProperty('climate-extrusion', 'fill-extrusion-opacity', overlayOpacity / 100);
    }
  }, [overlayOpacity]);

  // Handle 2D/3D mode transitions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (viewMode === '3D') {
      map.easeTo({ pitch: 58, bearing: -24, duration: 800 });
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    }
  }, [viewMode]);


  // Update basemap style
  const handleBasemapChange = (type: 'SATELLITE' | 'STREETS' | 'DARK') => {
    setBasemap(type);
    const map = mapRef.current;
    if (!map) return;

    if (type === 'STREETS') {
      map.setStyle({
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap'
          }
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles' }]
      });
    } else if (type === 'DARK') {
      map.setStyle({
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256
          }
        },
        layers: [{
          id: 'dark-layer',
          type: 'raster',
          source: 'osm-tiles',
          paint: { 'raster-brightness-max': 0.6, 'raster-saturation': -0.9, 'raster-contrast': 0.3 }
        }]
      });
    } else {
      map.setStyle({
        version: 8,
        sources: {
          'satellite-tiles': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256
          }
        },
        layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles' }]
      });
    }
  };

  // Filtered neighborhoods
  const filteredNeighborhoods = CLIMATE_NEIGHBORHOODS.filter(n => {
    if (filterMode === 'CRITICAL') return n.severity === 'CRITICAL';
    if (filterMode === 'HEAT') return n.primaryHazard === 'URBAN_HEAT';
    if (filterMode === 'FLOOD') return n.primaryHazard === 'FLOOD_SURGE';
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.name.toLowerCase().includes(q) || n.wardNumber.toLowerCase().includes(q) || n.zone.toLowerCase().includes(q);
    }
    return true;
  });

  // Calculate current vulnerability assessment result
  const currentAssessment = selectedNeighborhood ? computeVulnerabilityScore({
    hazardScore: selectedNeighborhood.severity === 'CRITICAL' ? 88 : selectedNeighborhood.severity === 'HIGH' ? 68 : 42,
    exposedPopulation: selectedNeighborhood.exposedPopulation,
    facilitiesCount: selectedNeighborhood.facilitiesCount,
    resourceSufficiencyRatio: selectedNeighborhood.resourceSufficiencyRatio,
    demographicSensitivityPct: selectedNeighborhood.demographicSensitivityPct
  }, vulnerabilityWeights) : null;

  // Actions
  const handleAssignCommunityTeam = () => {
    if (!selectedNeighborhood) return;
    addToast('SUCCESS', `Dispatched Community Resilience Team to ${selectedNeighborhood.name}. Live radio telemetry active.`);
  };

  const handleSaveScenario = (scenario: SavedScenario) => {
    setSavedScenarios(prev => [scenario, ...prev]);
    addToast('SUCCESS', `Saved Scenario: ${scenario.interventionType.replace('_', ' ')} for ${scenario.neighborhoodName}! (-${scenario.surfaceTempDeltaC}°C projected)`);
  };

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
    addToast('SUCCESS', `Logged urgent request: ${need.quantity} ${need.unit} of ${need.itemNeeded} for ${selectedNeighborhood.name}.`);
  };

  return (
    <div className={styles.spatialWrapper}>
      {/* ── TOP CONTROL HUD BAR ── */}
      <header className={styles.topHudBar}>
        {/* Left Section: Opacity slider & Title */}
        <div className={styles.hudLeft}>
          <div className={styles.opacityControl}>
            <div className={styles.opacityLabel}>
              <span>CLIMATE OPACITY</span>
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

          <div className={styles.titleBadge}>
            <CloudSun size={14} className={styles.badgeIcon} />
            <span>WOW • 3D CLIMATE INTELLIGENCE</span>
          </div>
        </div>

        {/* Center Section: Search & Quick Toggles */}
        <div className={styles.hudCenter}>
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search neighborhood, ward, hazard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div
            className={styles.pillDropdown}
            onClick={() => {
              const cities: ('New Delhi' | 'Mumbai' | 'Kolkata' | 'Chennai')[] = ['New Delhi', 'Mumbai', 'Kolkata', 'Chennai'];
              const nextIdx = (cities.indexOf(selectedCity) + 1) % cities.length;
              setSelectedCity(cities[nextIdx]);
            }}
          >
            <MapPin size={13} className={styles.dropdownIcon} />
            <span>{selectedCity} {weather?.isLive ? `(${weather.temperature}°C)` : ''}</span>
            <ChevronDown size={13} />
          </div>

          <button
            className={`${styles.pillButton} ${basemap === 'SATELLITE' ? styles.pillActive : ''}`}
            onClick={() => handleBasemapChange(basemap === 'SATELLITE' ? 'STREETS' : 'SATELLITE')}
          >
            <Layers size={13} />
            <span>{basemap === 'SATELLITE' ? 'Satellite 3D' : 'Streets'}</span>
          </button>

          <button
            className={styles.pillDropdown}
            onClick={() => setFilterMode(filterMode === 'ALL' ? 'CRITICAL' : filterMode === 'CRITICAL' ? 'HEAT' : filterMode === 'HEAT' ? 'FLOOD' : 'ALL')}
          >
            <span>FILTER: {filterMode}</span>
            <ChevronDown size={13} />
          </button>

          {/* Quick Layer Toggles */}
          <div className={styles.quickToggleGroup}>
            <button
              className={`${styles.quickBtn} ${showHeatRisk ? styles.quickBtnActive : ''}`}
              onClick={() => setShowHeatRisk(!showHeatRisk)}
            >
              <Flame size={12} />
              <span>HEAT RISK</span>
            </button>
            <button
              className={`${styles.quickBtn} ${showFloodRisk ? styles.quickBtnActive : ''}`}
              onClick={() => setShowFloodRisk(!showFloodRisk)}
            >
              <Waves size={12} />
              <span>FLOOD RISK</span>
            </button>
            <button
              className={`${styles.quickBtn} ${showCoolingPoints ? styles.quickBtnActive : ''}`}
              onClick={() => setShowCoolingPoints(!showCoolingPoints)}
            >
              <Droplets size={12} />
              <span>COOLING/WATER</span>
            </button>
          </div>
        </div>

        {/* Right Section: 2D/3D Mode & Analysis Tabs */}
        <div className={styles.hudRight}>
          <div className={styles.viewModeToggle}>
            <button
              className={`${styles.modeBtn} ${viewMode === '2D' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('2D')}
            >
              2D
            </button>
            <button
              className={`${styles.modeBtn} ${viewMode === '3D' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('3D')}
            >
              3D
            </button>
            <button
              className={`${styles.modeBtn} ${viewMode === 'COMPARE' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('COMPARE')}
            >
              COMPARE
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

      {/* ── MAIN MAP & OPERATOR DASHBOARD VIEWPORT ── */}
      <div className={styles.mapViewport}>
        {/* Map Container */}
        <div ref={mapContainerRef} className={styles.mapCanvas} />

        {/* ── LEFT FLOATING CLIMATE OPERATIONS DASHBOARD ── */}
        <aside className={styles.leftDashboard}>
          <div className={styles.dashHeader}>
            <div className={styles.dashTitleRow}>
              <h3>CLIMATE OPERATIONS DASHBOARD</h3>
              <span className={styles.auditBadge}>6 Wards Monitored</span>
            </div>

            {/* Core Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.statIconDanger}`}><AlertTriangle size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>ACTIVE CLIMATE ALERTS</span>
                  <span className={`${styles.statNum} ${styles.textDanger}`}>5 Critical</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.statIconWarning}`}><Building size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>HIGH-RISK WARDS</span>
                  <span className={`${styles.statNum} ${styles.textWarning}`}>4 Sectors</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><Droplets size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>OPEN AID REQUESTS</span>
                  <span className={`${styles.statNum} ${styles.textInfo}`}>14 Pending</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.statIconSuccess}`}><Users size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>VOLUNTEERS ACTIVE</span>
                  <span className={`${styles.statNum} ${styles.textSuccess}`}>64 Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Community Resilience Metrics */}
          <div className={styles.dashSection}>
            <div className={styles.sectionHeading}>
              <span>COMMUNITY RESILIENCE METRICS</span>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricItem}>
                <Shield size={14} className={styles.textSuccess} />
                <div>
                  <span className={styles.metricValue}>3,820</span>
                  <span className={styles.metricTitle}>PEOPLE ASSISTED</span>
                </div>
              </div>
              <div className={styles.metricItem}>
                <Droplets size={14} className={styles.textInfo} />
                <div>
                  <span className={styles.metricValue}>84,500L</span>
                  <span className={styles.metricTitle}>WATER DELIVERED</span>
                </div>
              </div>
              <div className={styles.metricItem}>
                <TreePine size={14} className={styles.textSuccess} />
                <div>
                  <span className={styles.metricValue}>3,820</span>
                  <span className={styles.metricTitle}>TREES MAINTAINED</span>
                </div>
              </div>
              <div className={styles.metricItem}>
                <Sun size={14} className={styles.textWarning} />
                <div>
                  <span className={styles.metricValue}>1,680</span>
                  <span className={styles.metricTitle}>COOL ROOFS COATED</span>
                </div>
              </div>
            </div>

            {/* Real Weather Integration Banner */}
            <div className={styles.forecastBox}>
              <div className={styles.forecastRow}>
                <span>Live Open-Meteo Heat Index:</span>
                <strong className={styles.textDanger}>{weather?.apparentTemperature ?? 46.2}°C (Extreme)</strong>
              </div>
              <div className={styles.forecastRow}>
                <span>Monsoon Rain Probability:</span>
                <strong className={styles.textInfo}>{weather?.rainProbability ?? 65}% Chance</strong>
              </div>
              <div className={styles.forecastRow}>
                <span>Yamuna Inundation Level:</span>
                <strong className={styles.textWarning}>205.85m (Warning Mark: 205.33m)</strong>
              </div>
            </div>
          </div>

          {/* Climate Hazard Severity Legend */}
          <div className={styles.legendBox}>
            <span className={styles.legendHeading}>CLIMATE HAZARD RISK SEVERITY</span>
            <div className={styles.legendList}>
              <div className={styles.legendRow}>
                <span className={styles.swatchSevere} />
                <span>Critical Risk: Extreme Heat Island &gt;44°C or Flood Depth &gt;1.5m</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchMod} />
                <span>High Risk: Severe Heat Stress / Inadequate Drainage</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchMinor} />
                <span>Moderate Risk: Urban Canopy Deficit &lt;10%</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchClean} />
                <span>Low Risk: Climate Resilient Shaded Precinct</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchLine} />
                <span>Evacuation & Logistics Route Mesh</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT FLOATING COMMUNITY CLIMATE INTELLIGENCE PANEL ── */}
        <aside className={styles.rightInspector}>
          <div className={styles.inspectorCard}>
            <div className={styles.inspectorHeader}>
              <div className={styles.insHeaderIcon}><ShieldAlert size={16} /></div>
              <div>
                <h4>COMMUNITY CLIMATE INTELLIGENCE</h4>
                <p>{selectedNeighborhood ? selectedNeighborhood.wardNumber : 'Select a neighborhood polygon'}</p>
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
                  <span className={styles.infoLabel}>Neighborhood Name:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.name}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Primary Hazard:</span>
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
                  <span className={styles.infoVal}>{selectedNeighborhood.canopyCoverPct}% (Goal: &gt;25%)</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Exposed Population:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.exposedPopulation.toLocaleString()} residents</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Cooling & Water Kiosks:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.coolingCentersCount} centers / {selectedNeighborhood.waterPointsCount} water ATMs</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Assigned Lead Unit:</span>
                  <span className={styles.infoVal}>{selectedNeighborhood.assignedTeam}</span>
                </div>

                {/* Vulnerability Factors */}
                <div className={styles.vulnerabilityFactorsBox}>
                  <strong>Compounding Vulnerability Drivers:</strong>
                  <ul className={styles.factorsList}>
                    {selectedNeighborhood.vulnerabilityFactors.map((vf, i) => (
                      <li key={i}>{vf}</li>
                    ))}
                  </ul>
                </div>

                {/* Interactive Working Action Buttons */}
                <div className={styles.actionButtons}>
                  <button className={styles.actionPrimary} onClick={() => setIsSimulatorOpen(true)}>
                    <Sparkles size={14} />
                    Simulate Climate Intervention
                  </button>

                  <button className={styles.actionSecondary} onClick={() => setIsResponsePlanOpen(true)}>
                    <FileText size={14} />
                    Create Response Plan
                  </button>

                  <button className={styles.actionSecondary} onClick={() => setIsNeedModalOpen(true)}>
                    <Droplets size={14} />
                    Report Community Need
                  </button>

                  <button className={styles.actionSecondary} onClick={handleAssignCommunityTeam}>
                    <Users size={14} />
                    Assign Community Team
                  </button>

                  <button className={styles.actionSecondary} onClick={() => setIsNearbyDrawerOpen(true)}>
                    <MapPin size={14} />
                    Find Nearby Resources
                  </button>

                  <button className={styles.actionSecondary} onClick={() => setIsHistoryDrawerOpen(true)}>
                    <History size={14} />
                    View Location History
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.emptyInspector}>
                <Compass size={28} className={styles.emptyIcon} />
                <h5>SELECT A NEIGHBORHOOD</h5>
                <p>Click any 3D extruded climate zone on the map to inspect real-time hazard indicators and mobilize community resilience teams.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Feature Action Button Rail (Bottom Right) */}
        <div className={styles.featureActionBtnGroup}>
          <button className={styles.featureActionBtn} onClick={() => setIsSimulatorOpen(true)}>
            <Sparkles size={14} />
            Intervention Simulator
          </button>
          <button className={styles.featureActionBtn} onClick={() => setIsVolunteerHubOpen(true)}>
            <Users size={14} />
            Volunteer Hub
          </button>
          <button className={styles.featureActionBtn} onClick={() => setIsImpactDashboardOpen(true)}>
            <Award size={14} />
            Verified Impact
          </button>
          <button className={styles.featureActionBtn} onClick={() => setIsAIAssistantOpen(true)}>
            <Sparkles size={14} />
            AI Copilot
          </button>
          <button className={styles.featureActionBtn} onClick={() => setIsWeightsModalOpen(true)}>
            <Sliders size={14} />
            Score Weights
          </button>
        </div>

        {/* Bottom Corner Telemetry Footer */}
        <div className={styles.mapFooterStats}>
          <span>WARMTH INDEX: {weather?.apparentTemperature ?? 46.2}°C</span>
          <span>HAZARDS MONITORED: {filteredNeighborhoods.length}/{CLIMATE_NEIGHBORHOODS.length}</span>
          <span>SAVED SCENARIOS: {savedScenarios.length}</span>
        </div>
      </div>

      {/* ── MODALS & DRAWERS ── */}
      {selectedNeighborhood && (
        <>
          <ClimateInterventionSimulator
            neighborhood={selectedNeighborhood}
            allNeighborhoods={CLIMATE_NEIGHBORHOODS}
            isOpen={isSimulatorOpen}
            onClose={() => setIsSimulatorOpen(false)}
            onSaveScenario={handleSaveScenario}
            onPreviewCandidateSites={(sites) => setActiveCandidateSites(sites)}
            savedScenarios={savedScenarios}
          />

          <ClimateAIAssistant
            neighborhood={selectedNeighborhood}
            isOpen={isAIAssistantOpen}
            onClose={() => setIsAIAssistantOpen(false)}
            onTriggerActionPlan={(text) => addToast('INFO', text)}
          />

          <CommunityNeedModal
            neighborhood={selectedNeighborhood}
            isOpen={isNeedModalOpen}
            onClose={() => setIsNeedModalOpen(false)}
            onSubmitNeed={handleSubmitNeed}
          />

          <CreateResponsePlanModal
            neighborhood={selectedNeighborhood}
            isOpen={isResponsePlanOpen}
            onClose={() => setIsResponsePlanOpen(false)}
            onPlanCreated={(plan) => {
              addToast('SUCCESS', `Created & Dispatched Community Response Plan ${plan.planReference} for ${plan.neighborhoodName}!`);
            }}
          />

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

          <LocationHistoryDrawer
            neighborhood={selectedNeighborhood}
            isOpen={isHistoryDrawerOpen}
            onClose={() => setIsHistoryDrawerOpen(false)}
          />
        </>
      )}

      <VolunteerCampaignHub
        isOpen={isVolunteerHubOpen}
        onClose={() => setIsVolunteerHubOpen(false)}
        onShowToast={addToast}
      />

      <VerifiedImpactDashboard
        isOpen={isImpactDashboardOpen}
        onClose={() => setIsImpactDashboardOpen(false)}
      />

      <VulnerabilityWeightsModal
        weights={vulnerabilityWeights}
        neighborhood={selectedNeighborhood}
        isOpen={isWeightsModalOpen}
        onClose={() => setIsWeightsModalOpen(false)}
        onSaveWeights={(w) => {
          setVulnerabilityWeights(w);
          addToast('SUCCESS', 'Updated Community Vulnerability Weights. Recalculated index scores.');
        }}
      />

    </div>
  );
};

export default SpatialIntelligence;
