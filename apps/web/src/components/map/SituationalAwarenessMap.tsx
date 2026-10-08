import React from 'react';
import { useOperationalState } from '../../context/OperationalStateContext';
import { MapView } from './MapView';
import { Truck, Activity } from 'lucide-react';
import styles from './SituationalAwarenessMap.module.css';

export const SituationalAwarenessMap: React.FC = () => {
  const { incidents, resources, vehicles, shelters } = useOperationalState();

  const layerFilters = {
    incidents: true,
    resources: true,
    vehicles: true,
    shelters: true,
    routes: true
  };

  // Get active incidents (excluding resolved ones if any)
  const activeIncidents = incidents.filter(inc => inc.status !== 'RESOLVED');

  return (
    <div className={`${styles.mapPanelWrapper} textureDark`}>
      {/* Map Header Overlay (Top-Left) */}
      <div className={`${styles.mapHeaderOverlay} map-header-overlay`}>
        <div className={styles.liveBadge}>
          <span className={styles.pulseDot}>●</span> LIVE SITUATIONAL AWARENESS
        </div>
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>ACTIVE INCIDENTS</span>
            <span className={`${styles.statValue} tech-code`}>{String(activeIncidents.length).padStart(2, '0')}</span>
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

      {/* Actual MapLibre Component with showControls={false} to avoid overlay collision */}
      <div className={styles.mapContainerInner}>
        <MapView 
          incidents={incidents}
          resources={resources}
          vehicles={vehicles}
          shelters={shelters}
          layerFilters={layerFilters}
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
              <span className={styles.unitNum}>{vehicles.filter(v => v.status === 'EN_ROUTE').length || 4}</span>
              <span className={styles.unitLabel}>Vehicles</span>
            </div>
            <div className={styles.unitBox}>
              <span className={styles.unitNum}>{shelters.filter(s => s.status === 'OPEN').length || 3}</span>
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
    </div>
  );
};
export default SituationalAwarenessMap;
