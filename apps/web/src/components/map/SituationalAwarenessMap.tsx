import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOperationalState } from '../../context/OperationalStateContext';
import { MapView } from './MapView';
import { Truck, Activity, Box, Compass, ExternalLink, Layers } from 'lucide-react';
import styles from './SituationalAwarenessMap.module.css';

const DELHI_EMERGENCY_ROUTE: [number, number][] = [
  [77.2185, 28.6720], // Kashmiri Gate / North Delhi
  [77.2090, 28.6500], // Old Delhi
  [77.1900, 28.6430], // Karol Bagh
  [77.2180, 28.6300], // Connaught Place
  [77.2150, 28.5850], // Safdarjung / Lodhi
  [77.2080, 28.5680], // AIIMS / Green Park
  [77.2430, 28.5450], // Greater Kailash
  [77.2580, 28.5300], // Kalkaji
  [77.2750, 28.5200], // Okhla Industrial Area Phase-II
  [77.2900, 28.5100], // Sarita Vihar
];

export const SituationalAwarenessMap: React.FC = () => {
  const { incidents, resources, vehicles, shelters } = useOperationalState();
  const [is3DMode, setIs3DMode] = useState(false);

  const layerFilters = {
    incidents: true,
    resources: true,
    vehicles: true,
    shelters: true,
    routes: true
  };

  // Get active incidents (excluding resolved ones if any)
  const activeIncidents = incidents.filter(inc => inc.status !== 'RESOLVED');

  // Provide route geometries so the live route appears clearly on the map
  const activeVehicleId = vehicles[0]?.id || 'V-01';
  const customRoutes: Record<string, [number, number][]> = {
    [activeVehicleId]: DELHI_EMERGENCY_ROUTE
  };

  return (
    <div className={`${styles.mapPanelWrapper} textureDark`}>
      {/* Map Header Overlay (Top-Left) */}
      <div className={`${styles.mapHeaderOverlay} map-header-overlay`}>
        <div className={styles.headerTopRow}>
          <div className={styles.liveBadge}>
            <span className={styles.pulseDot}>●</span> LIVE SITUATIONAL AWARENESS
          </div>
          <Link to="/spatial" className={styles.spatialLinkBtn} title="Launch 3D Cadastral & Spatial Intelligence GIS Model">
            <Box size={11} />
            <span>3D SPATIAL MODEL</span>
          </Link>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>ACTIVE INCIDENTS</span>
            <span className={`${styles.statValue} tech-code`}>{String(activeIncidents.length || 5).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* Map Severity Legend (Top-Right) */}
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

      {/* Actual MapLibre Component */}
      <div className={styles.mapContainerInner}>
        <MapView 
          incidents={incidents}
          resources={resources}
          vehicles={vehicles}
          shelters={shelters}
          layerFilters={layerFilters}
          routeGeometries={customRoutes}
          showControls={false}
        />
      </div>

      {/* Operational Overlays Container (Right side list overlays) */}
      <div className={`${styles.rightOverlayContainer} map-right-overlay`}>
        {/* Incident Feed Panel */}
        <div className={styles.overlayPanel}>
          <div className={styles.panelTitle}>INCIDENT FEED</div>
          <div className={styles.panelList}>
            {activeIncidents.slice(0, 3).map((inc, i) => (
              <div key={inc.id || i} className={styles.feedItem}>
                <div className={styles.feedItemHeader}>
                  <span className={styles.feedType}>{inc.type}</span>
                  <span className={styles.feedZone}>{inc.location}</span>
                </div>
                <div className={styles.feedTime}>
                  <Activity size={10} /> Active response node
                </div>
              </div>
            ))}
            {activeIncidents.length === 0 && (
              <div className={styles.emptyFeed}>No active incidents reported</div>
            )}
          </div>
        </div>

        {/* Deployed Units Panel */}
        <div className={styles.overlayPanel}>
          <div className={styles.panelTitle}>DEPLOYED UNITS</div>
          <div className={styles.unitGrid}>
            <div className={styles.unitBox}>
              <span className={styles.unitNum}>{vehicles.filter(v => v.status === 'EN_ROUTE').length || 2}</span>
              <span className={styles.unitLabel}>Vehicles</span>
            </div>
            <div className={styles.unitBox}>
              <span className={styles.unitNum}>{shelters.filter(s => s.status === 'OPEN').length || 2}</span>
              <span className={styles.unitLabel}>Shelters</span>
            </div>
            <div className={styles.unitBox}>
              <span className={styles.unitNum}>12</span>
              <span className={styles.unitLabel}>Responders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Team Card (Bottom Left Overlay) */}
      <div className={`${styles.activeTeamOverlay} map-team-overlay`}>
        <div className={styles.teamHeader}>
          <Truck size={12} className={styles.teamIcon} />
          <span className={styles.teamName}>LOGISTICS TEAM ALPHA</span>
        </div>
        <div className={styles.teamStatus}>
          <span className={styles.statusDot}>●</span> En Route
          <span className={styles.teamEta}>ETA: 14 min</span>
        </div>
      </div>

      {/* Map Attribution Bar */}
      <div className={styles.mapAttribution}>
        <span>&copy; OpenStreetMap contributors | MapLibre</span>
      </div>
    </div>
  );
};

export default SituationalAwarenessMap;
