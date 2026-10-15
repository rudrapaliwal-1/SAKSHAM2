import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOperationalState } from '../../context/OperationalStateContext';
import { MapView, type BasemapMode } from './MapView';
import type { Incident } from '../../types/incident';
import type { Vehicle } from '../../types/vehicle';
import {
  Truck,
  Activity,
  Box,
  ChevronRight,
  Gauge,
  Volume2,
  VolumeX,
  Radio,
  Navigation,
  Compass,
  ArrowRight
} from 'lucide-react';
import { tacticalAudio } from '../../utils/tacticalAudio';
import styles from './SituationalAwarenessMap.module.css';

// Primary Road-Following Emergency Route (North Delhi Embankment -> Central Delhi -> Okhla Phase II)
const DELHI_EMERGENCY_ROUTE: [number, number][] = [
  [77.2185, 28.6720], // Kashmiri Gate / North Delhi Embankment
  [77.2090, 28.6500], // Old Delhi Railway Junction
  [77.1900, 28.6430], // Karol Bagh Logistics Link
  [77.2180, 28.6300], // Connaught Place Outer Circle
  [77.2150, 28.5850], // Safdarjung / Lodhi Estate
  [77.2080, 28.5680], // AIIMS Trauma Center Depot
  [77.2430, 28.5450], // Greater Kailash Flyover
  [77.2580, 28.5300], // Kalkaji Junction
  [77.2750, 28.5200], // Okhla Industrial Area Phase-II
  [77.2900, 28.5100], // Sarita Vihar Relief Depot
];

// Contingency Evacuation & Alternative Route Corridor
const DELHI_CONTINGENCY_ROUTE: [number, number][] = [
  [77.2750, 28.5200], // Okhla Industrial Area Phase-II
  [77.2900, 28.5100], // Sarita Vihar
  [77.3020, 28.4950], // Badarpur Border Staging Base
  [77.3180, 28.4750], // Faridabad Relief Staging Corridor
];

const YAMUNA_EVACUATION_CORRIDOR: [number, number][] = [
  [77.2315, 28.6692], // Kashmiri Gate
  [77.2550, 28.6580], // Geeta Colony Ghat
  [77.2880, 28.6300], // Vikas Marg Corridor
  [77.2980, 28.5910], // Mayur Vihar Khadar Base
];

