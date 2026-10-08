import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { MapView } from '../../components/map/MapView';
import { useOperationalState } from '../../context/OperationalStateContext';
import {
  Layers,
  ChevronRight,
  MapPin,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Zap,
  Truck,
  Shield,
  Clock,
  Package,
  Activity,
  TrendingUp,
} from 'lucide-react';
import styles from './CommandCenter.module.css';

import GradientBackground from '../../components/ui/noisy-gradient-backgrounds';
import { PageGuideTrigger, PageGuidebook } from '../../components/ui/PageGuide';
import { ShaderBackground } from '../../components/ui/ShaderBackground';

const fmtTimeAgo = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
};

// ─── Smooth CountUp Hook ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1500, triggerStart = false) {
  const [value, setValue] = useState(0);
  const useRefTarget = useRef(target);
  useRefTarget.current = target;

  useEffect(() => {
    if (!triggerStart) return;
    let frame = 0;
    const totalFrames = Math.ceil(duration / 16);
    const timer = setInterval(() => {
      frame++;
      const progress = gsap.parseEase('power2.out')(frame / totalFrames);
      setValue(Math.round(useRefTarget.current * progress));
      if (frame >= totalFrames) {
        setValue(useRefTarget.current);
        clearInterval(timer);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, triggerStart]);

  return value;
}

export const CommandCenter: React.FC = () => {
  const {
    incidents,
    vehicles,
    resources,
    shelters,
    requests,
    missions,
    hospitals,
    responders,
    hazardZones,
    auditLogs,
    alerts,
    dataMode,
    resetToDemoDataset,
  } = useOperationalState();

  const [layerFilters, setLayerFilters] = useState({
    incidents: true,
    demands: true,
    resources: true,
    vehicles: true,
    shelters: true,
    hospitals: true,
    responders: true,
    routes: true,
    hazardZones: true,
  });
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'incident' | 'vehicle' | 'shelter' | 'demand' | 'resource' | 'hospital' | 'responder'; obj: any } | null>(null);

  // Animation trigger state
  const [statsAnimated, setStatsAnimated] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);

  // Close layers popover on outside click
  useEffect(() => {
    if (!isLayersOpen) return;
    const handler = (e: MouseEvent) => {
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) {
        setIsLayersOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isLayersOpen]);

  // ─── Computed Application KPIs & Real Data Metrics ──────────────────────────
  const operationalSummary = useMemo(() => {
    const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED');
    const criticalIncidents = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'RESOLVED');
    const totalCasualties = incidents.reduce((a, i) => a + (i.casualtiesCount || 0), 0);
    const totalAffected = incidents.reduce((a, i) => a + (i.peopleAffected || i.displacedCount || 0), 0);

    const pendingDemands = requests.filter(r => r.status === 'PENDING' || r.status === 'OPEN');
    const criticalDemands = requests.filter(r => r.priority === 'CRITICAL' && (r.status === 'PENDING' || r.status === 'OPEN'));
    const unfulfilledDemandTotalQty = requests
      .filter(r => r.status === 'PENDING' || r.status === 'OPEN' || r.status === 'MATCHED')
      .reduce((a, r) => a + (r.quantity || 0), 0);

    const availableRes = resources.filter(r => r.status === 'AVAILABLE');
    const availableResourceStock = availableRes.reduce((a, r) => a + (r.quantity || 0), 0);
    const allocatedResourceStock = resources.reduce((a, r) => a + (r.allocatedQuantity || 0), 0);

    const activeMissions = missions.filter(m => m.status === 'EN_ROUTE' || m.status === 'DISPATCHED' || m.status === 'ARRIVED');
    const missionsEnRoute = missions.filter(m => m.status === 'EN_ROUTE');
    const resourcesDeployedInTransit = activeMissions.reduce((a, m) => a + (m.quantity || 0), 0);

    const totalCap = shelters.reduce((a, s) => a + s.capacityTotal, 0);
    const occupied = shelters.reduce((a, s) => a + s.capacityOccupied, 0);
    const shelterPct = totalCap > 0 ? Math.round((occupied / totalCap) * 100) : 0;

    const respondersDeployed = responders.filter(r => r.status === 'ON_MISSION' || r.status === 'ON_DUTY');

    // Dynamically computed response time and resolution rate
    const avgResponseTime = missions.length > 0
      ? (missions.reduce((a, m) => a + (m.etaMinutes || 15), 0) / missions.length).toFixed(1)
      : '14.8';

    const totalCasesCount = (incidents.length + requests.length) || 1;
    const resolvedCasesCount = incidents.filter(i => i.status === 'RESOLVED').length +
      requests.filter(r => r.status === 'FULFILLED').length;
    const resolutionRate = Math.round((resolvedCasesCount / totalCasesCount) * 100);

    // Primary active geographic zones
    const primaryZones = Array.from(new Set([
      ...incidents.map(i => i.location.split(',')[0].trim()),
      ...hazardZones.map(h => h.name.split('(')[0].trim())
    ])).slice(0, 3);

    return {
      activeIncidentsCount: activeIncidents.length,
      criticalIncidentsCount: criticalIncidents.length,
      totalCasualties,
      totalAffected,
      pendingDemandsCount: pendingDemands.length,
      criticalDemandsCount: criticalDemands.length,
      unfulfilledDemandTotalQty,
      availableDepotsCount: availableRes.length,
      availableResourceStock,
      allocatedResourceStock,
      activeMissionsCount: activeMissions.length,
      missionsEnRouteCount: missionsEnRoute.length,
      resourcesDeployedInTransit,
      shelterPct,
      totalCap,
      occupied,
      respondersDeployedCount: respondersDeployed.length,
      avgResponseTime,
      resolutionRate,
      resolvedCasesCount,
      totalCasesCount,
      primaryZones,
    };
  }, [incidents, requests, resources, missions, shelters, responders, hazardZones]);

  // Top urgent active incidents
  const topIncidents = useMemo(() => {
    return incidents
      .filter(i => i.status !== 'RESOLVED')
      .slice(0, 5);
  }, [incidents]);

  // Unfulfilled critical demands
  const urgentDemands = useMemo(() => {
    return requests
      .filter(r => r.status === 'PENDING' || r.status === 'MATCHED')
      .slice(0, 4);
  }, [requests]);

  // CountUp animated values
  const activeIncVal = useCountUp(operationalSummary.activeIncidentsCount, 1400, statsAnimated);
  const critDemVal = useCountUp(operationalSummary.criticalDemandsCount, 1400, statsAnimated);
  const unfulfDemVal = useCountUp(operationalSummary.unfulfilledDemandTotalQty, 1400, statsAnimated);
  const availStockVal = useCountUp(operationalSummary.availableResourceStock, 1400, statsAnimated);
  const activeMissionsVal = useCountUp(operationalSummary.activeMissionsCount, 1400, statsAnimated);
  const deployedStockVal = useCountUp(operationalSummary.resourcesDeployedInTransit, 1400, statsAnimated);
  const shelterPctVal = useCountUp(operationalSummary.shelterPct, 1400, statsAnimated);

  // ─── GSAP Entrance Animations ──────────────────────────────────────────────
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setStatsAnimated(true);
      return;
    }

    const ctx = gsap.context(() => {
      setStatsAnimated(true);
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      heroTl
        .fromTo(
          `.${styles.heroSubtitle}`,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.5 }
        )
        .fromTo(
          `.${styles.heroTitle}`,
          { clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0% 100%)', y: 30 },
          { clipPath: 'polygon(0 0%, 100% 0%, 100% 100%, 0% 100%)', y: 0, duration: 0.8 },
          '-=0.3'
        )
        .fromTo(
          `.${styles.heroLead}`,
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.5 },
          '-=0.3'
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <GradientBackground />

      {/* ─── 1. EDITORIAL HERO & STATUS HEADER ─── */}
      <section ref={heroRef} className={`${styles.heroSection} shaderHeaderWrapper`}>
        <ShaderBackground className="absolute inset-0" />
        <div className={styles.heroHeader}>
          <div className={styles.heroTitles}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span className={styles.heroSubtitle} style={{ marginBottom: 0 }}>
                SAKSHAM DISASTER COMMAND CENTER
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '3px 9px',
                  borderRadius: '4px',
                  backgroundColor: dataMode === 'LIVE_BACKEND' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(232, 111, 22, 0.2)',
                  color: dataMode === 'LIVE_BACKEND' ? '#10B981' : '#FFAE73',
                  border: `1px solid ${dataMode === 'LIVE_BACKEND' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(232, 111, 22, 0.4)'}`,
                }}
              >
                {dataMode === 'LIVE_BACKEND' ? '● LIVE CENTRAL API FEED' : '● SIMULATED DISASTER DEMO (DELHI NCR)'}
              </span>
              <PageGuideTrigger />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h1 className={`${styles.heroTitle} reveal-block`} data-reveal-color="#F47C20">
                Unified Emergency Common Operating Picture
              </h1>
            </div>
            <p className={styles.heroLead}>
              Real-time multi-agency situational intelligence matching verified disaster relief requests, medical stockpile depots, active logistics convoys, and emergency shelter perimeters across Delhi NCR.
            </p>
          </div>

          <div className={styles.heroStatus} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={styles.statusDotPulse} />
              <div className={styles.statusDetails}>
                <span className={styles.statusLabel}>NATIONAL CRISIS COORDINATION</span>
                <span className={styles.syncLabel}>LEVEL 1 RED ALERT · ACTIVE</span>
              </div>
            </div>
            <button
              onClick={resetToDemoDataset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FAF8F3',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Reset all incidents, requests, and fleet positions to initial Delhi scenario"
            >
              <RotateCcw size={12} />
              <span>RESET DEMO DATASET</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── 2. THE 6 CORE OPERATIONAL INTELLIGENCE QUESTIONS ─── */}
      <section className={styles.opQuestionsGrid}>
        {/* Q1: WHAT IS HAPPENING? */}
        <div className={styles.opQuestionCard}>
          <div className={styles.opQuestionHeader}>
            <span className={styles.opQuestionIcon}><Activity size={14} /></span>
            <span className={styles.opQuestionTitle}>1. WHAT IS HAPPENING?</span>
          </div>
          <div className={styles.opQuestionHeadline}>
            {operationalSummary.activeIncidentsCount} Active Disaster Incidents ({operationalSummary.criticalIncidentsCount} Critical)
          </div>
          <p className={styles.opQuestionDetail}>
            Major river Yamuna breach inundating Kashmiri Gate lowlands alongside structural collapse in Okhla Phase II and industrial fire.
          </p>
        </div>

        {/* Q2: WHERE? */}
        <div className={styles.opQuestionCard}>
          <div className={styles.opQuestionHeader}>
            <span className={styles.opQuestionIcon}><MapPin size={14} /></span>
            <span className={styles.opQuestionTitle}>2. WHERE?</span>
          </div>
          <div className={styles.opQuestionHeadline}>
            {operationalSummary.primaryZones.join(' · ') || 'Delhi NCR Emergency Grid'}
          </div>
          <p className={styles.opQuestionDetail}>
            Active epicenter: 28.6139° N, 77.2090° E. Arterial supply transit via Ring Road Bypass and Barapullah elevated corridor.
          </p>
        </div>

        {/* Q3: HOW SEVERE? */}
        <div className={styles.opQuestionCard}>
          <div className={styles.opQuestionHeader}>
            <span className={styles.opQuestionIcon}><AlertTriangle size={14} /></span>
            <span className={styles.opQuestionTitle}>3. HOW SEVERE?</span>
          </div>
          <div className={styles.opQuestionHeadline} style={{ color: '#EF4444' }}>
            CRITICAL THREAT · {operationalSummary.totalCasualties} Casualties · ~{operationalSummary.totalAffected.toLocaleString()} Displaced
          </div>
          <p className={styles.opQuestionDetail}>
            High trauma priority with rising water levels in lowlands; 80% casualty triage routed to AIIMS and LNJP Trauma Centers.
          </p>
        </div>

        {/* Q4: WHAT NEEDS ACTION? */}
        <div className={styles.opQuestionCard}>
          <div className={styles.opQuestionHeader}>
            <span className={styles.opQuestionIcon}><Zap size={14} /></span>
            <span className={styles.opQuestionTitle}>4. WHAT NEEDS ACTION?</span>
          </div>
          <div className={styles.opQuestionHeadline} style={{ color: '#FFAE73' }}>
            {operationalSummary.criticalDemandsCount} Critical Demands · {operationalSummary.pendingDemandsCount} Unallocated Demands
          </div>
          <p className={styles.opQuestionDetail}>
            Trauma triage kits, inflatable rescue boats, and high-capacity water filtration units awaiting matching & dispatch.
          </p>
        </div>

        {/* Q5: WHAT IS AVAILABLE? */}
        <div className={styles.opQuestionCard}>
          <div className={styles.opQuestionHeader}>
            <span className={styles.opQuestionIcon}><Package size={14} /></span>
            <span className={styles.opQuestionTitle}>5. WHAT IS AVAILABLE?</span>
          </div>
          <div className={styles.opQuestionHeadline} style={{ color: '#10B981' }}>
            {operationalSummary.availableResourceStock.toLocaleString()} Available Material Units · {operationalSummary.totalCap.toLocaleString()} Shelter Beds
          </div>
          <p className={styles.opQuestionDetail}>
            Stockpiled across {operationalSummary.availableDepotsCount} verified logistics depots; regional shelter load at {shelterPctVal}%.
          </p>
        </div>

        {/* Q6: WHAT IS CURRENTLY DEPLOYED? */}
        <div className={styles.opQuestionCard}>
          <div className={styles.opQuestionHeader}>
            <span className={styles.opQuestionIcon}><Truck size={14} /></span>
            <span className={styles.opQuestionTitle}>6. WHAT IS DEPLOYED?</span>
          </div>
          <div className={styles.opQuestionHeadline} style={{ color: '#3B82F6' }}>
            {operationalSummary.activeMissionsCount} Active Convoy Missions · {operationalSummary.resourcesDeployedInTransit.toLocaleString()} Units In Transit
          </div>
          <p className={styles.opQuestionDetail}>
            {operationalSummary.respondersDeployedCount} deployed field personnel across NDRF, Delhi EMS, and SDRF Boat Units.
          </p>
        </div>
      </section>

      {/* ─── 3. CRITICAL OPERATIONAL ALERTS FEED ─── */}
      {alerts.length > 0 && (
        <section className={styles.alertsContainer}>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`${styles.alertBanner} ${alert.severity === 'HIGH' ? styles.alertBannerHigh : ''}`}
            >
              <div className={styles.alertContent}>
                <AlertTriangle size={15} color={alert.severity === 'CRITICAL' ? '#EF4444' : '#FFAE73'} />
                <div>
                  <span className={styles.alertTitle}>{alert.title}</span>
                  <span className={styles.alertMsg}> &mdash; {alert.message}</span>
                </div>
              </div>
              {alert.actionPath && (
                <Link to={alert.actionPath} className={styles.alertActionBtn}>
                  <span>TAKE ACTION</span>
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ─── 4. INTERACTIVE APPLICATION KPI MATRIX (8 Dynamic Metrics) ─── */}
      <section ref={statsRef} className={styles.kpiSection}>
        <div className={styles.kpiGrid}>
          {/* KPI 1: Active Incidents */}
          <Link to="/operations/incidents" className={styles.kpiCard} title="Click to view all active incident cases">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>ACTIVE INCIDENTS</span>
              <AlertTriangle size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue} style={{ color: operationalSummary.criticalIncidentsCount > 0 ? '#EF4444' : '#FAF8F3' }}>
              {String(activeIncVal).padStart(2, '0')}
            </div>
            <div className={styles.kpiSub}>
              <span>{operationalSummary.criticalIncidentsCount} Critical Threats</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* KPI 2: Critical Requests */}
          <Link to="/operations/demands" className={styles.kpiCard} title="Click to view urgent demand requests">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>CRITICAL REQUESTS</span>
              <Zap size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue} style={{ color: '#FFAE73' }}>
              {String(critDemVal).padStart(2, '0')}
            </div>
            <div className={styles.kpiSub}>
              <span>{operationalSummary.pendingDemandsCount} Total Pending Demands</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* KPI 3: Unfulfilled Demand */}
          <Link to="/operations/demands" className={styles.kpiCard} title="Click to inspect unallocated demand volume">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>UNFULFILLED DEMAND</span>
              <Package size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue}>
              {unfulfDemVal.toLocaleString()}
            </div>
            <div className={styles.kpiSub}>
              <span>Material Units Needed</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* KPI 4: Available Resources */}
          <Link to="/operations/resources" className={styles.kpiCard} title="Click to view supply depot inventory">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>AVAILABLE RESOURCES</span>
              <CheckCircle size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue} style={{ color: '#10B981' }}>
              {availStockVal.toLocaleString()}
            </div>
            <div className={styles.kpiSub}>
              <span>Stock Units Across {operationalSummary.availableDepotsCount} Depots</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* KPI 5: Active Missions */}
          <Link to="/operations/dispatch" className={styles.kpiCard} title="Click to view dispatch control board">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>ACTIVE MISSIONS</span>
              <Truck size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue} style={{ color: '#3B82F6' }}>
              {String(activeMissionsVal).padStart(2, '0')}
            </div>
            <div className={styles.kpiSub}>
              <span>{operationalSummary.missionsEnRouteCount} En Route to Destinations</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* KPI 6: Resources Deployed */}
          <Link to="/operations/reconciliation" className={styles.kpiCard} title="Click to inspect relief deliveries">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>RESOURCES DEPLOYED</span>
              <Shield size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue}>
              {deployedStockVal.toLocaleString()}
            </div>
            <div className={styles.kpiSub}>
              <span>Units In Transit / Reserved ({operationalSummary.allocatedResourceStock} Allocated)</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* KPI 7: Average Response Time */}
          <Link to="/operations/dispatch" className={styles.kpiCard} title="Click to view transit timeline telemetry">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>AVG RESPONSE TIME</span>
              <Clock size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue} style={{ color: '#FFAE73' }}>
              ~{operationalSummary.avgResponseTime}m
            </div>
            <div className={styles.kpiSub}>
              <span>Dispatch-to-Arrival Telemetry</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>

          {/* KPI 8: Resolution Rate */}
          <Link to="/operations/reconciliation" className={styles.kpiCard} title="Click to view delivery reconciliation audit">
            <div className={styles.kpiCardTop}>
              <span className={styles.kpiLabel}>RESOLUTION RATE</span>
              <TrendingUp size={15} className={styles.kpiIcon} />
            </div>
            <div className={styles.kpiValue} style={{ color: '#10B981' }}>
              {operationalSummary.resolutionRate}%
            </div>
            <div className={styles.kpiSub}>
              <span>{operationalSummary.resolvedCasesCount}/{operationalSummary.totalCasesCount} Cases Reconciled</span>
              <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
            </div>
          </Link>
        </div>
      </section>

      {/* ─── 5. PRIORITIZED "REQUIRES ATTENTION" SECTION ─── */}
      <section className={styles.attentionSection}>
        <div className={styles.attentionHeader}>
          <div className={styles.attentionTitle}>
            <Zap size={14} color="#FFAE73" />
            <span>REQUIRES IMMEDIATE COMMANDER ATTENTION</span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(250,248,243,0.6)', fontFamily: 'var(--font-mono)' }}>
            PRIORITIZED ACTION QUEUE
          </span>
        </div>

        <div className={styles.attentionGrid}>
          {urgentDemands.slice(0, 3).map((dem) => (
            <div key={dem.id} className={styles.attentionCard}>
              <div>
                <div className={styles.attentionItemTitle}>
                  <span>{dem.itemNeeded}</span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor: dem.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                      color: dem.priority === 'CRITICAL' ? '#FF8F85' : '#FFAE73',
                      border: `1px solid ${dem.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(249, 115, 22, 0.4)'}`,
                    }}
                  >
                    {dem.priority}
                  </span>
                </div>
                <p className={styles.attentionItemDesc}>
                  <strong>{dem.quantity.toLocaleString()} {dem.unit}</strong> required at <strong>{dem.zoneName}</strong> for ~{dem.affectedCount.toLocaleString()} affected population. Status: {dem.status}.
                </p>
              </div>

              <Link to={`/operations/matching?requestId=${dem.id}`} className={styles.attentionBtn}>
                <span>RUN RESOURCE MATCHING</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 6. COMMON OPERATING PICTURE (COP) GIS MAP ─── */}
      <section ref={mapRef} className={styles.mapSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Common Operating Picture (COP) Telemetry Map</h2>
            <p className={styles.sectionSubtitle}>
              Live MapLibre GIS visualizing verified disaster perimeters, hospital bed availability, emergency shelters, depot stockpiles, field responders, and active convoy transit corridors.
            </p>
          </div>

          {/* Layer controls */}
          <div className={styles.layerControlWrapper} ref={layersRef}>
            <button
              className={styles.layerToggleBtn}
              onClick={() => setIsLayersOpen(!isLayersOpen)}
            >
              <Layers size={13} />
              <span>MAP LAYERS</span>
            </button>

            {isLayersOpen && (
              <div className={styles.layerDropdown}>
                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownLabel}>Map Layers</span>
                  {(Object.entries(layerFilters) as [keyof typeof layerFilters, boolean][]).map(([key, on]) => (
                    <label key={key} className={styles.layerCheckboxRow}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setLayerFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                      />
                      <span className={`${styles.checkboxLabel} ${on ? styles.checkboxOn : ''}`}>{key.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
                <div className={styles.dropdownDivider} />
                <div className={styles.dropdownSection}>
                  <span className={styles.dropdownLabel}>Severity Legend</span>
                  <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.ldCritical}`} />CRITICAL DISASTER</div>
                  <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.ldHigh}`} />HIGH SEVERITY</div>
                  <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.ldMedium}`} />MEDIUM RISK</div>
                  <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.ldShelter}`} />SAFE SHELTER FACILITY</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map Workspace */}
        <div className={styles.mapWrapper}>
          <MapView
            incidents={incidents}
            resources={resources}
            vehicles={vehicles}
            shelters={shelters}
            demands={requests}
            hospitals={hospitals}
            responders={responders}
            hazardZones={hazardZones}
            missions={missions}
            selectedIncident={selectedItem?.type === 'incident' ? selectedItem.obj : null}
            selectedVehicle={selectedItem?.type === 'vehicle' ? selectedItem.obj : null}
            onSelectIncident={(i: any) => setSelectedItem({ type: 'incident', obj: i })}
            onSelectVehicle={(v: any) => setSelectedItem({ type: 'vehicle', obj: v })}
            onSelectShelter={(s: any) => setSelectedItem({ type: 'shelter', obj: s })}
            onSelectDemand={(d: any) => setSelectedItem({ type: 'demand', obj: d })}
            onSelectResource={(r: any) => setSelectedItem({ type: 'resource', obj: r })}
            layerFilters={layerFilters}
          />
        </div>
      </section>

      {/* ─── 7. WORKFLOW GRID: ACTIVE INCIDENTS, DEEP INSPECTOR & LIVE ACTIVITY FEED ─── */}
      <section ref={detailsRef} className={styles.detailsGridSection}>
        <div className={styles.gridCols} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>

          {/* Column 1: Active Disaster Response Cases */}
          <div className={styles.gridCol}>
            <div className={styles.gridColHeader}>
              <h3>Active Response Cases</h3>
              <Link to="/operations/incidents" className={styles.viewRegistryLink}>
                All ({incidents.length}) <ArrowRight size={12} />
              </Link>
            </div>

            <div className={styles.incidentList}>
              {topIncidents.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(250, 248, 243, 0.65)', fontSize: '13px', fontWeight: 600 }}>
                  No active incidents recorded.
                </div>
              ) : (
                topIncidents.map((incident) => (
                  <button
                    key={incident.id}
                    className={`${styles.incidentRow} ${selectedItem?.obj?.id === incident.id ? styles.incidentRowActive : ''}`}
                    onClick={() => setSelectedItem({ type: 'incident', obj: incident })}
                  >
                    <div className={`${styles.sevBar} ${styles['sev_' + incident.severity]}`} />
                    <div className={styles.incContent}>
                      <div className={styles.incHeaderRow}>
                        <span className={styles.incId}>{incident.id}</span>
                        <span className={`${styles.sevBadge} ${styles['badge_' + incident.severity]}`}>
                          {incident.severity}
                        </span>
                        <span style={{ fontSize: '10px', color: 'rgba(250,248,243,0.5)', marginLeft: 'auto' }}>
                          {incident.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className={styles.incType}>{incident.type.replace(/_/g, ' ')}</div>
                      <div className={styles.incLocation}><MapPin size={10} /> {incident.location}</div>
                    </div>
                    <ChevronRight size={14} className={styles.rowArrow} />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Selected Entity Telemetry / Deep Inspector */}
          <div className={styles.gridCol}>
            <div className={styles.gridColHeader}>
              <h3>Selected Entity Telemetry</h3>
              {selectedItem && (
                <button className={styles.clearPanelBtn} onClick={() => setSelectedItem(null)}>
                  CLEAR
                </button>
              )}
            </div>

            <div className={styles.inspectorContainer}>
              {selectedItem ? (
                <div className={styles.inspectorBody}>
                  {selectedItem.type === 'incident' && (
                    <div className={styles.inspectorDetails}>
                      <span className={styles.inspectorSubtitle}>INCIDENT CASE FILE</span>
                      <h4 className={styles.inspectorTitle}>{selectedItem.obj.type.replace(/_/g, ' ')}</h4>
                      <p className={styles.inspectorLoc}><MapPin size={11} /> {selectedItem.obj.location}</p>

                      <div className={styles.metaRow}>
                        <span className={styles.metaBadge}>Status: {selectedItem.obj.status}</span>
                        <span className={styles.metaBadge}>Affected: {selectedItem.obj.peopleAffected || selectedItem.obj.displacedCount || 0}</span>
                        <span className={styles.metaBadge}>Reported: {fmtTimeAgo(selectedItem.obj.time)}</span>
                      </div>

                      <p className={styles.inspectorDesc}>{selectedItem.obj.description}</p>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <Link to={`/operations/incidents/${selectedItem.obj.id}`} className={styles.inspectCta}>
                          Open Case Workspace &rarr;
                        </Link>
                      </div>
                    </div>
                  )}

                  {selectedItem.type === 'demand' && (
                    <div className={styles.inspectorDetails}>
                      <span className={styles.inspectorSubtitle}>DEMAND REQUEST FILE</span>
                      <h4 className={styles.inspectorTitle}>{selectedItem.obj.itemNeeded}</h4>
                      <p className={styles.inspectorLoc}><MapPin size={11} /> {selectedItem.obj.zoneName}</p>
                      <div className={styles.metaRow}>
                        <span className={styles.metaBadge}>Volume: {selectedItem.obj.quantity} {selectedItem.obj.unit}</span>
                        <span className={styles.metaBadge}>Priority: {selectedItem.obj.priority}</span>
                      </div>
                      <Link to={`/operations/matching?requestId=${selectedItem.obj.id}`} className={styles.inspectCta}>
                        Run Resource Matching &rarr;
                      </Link>
                    </div>
                  )}

                  {selectedItem.type === 'vehicle' && (
                    <div className={styles.inspectorDetails}>
                      <span className={styles.inspectorSubtitle}>LOGISTICS FLEET TELEMETRY</span>
                      <h4 className={styles.inspectorTitle}>{selectedItem.obj.name}</h4>
                      <p className={styles.inspectorLoc}><CheckCircle size={11} /> Status: {selectedItem.obj.status}</p>
                      <div className={styles.metaRow}>
                        <span className={styles.metaBadge}>Driver: {selectedItem.obj.driverName}</span>
                        <span className={styles.metaBadge}>Capacity: {selectedItem.obj.capacity}</span>
                      </div>
                      {selectedItem.obj.cargo && (
                        <p className={styles.inspectorDesc} style={{ color: '#FFAE73' }}>
                          Cargo: <strong>{selectedItem.obj.cargo}</strong>
                        </p>
                      )}
                      <Link to="/operations/dispatch" className={styles.inspectCta}>
                        View Fleet Missions &rarr;
                      </Link>
                    </div>
                  )}

                  {selectedItem.type === 'shelter' && (
                    <div className={styles.inspectorDetails}>
                      <span className={styles.inspectorSubtitle}>SHELTER FACILITY STATUS</span>
                      <h4 className={styles.inspectorTitle}>{selectedItem.obj.name}</h4>
                      <p className={styles.inspectorLoc}><MapPin size={11} /> {selectedItem.obj.locationName}</p>
                      <div className={styles.metaRow}>
                        <span className={styles.metaBadge}>Occupancy: {selectedItem.obj.capacityOccupied} / {selectedItem.obj.capacityTotal} Beds</span>
                        <span className={styles.metaBadge}>Status: {selectedItem.obj.status}</span>
                      </div>
                      <Link to="/operations/shelters" className={styles.inspectCta}>
                        View Shelter Details &rarr;
                      </Link>
                    </div>
                  )}

                  {selectedItem.type === 'resource' && (
                    <div className={styles.inspectorDetails}>
                      <span className={styles.inspectorSubtitle}>SUPPLY DEPOT STOCK</span>
                      <h4 className={styles.inspectorTitle}>{selectedItem.obj.name}</h4>
                      <p className={styles.inspectorLoc}><Package size={11} /> {selectedItem.obj.locationName}</p>
                      <div className={styles.metaRow}>
                        <span className={styles.metaBadge}>Available: {selectedItem.obj.quantity} {selectedItem.obj.unit}</span>
                        <span className={styles.metaBadge}>Status: {selectedItem.obj.status}</span>
                      </div>
                      <Link to="/operations/resources" className={styles.inspectCta}>
                        View Depot Registry &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.inspectorPlaceholder}>
                  <AlertTriangle size={24} className={styles.phIcon} />
                  <p>Click any incident, vehicle, demand, or shelter on the map or list to inspect live operational data.</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Live Operational Activity Feed & Audit Trail */}
          <div className={styles.gridCol}>
            <div className={styles.gridColHeader}>
              <h3>Activity &amp; Audit Trail</h3>
              <Link to="/operations/audit" className={styles.viewRegistryLink}>
                All Logs <ArrowRight size={12} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '340px', paddingRight: '4px' }}>
              {auditLogs.slice(0, 6).map((log) => (
                <div
                  key={log.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FAF8F3' }}>{log.action}</span>
                    <span style={{ fontSize: '9px', color: 'rgba(250, 248, 243, 0.45)', fontFamily: 'var(--font-mono)' }}>
                      {fmtTimeAgo(log.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#FFAE73', fontWeight: 600 }}>
                    {log.target}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(250, 248, 243, 0.65)' }}>
                    {log.result}
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(250, 248, 243, 0.4)', marginTop: '2px' }}>
                    Actor: {log.actor}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <PageGuidebook guideKey="commandCentre" />
    </div>
  );
};

export default CommandCenter;
