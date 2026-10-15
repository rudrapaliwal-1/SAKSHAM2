import React, { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import {
  Layers,
  Search,
  ChevronDown,
  AlertTriangle,
  Activity,
  Shield,
  MapPin,
  Building,
  CheckCircle2,
  FileText,
  Eye,
  Flame,
  Volume2,
  Compass,
  Maximize2
} from 'lucide-react';
import styles from './SpatialIntelligence.module.css';

interface CadastralParcel {
  id: string;
  surveyNumber: string;
  ownerName: string;
  zone: string;
  areaSqM: number;
  encroachedSqM: number;
  encroachmentPct: number;
  severity: 'CLEAN' | 'MINOR' | 'MODERATE' | 'SEVERE';
  seismicScore: number;
  structuralRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  coordinates: [number, number][][];
  center: [number, number];
  height: number;
  status: 'AUDITED' | 'PENDING' | 'ACTION_REQUIRED';
}

const SAMPLE_PARCELS: CadastralParcel[] = [
  {
    id: 'PARCEL-DL-001',
    surveyNumber: 'SRV-DL-8821',
    ownerName: 'Northern Railway Infrastructure Board',
    zone: 'Railway Corridor & Logistics Yard',
    areaSqM: 620,
    encroachedSqM: 145,
    encroachmentPct: 23.4,
    severity: 'SEVERE',
    seismicScore: 6.8,
    structuralRisk: 'HIGH',
    coordinates: [[
      [77.2185, 28.6185],
      [77.2205, 28.6185],
      [77.2208, 28.6165],
      [77.2188, 28.6165],
      [77.2185, 28.6185]
    ]],
    center: [77.2196, 28.6175],
    height: 38,
    status: 'ACTION_REQUIRED'
  },
  {
    id: 'PARCEL-DL-002',
    surveyNumber: 'SRV-DL-8822',
    ownerName: 'Municipal Corporation of Delhi',
    zone: 'Civic Utility & Transit Hub',
    areaSqM: 450,
    encroachedSqM: 35,
    encroachmentPct: 7.7,
    severity: 'MODERATE',
    seismicScore: 7.4,
    structuralRisk: 'MEDIUM',
    coordinates: [[
      [77.2210, 28.6190],
      [77.2230, 28.6190],
      [77.2232, 28.6172],
      [77.2212, 28.6172],
      [77.2210, 28.6190]
    ]],
    center: [77.2221, 28.6181],
    height: 45,
    status: 'AUDITED'
  },
  {
    id: 'PARCEL-DL-003',
    surveyNumber: 'SRV-DL-8823',
    ownerName: 'Delhi Development Authority (DDA)',
    zone: 'Green Belt Buffer & Stadium Precinct',
    areaSqM: 580,
    encroachedSqM: 12,
    encroachmentPct: 2.1,
    severity: 'MINOR',
    seismicScore: 8.2,
    structuralRisk: 'LOW',
    coordinates: [[
      [77.2160, 28.6150],
      [77.2180, 28.6150],
      [77.2182, 28.6130],
      [77.2162, 28.6130],
      [77.2160, 28.6150]
    ]],
    center: [77.2171, 28.6140],
    height: 25,
    status: 'AUDITED'
  },
  {
    id: 'PARCEL-DL-004',
    surveyNumber: 'SRV-DL-8824',
    ownerName: 'National Disaster Logistics Facility',
    zone: 'Emergency Stockpile Terminal',
    areaSqM: 380,
    encroachedSqM: 0,
    encroachmentPct: 0.0,
    severity: 'CLEAN',
    seismicScore: 8.9,
    structuralRisk: 'LOW',
    coordinates: [[
      [77.2190, 28.6145],
      [77.2210, 28.6145],
      [77.2212, 28.6128],
      [77.2192, 28.6128],
      [77.2190, 28.6145]
    ]],
    center: [77.2201, 28.6136],
    height: 30,
    status: 'AUDITED'
  },
  {
    id: 'PARCEL-DL-005',
    surveyNumber: 'SRV-DL-8825',
    ownerName: 'Yamuna Floodplain Reclamation Area',
    zone: 'Riverbank High Hazard Zone',
    areaSqM: 742,
    encroachedSqM: 158,
    encroachmentPct: 21.2,
    severity: 'SEVERE',
    seismicScore: 5.9,
    structuralRisk: 'CRITICAL',
    coordinates: [[
      [77.2235, 28.6160],
      [77.2260, 28.6160],
      [77.2262, 28.6138],
      [77.2237, 28.6138],
      [77.2235, 28.6160]
    ]],
    center: [77.2248, 28.6149],
    height: 22,
    status: 'ACTION_REQUIRED'
  }
];

export const SpatialIntelligence: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // UI state controls
  const [viewMode, setViewMode] = useState<'2D' | '3D' | 'COMPARE'>('3D');
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'SEISMIC' | 'FORECAST' | 'ACCESS' | 'AERIAL'>('ALERTS');
  const [basemap, setBasemap] = useState<'SATELLITE' | 'STREETS' | 'DARK'>('SATELLITE');
  const [selectedCity, setSelectedCity] = useState<'New Delhi' | 'Mumbai' | 'Kolkata' | 'Chennai'>('New Delhi');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(100);
  const [orthoOverlay, setOrthoOverlay] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ENCROACHED' | 'CRITICAL'>('ALL');
  
  // Layer toggles
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showCadastre, setShowCadastre] = useState(true);
  const [showNoise, setShowNoise] = useState(false);

  // Selected Parcel
  const [selectedParcel, setSelectedParcel] = useState<CadastralParcel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Map Initialization
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
      // Add Cadastral GeoJSON Source
      const geojsonData: FeatureCollection = {
        type: 'FeatureCollection',
        features: SAMPLE_PARCELS.map(p => ({
          type: 'Feature',
          properties: {
            id: p.id,
            surveyNumber: p.surveyNumber,
            ownerName: p.ownerName,
            zone: p.zone,
            severity: p.severity,
            encroachmentPct: p.encroachmentPct,
            height: p.height,
            color: p.severity === 'SEVERE' ? '#ef4444' : p.severity === 'MODERATE' ? '#f59e0b' : p.severity === 'MINOR' ? '#38bdf8' : '#10b981'
          },
          geometry: {
            type: 'Polygon',
            coordinates: p.coordinates
          }
        }))
      };

      map.addSource('cadastre-parcels', {
        type: 'geojson',
        data: geojsonData
      });

      // 3D Extrusion Layer
      map.addLayer({
        id: 'cadastre-extrusion',
        type: 'fill-extrusion',
        source: 'cadastre-parcels',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.78
        }
      });

      // Boundary Line Layer
      map.addLayer({
        id: 'cadastre-lines',
        type: 'line',
        source: 'cadastre-parcels',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-opacity': 0.95
        }
      });

      // Click to select parcel
      map.on('click', 'cadastre-extrusion', (e) => {
        if (!e.features || e.features.length === 0) return;
        const clickedId = e.features[0].properties?.id;
        const parcel = SAMPLE_PARCELS.find(p => p.id === clickedId);
        if (parcel) {
          setSelectedParcel(parcel);
          map.flyTo({
            center: parcel.center,
            zoom: 16.5,
            pitch: 62,
            duration: 900
          });
        }
      });

      map.on('mouseenter', 'cadastre-extrusion', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'cadastre-extrusion', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
    };
  }, []);

  // Update pitch when 2D/3D switches
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

  const filteredParcels = SAMPLE_PARCELS.filter(p => {
    if (filterMode === 'ENCROACHED') return p.encroachmentPct > 0;
    if (filterMode === 'CRITICAL') return p.severity === 'SEVERE';
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.surveyNumber.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q) || p.zone.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className={styles.spatialWrapper}>
      {/* ── TOP CONTROL HUD BAR ── */}
      <header className={styles.topHudBar}>
        {/* Left Section: Opacity slider & Title */}
        <div className={styles.hudLeft}>
          <div className={styles.opacityControl}>
            <div className={styles.opacityLabel}>
              <span>OVERLAY OPACITY</span>
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
            <Building size={14} className={styles.badgeIcon} />
            <span>3D CADASTRAL MODEL</span>
          </div>
        </div>

        {/* Center Section: Search & Dropdowns */}
        <div className={styles.hudCenter}>
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search parcel ID, owner, survey..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div 
            className={styles.pillDropdown}
            style={{ cursor: 'pointer' }}
            title="Switch operational zone"
            onClick={() => {
              const cities: ('New Delhi' | 'Mumbai' | 'Kolkata' | 'Chennai')[] = ['New Delhi', 'Mumbai', 'Kolkata', 'Chennai'];
              const nextIdx = (cities.indexOf(selectedCity) + 1) % cities.length;
              setSelectedCity(cities[nextIdx]);
            }}
          >
            <MapPin size={13} className={styles.dropdownIcon} />
            <span>{selectedCity}</span>
            <ChevronDown size={13} />
          </div>

          <button
            className={`${styles.pillButton} ${basemap === 'SATELLITE' ? styles.pillActive : ''}`}
            onClick={() => handleBasemapChange(basemap === 'SATELLITE' ? 'STREETS' : 'SATELLITE')}
          >
            <Layers size={13} />
            <span>{basemap === 'SATELLITE' ? 'Satellite' : 'Streets'}</span>
          </button>

          <button
            className={`${styles.pillButton} ${orthoOverlay ? styles.pillActive : ''}`}
            onClick={() => setOrthoOverlay(!orthoOverlay)}
          >
            <span>ORTHO OVERLAY</span>
            <span className={styles.pillStatus}>{orthoOverlay ? 'ON' : 'OFF'}</span>
          </button>

          <button
            className={styles.pillDropdown}
            onClick={() => setFilterMode(filterMode === 'ALL' ? 'ENCROACHED' : filterMode === 'ENCROACHED' ? 'CRITICAL' : 'ALL')}
          >
            <span>SHOW {filterMode}</span>
            <ChevronDown size={13} />
          </button>

          {/* Quick Toggles */}
          <div className={styles.quickToggleGroup}>
            <button
              className={`${styles.quickBtn} ${showHeatmap ? styles.quickBtnActive : ''}`}
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              <Flame size={13} />
              <span>HEATMAP</span>
            </button>
            <button
              className={`${styles.quickBtn} ${showCadastre ? styles.quickBtnActive : ''}`}
              onClick={() => setShowCadastre(!showCadastre)}
            >
              <Eye size={13} />
              <span>CADASTRE</span>
            </button>
            <button
              className={`${styles.quickBtn} ${showNoise ? styles.quickBtnActive : ''}`}
              onClick={() => setShowNoise(!showNoise)}
            >
              <Volume2 size={13} />
              <span>NOISE</span>
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
              2D/3D COMPARE
            </button>
          </div>

          <div className={styles.tabGroup}>
            {(['ALERTS', 'SEISMIC', 'FORECAST', 'ACCESS', 'AERIAL'] as const).map(tab => (
              <button
                key={tab}
                className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN MAP & OPERATOR DASHBOARD VIEWPORT ── */}
      <div className={styles.mapViewport}>
        {/* Map Container */}
        <div ref={mapContainerRef} className={styles.mapCanvas} />

        {/* ── LEFT FLOATING OPERATOR DASHBOARD ── */}
        <aside className={styles.leftDashboard}>
          <div className={styles.dashHeader}>
            <div className={styles.dashTitleRow}>
              <h3>OPERATOR DASHBOARD</h3>
              <span className={styles.auditBadge}>6/9 Audited</span>
            </div>

            {/* Core Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><Building size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>TOTAL PARCELS</span>
                  <span className={styles.statNum}>9</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}><Maximize2 size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>TOTAL AREA</span>
                  <span className={styles.statNum}>2,772 m²</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.statIconWarning}`}><AlertTriangle size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>ENCROACHED AREA</span>
                  <span className={`${styles.statNum} ${styles.textWarning}`}>350 m²</span>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.statIconDanger}`}><Activity size={14} /></div>
                <div className={styles.statInfo}>
                  <span className={styles.statLabel}>ACTIVE ALERTS</span>
                  <span className={`${styles.statNum} ${styles.textDanger}`}>7</span>
                </div>
              </div>
            </div>
          </div>

          {/* Municipal Governance Metrics */}
          <div className={styles.dashSection}>
            <div className={styles.sectionHeading}>
              <span>MUNICIPAL GOVERNANCE METRICS</span>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricItem}>
                <Shield size={14} className={styles.textDanger} />
                <div>
                  <span className={styles.metricValue}>4</span>
                  <span className={styles.metricTitle}>HIGH / CRITICAL</span>
                </div>
              </div>
              <div className={styles.metricItem}>
                <FileText size={14} className={styles.textInfo} />
                <div>
                  <span className={styles.metricValue}>1</span>
                  <span className={styles.metricTitle}>NOTICES GENERATED</span>
                </div>
              </div>
              <div className={styles.metricItem}>
                <Activity size={14} className={styles.textWarning} />
                <div>
                  <span className={styles.metricValue}>2</span>
                  <span className={styles.metricTitle}>PENDING REVIEW</span>
                </div>
              </div>
              <div className={styles.metricItem}>
                <CheckCircle2 size={14} className={styles.textSuccess} />
                <div>
                  <span className={styles.metricValue}>0</span>
                  <span className={styles.metricTitle}>CASES RESOLVED</span>
                </div>
              </div>
            </div>

            <div className={styles.forecastBox}>
              <div className={styles.forecastRow}>
                <span>Forecasted Encroachments (6-12M):</span>
                <strong className={styles.textAccent}>2 parcels</strong>
              </div>
              <div className={styles.forecastRow}>
                <span>Seismic Screening Alerts:</span>
                <strong className={styles.textWarning}>3 structures</strong>
              </div>
            </div>
          </div>

          {/* Encroachment Severity Legend */}
          <div className={styles.legendBox}>
            <span className={styles.legendHeading}>ENCROACHMENT SEVERITY</span>
            <div className={styles.legendList}>
              <div className={styles.legendRow}>
                <span className={styles.swatchClean} />
                <span>Clean (&lt;1%)</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchMinor} />
                <span>Minor (&lt;5%)</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchMod} />
                <span>Moderate (5-20%)</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchSevere} />
                <span>Severe (&gt;20%)</span>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.swatchLine} />
                <span>Cadastral Registry Line</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT FLOATING SPATIAL INTELLIGENCE PANEL ── */}
        <aside className={styles.rightInspector}>
          <div className={styles.inspectorCard}>
            <div className={styles.inspectorHeader}>
              <div className={styles.insHeaderIcon}><Building size={16} /></div>
              <div>
                <h4>SPATIAL INTELLIGENCE</h4>
                <p>{selectedParcel ? selectedParcel.surveyNumber : 'Waiting for parcel selection'}</p>
              </div>
            </div>

            {selectedParcel ? (
              <div className={styles.parcelDetails}>
                <div className={styles.detailHeader}>
                  <span className={`${styles.severityBadge} ${styles['badge' + selectedParcel.severity]}`}>
                    {selectedParcel.severity} RISK
                  </span>
                  <span className={styles.parcelId}>{selectedParcel.id}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Owner Registry:</span>
                  <span className={styles.infoVal}>{selectedParcel.ownerName}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Zone Classification:</span>
                  <span className={styles.infoVal}>{selectedParcel.zone}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Total Area:</span>
                  <span className={styles.infoVal}>{selectedParcel.areaSqM} m²</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Encroached Area:</span>
                  <span className={`${styles.infoVal} ${styles.textWarning}`}>{selectedParcel.encroachedSqM} m² ({selectedParcel.encroachmentPct}%)</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Seismic Resistance:</span>
                  <span className={styles.infoVal}>{selectedParcel.seismicScore} / 10</span>
                </div>

                <div className={styles.actionButtons}>
                  <button className={styles.actionPrimary}>Dispatch Field Survey</button>
                  <button className={styles.actionSecondary}>Generate Notice</button>
                </div>
              </div>
            ) : (
              <div className={styles.emptyInspector}>
                <Compass size={28} className={styles.emptyIcon} />
                <h5>SELECT A PARCEL</h5>
                <p>Click any 3D parcel on the map to activate parcel-specific intelligence.</p>

                <div className={styles.miniStats}>
                  <div className={styles.miniBox}>
                    <span>PARCELS AVAILABLE</span>
                    <strong>9</strong>
                  </div>
                  <div className={styles.miniBox}>
                    <span>ACTIVE ALERTS</span>
                    <strong className={styles.textWarning}>7</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Bottom Corner Telemetry Footer */}
        <div className={styles.mapFooterStats}>
          <span>PARCELS: {filteredParcels.length}/{SAMPLE_PARCELS.length}</span>
          <span>FILTER: {filterMode}</span>
          <span>HEATMAP: {showHeatmap ? 'ON' : 'OFF'}</span>
        </div>
      </div>
    </div>
  );
};

export default SpatialIntelligence;