export const SituationalAwarenessMap: React.FC = () => {
  const {
    incidents,
    resources,
    vehicles,
    shelters,
    responders = [],
    hazardZones = []
  } = useOperationalState();

  const [basemap, setBasemap] = useState<BasemapMode>('SATELLITE_HYBRID');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [hoveredIncidentId, setHoveredIncidentId] = useState<string | null>(null);
  const [isFeedCollapsed, setIsFeedCollapsed] = useState(false);

  // Tactical interactivity states
  const [feedFilter, setFeedFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [feedSearch, setFeedSearch] = useState('');
  const [isTelemetryExpanded, setIsTelemetryExpanded] = useState(false);
  const [activeTrackingVehicleId, setActiveTrackingVehicleId] = useState<string | null>(null);
  const [useContingencyRoute, setUseContingencyRoute] = useState(false);
  const [radioPingStatus, setRadioPingStatus] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(tacticalAudio.getMuted());
  const [liveTelemetry, setLiveTelemetry] = useState<{
    speedKmh: number;
    headingDeg: number;
    distanceRemainingKm: number;
    etaMin: number;
    progressPct: number;
  }>({
    speedKmh: 48,
    headingDeg: 142,
    distanceRemainingKm: 6.2,
    etaMin: 14,
    progressPct: 35
  });

  const layerFilters = useMemo(() => ({
    incidents: true,
    resources: true,
    vehicles: true,
    shelters: true,
    routes: true,
    responders: true,
    hazardZones: true
  }), []);

  // Filter active incidents
  const activeIncidents = useMemo(() => 
    incidents.filter(inc => inc.status !== 'RESOLVED'),
    [incidents]
  );

  // Filter feed incidents with priority chips & search query
  const filteredFeedIncidents = useMemo(() => {
    return activeIncidents.filter(inc => {
      if (feedFilter !== 'ALL' && inc.severity !== feedFilter) return false;
      if (feedSearch.trim()) {
        const q = feedSearch.toLowerCase();
        return (
          inc.location.toLowerCase().includes(q) ||
          inc.type.toLowerCase().includes(q) ||
          inc.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeIncidents, feedFilter, feedSearch]);

  // Active fleet statistics
  const enRouteVehicles = useMemo(() => 
    vehicles.filter(v => v.status === 'EN_ROUTE' || v.status === 'DISPATCHED'),
    [vehicles]
  );

  const activeShelters = useMemo(() => 
    shelters.filter(s => s.status === 'OPEN'),
    [shelters]
  );

  // Road-following route geometries
  const activeVehicle = vehicles[0] || { id: 'VEH-TRK-101', name: 'Logistics Team Alpha' };
  const activeVehicleId = activeVehicle.id;

  const customRoutes: Record<string, [number, number][]> = {
    [activeVehicleId]: useContingencyRoute ? DELHI_CONTINGENCY_ROUTE : DELHI_EMERGENCY_ROUTE,
    ...(vehicles[1] ? { [vehicles[1].id]: YAMUNA_EVACUATION_CORRIDOR } : {})
  };

  const alternativeRoutes: Record<string, [number, number][]> = {
    'contingency-corridor-1': useContingencyRoute ? DELHI_EMERGENCY_ROUTE : DELHI_CONTINGENCY_ROUTE
  };

  const handleIncidentClick = (incident: Incident) => {
    setSelectedIncident(incident);
    setSelectedVehicle(null);
    tacticalAudio.playRadarPing();
  };

  const handleVehicleClick = () => {
    if (vehicles[0]) {
      setSelectedVehicle(vehicles[0]);
      setSelectedIncident(null);
      setIsTelemetryExpanded(prev => !prev);
      tacticalAudio.playRadarPing();
    }
  };

  const handleRadioPing = (e: React.MouseEvent) => {
    e.stopPropagation();
    tacticalAudio.playDispatchConfirm();
    setRadioPingStatus('ACK 200 OK · 24ms (Signal: -68 dBm)');
    setTimeout(() => setRadioPingStatus(null), 3500);
  };

  return (
    <div className={`${styles.mapPanelWrapper} textureDark`}>
      {/* ─── Top-Left Overlay: Status & Operational Counters ─── */}
      <div className={`${styles.mapHeaderOverlay} map-header-overlay`}>
        <div className={styles.headerTopRow}>
          <div className={styles.liveBadge}>
            <span className={styles.pulseDot}>●</span> LIVE SITUATIONAL AWARENESS
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.audioToggleBtn} ${isAudioMuted ? styles.audioToggleBtnMuted : ''}`}
              onClick={() => setIsAudioMuted(tacticalAudio.toggleMute())}
              title={isAudioMuted ? "Unmute Tactical Sound FX" : "Mute Tactical Sound FX"}
            >
              {isAudioMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
              <span>{isAudioMuted ? 'MUTED' : 'AUDIO'}</span>
            </button>
            <Link
              to="/spatial"
              className={styles.spatialLinkBtn}
              title="Launch 3D Cadastral & Spatial Intelligence GIS Model"
            >
              <Box size={11} />
              <span>3D SPATIAL MODEL</span>
            </Link>
          </div>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>ACTIVE INCIDENTS</span>
            <span className={`${styles.statValue} tech-code`}>
              {String(activeIncidents.length || 5).padStart(2, '0')}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>DEPLOYED FLEET</span>
            <span className={`${styles.statValue} tech-code`} style={{ color: '#38bdf8' }}>
              {String(enRouteVehicles.length || 2).padStart(2, '0')}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>ACTIVE SHELTERS</span>
            <span className={`${styles.statValue} tech-code`} style={{ color: '#34d399' }}>
              {String(activeShelters.length || 2).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Top-Right Overlays: Basemap Switcher & Severity Legend ─── */}
      <div className={styles.topRightControls}>
        <div className={styles.topRowBar}>
          <div className={styles.basemapSwitcher}>
            <button
              type="button"
              className={`${styles.basemapBtn} ${basemap === 'SATELLITE_HYBRID' ? styles.basemapBtnActive : ''}`}
              onClick={() => setBasemap('SATELLITE_HYBRID')}
              title="Satellite Reconnaissance + Road Infrastructure"
            >
              🛰️ SATELLITE
            </button>
            <button
              type="button"
              className={`${styles.basemapBtn} ${basemap === 'TACTICAL_DARK' ? styles.basemapBtnActive : ''}`}
              onClick={() => setBasemap('TACTICAL_DARK')}
              title="Dark Tactical Common Operating Picture"
            >
              🌑 TACTICAL
            </button>
            <button
              type="button"
              className={`${styles.basemapBtn} ${basemap === 'STREETS' ? styles.basemapBtnActive : ''}`}
              onClick={() => setBasemap('STREETS')}
              title="Navigation Streets Vector Style"
            >
              🗺️ STREETS
            </button>
          </div>

          <div className={`${styles.legendOverlay} map-legend-overlay`}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotCritical}`}>●</span> CRITICAL
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotWarning}`}>●</span> HIGH
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotSuccess}`}>●</span> LOW
            </div>
          </div>
        </div>
      </div>

      {/* ─── MapLibre Core Component ─── */}
      <div className={styles.mapContainerInner}>
        <MapView
          incidents={incidents}
          resources={resources}
          vehicles={vehicles}
          shelters={shelters}
          responders={responders}
          hazardZones={hazardZones}
          layerFilters={layerFilters}
          routeGeometries={customRoutes}
          alternativeRouteGeometries={alternativeRoutes}
          selectedIncident={selectedIncident}
          selectedVehicle={selectedVehicle}
          hoveredIncidentId={hoveredIncidentId}
          defaultBasemap={basemap}
          onBasemapChange={setBasemap}
          onSelectIncident={handleIncidentClick}
          onSelectVehicle={(veh) => {
            setSelectedVehicle(veh);
            setIsTelemetryExpanded(true);
            tacticalAudio.playRadarPing();
          }}
          showControls={true}
          showBasemapSelector={false}
          showTacticalGrid={true}
          showResponseRings={true}
          showRadarSweep={true}
          simulateFleetMovement={true}
          activeTrackingVehicleId={activeTrackingVehicleId}
          onVehicleTelemetryUpdate={(vehId, tel) => {
            if (vehId === activeVehicleId) {
              setLiveTelemetry(tel);
            }
          }}
        />
      </div>

      {/* ─── Right Overlay Container: Incident Feed & Deployed Units ─── */}
      <div className={`${styles.rightOverlayContainer} map-right-overlay ${isFeedCollapsed ? styles.rightOverlayCollapsed : ''}`}>
        {/* Incident Feed Panel */}
        <div className={styles.overlayPanel}>
          <div
            className={styles.panelTitle}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title="Click to collapse / expand feed"
            onClick={() => setIsFeedCollapsed(prev => !prev)}
          >
            <span>INCIDENT FEED</span>
            <span className={styles.panelBadge}>{activeIncidents.length} LIVE</span>
          </div>

          {/* Search bar inside feed */}
          <div className={styles.feedSearchBox}>
            <input
              type="text"
              placeholder="Search active incident..."
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              className={styles.feedSearchInput}
            />
          </div>

          {/* Priority filter chips */}
          <div className={styles.feedFilterBar}>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(f => (
              <button
                key={f}
                type="button"
                className={`${styles.feedFilterChip} ${feedFilter === f ? styles.feedFilterChipActive : ''}`}
                onClick={() => setFeedFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className={styles.panelList}>
            {filteredFeedIncidents.slice(0, 3).map((inc, i) => {
              const severityClass = inc.severity === 'CRITICAL'
                ? styles.feedItemCritical
                : inc.severity === 'HIGH'
                  ? styles.feedItemHigh
                  : styles.feedItemMedium;

              return (
                <div
                  key={inc.id || i}
                  className={`${styles.feedItem} ${severityClass}`}
                  onClick={() => handleIncidentClick(inc)}
                  onMouseEnter={() => setHoveredIncidentId(inc.id)}
                  onMouseLeave={() => setHoveredIncidentId(null)}
                  title="Click to focus coordinate on map"
                >
                  <div className={styles.feedItemHeader}>
                    <span className={styles.feedType}>{inc.type.replace(/_/g, ' ')}</span>
                    <span className={styles.feedTimeAgo}>42m ago</span>
                  </div>
                  <span className={styles.feedZone}>{inc.location}</span>
                  <div className={styles.feedActionRow}>
                    <div className={styles.feedTime}>
                      <Activity size={10} /> Active node
                    </div>
                    <Link
                      to="/operations/incidents"
                      className={styles.feedActionLink}
                      onClick={(e) => e.stopPropagation()}
                      title="Dispatch rescue units"
                    >
                      <span>Dispatch</span>
                      <ArrowRight size={9} />
                    </Link>
                  </div>
                </div>
              );
            })}
            {filteredFeedIncidents.length === 0 && (
              <div className={styles.emptyFeed}>No matching incidents found</div>
            )}
          </div>
        </div>

        {/* Deployed Units Panel */}
        <div className={styles.overlayPanel}>
          <div className={styles.panelTitle}>DEPLOYED UNITS</div>
          <div className={styles.unitGrid}>
            <div className={styles.unitBox}>
              <span className={styles.unitNum} style={{ color: '#38bdf8' }}>
                {enRouteVehicles.length || 2}
              </span>
              <span className={styles.unitLabel}>Vehicles</span>
            </div>
            <div className={styles.unitBox}>
              <span className={styles.unitNum} style={{ color: '#34d399' }}>
                {activeShelters.length || 2}
              </span>
              <span className={styles.unitLabel}>Shelters</span>
            </div>
            <div className={styles.unitBox}>
              <span className={styles.unitNum} style={{ color: '#c084fc' }}>
                {responders.length || 12}
              </span>
              <span className={styles.unitLabel}>Responders</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom-Left Active Logistics Team Card & Cockpit ─── */}
      <div
        className={`${styles.activeTeamOverlay} ${isTelemetryExpanded ? styles.activeTeamOverlayExpanded : ''} map-team-overlay`}
        onClick={handleVehicleClick}
        title="Click to expand / collapse full telemetry cockpit"
      >
        <div className={styles.teamHeader}>
          <div className={styles.teamTitleGroup}>
            <Truck size={13} className={styles.teamIcon} />
            <span className={styles.teamName}>{activeVehicle.name?.toUpperCase() || 'LOGISTICS TEAM ALPHA'}</span>
          </div>
          <ChevronRight size={12} color="#94a3b8" style={{ transform: isTelemetryExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        <div className={styles.teamStatus}>
          <div className={styles.statusLivePill}>
            <span className={styles.statusDot}>●</span> En Route
          </div>
          <span className={styles.teamEta}>ETA: ~{liveTelemetry.etaMin} min</span>
        </div>

        {/* Route progress track */}
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${liveTelemetry.progressPct}%` }} />
        </div>

        {/* Expanded Cockpit Gauges */}
        {isTelemetryExpanded ? (
          <>
            <div className={styles.cockpitGaugesGrid}>
              <div className={styles.gaugeCard}>
                <span className={styles.gaugeLabel}>Speed</span>
                <span className={styles.gaugeValue}>{liveTelemetry.speedKmh} <small style={{ fontSize: '8px' }}>km/h</small></span>
              </div>
              <div className={styles.gaugeCard}>
                <span className={styles.gaugeLabel}>Remaining</span>
                <span className={styles.gaugeValue}>{liveTelemetry.distanceRemainingKm} <small style={{ fontSize: '8px' }}>km</small></span>
              </div>
              <div className={styles.gaugeCard}>
                <span className={styles.gaugeLabel}>Bearing</span>
                <span className={styles.gaugeValue}>{liveTelemetry.headingDeg}°</span>
              </div>
            </div>

            <div className={styles.teamTelemetryRow}>
              <span>Cargo: <strong style={{ color: '#f3f4f6' }}>400 Thermal Blankets</strong></span>
            </div>

            {/* Tactical Convoy Actions */}
            <div className={styles.cockpitActions}>
              <button
                type="button"
                className={`${styles.cockpitBtn} ${activeTrackingVehicleId ? styles.cockpitBtnActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTrackingVehicleId(activeTrackingVehicleId ? null : activeVehicleId);
                  tacticalAudio.playRadarPing();
                }}
                title="Follow vehicle position with map camera"
              >
                <Navigation size={10} />
                <span>{activeTrackingVehicleId ? 'Tracking Cam' : 'Follow Convoy'}</span>
              </button>

              <button
                type="button"
                className={`${styles.cockpitBtn} ${useContingencyRoute ? styles.cockpitBtnActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setUseContingencyRoute(!useContingencyRoute);
                  tacticalAudio.playRadarPing();
                }}
                title="Toggle between Primary and Contingency route corridors"
              >
                <Compass size={10} />
                <span>{useContingencyRoute ? 'Contingency' : 'Primary'}</span>
              </button>

              <button
                type="button"
                className={styles.cockpitBtn}
                onClick={handleRadioPing}
                title="Transmit telemetry check to convoy radio mesh"
              >
                <Radio size={10} />
                <span>Ping</span>
              </button>
            </div>

            {radioPingStatus && (
              <div className={styles.radioPingBadge}>
                <span>📡 {radioPingStatus}</span>
              </div>
            )}
          </>
        ) : (
          <div className={styles.teamTelemetryRow}>
            <div className={styles.telemetryItem}>
              <Gauge size={10} />
              <span>Speed: <strong className={styles.telemetryHighlight}>{liveTelemetry.speedKmh} km/h</strong></span>
            </div>
            <div className={styles.telemetryItem}>
              <span>Remaining: <strong style={{ color: '#f3f4f6' }}>{liveTelemetry.distanceRemainingKm} km</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Map Attribution Bar ─── */}
      <div className={styles.mapAttribution}>
        <span>&copy; Esri &middot; Maxar &middot; OpenStreetMap &middot; MapLibre</span>
      </div>
    </div>
  );
};

export default SituationalAwarenessMap;
