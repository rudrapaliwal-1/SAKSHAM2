import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MapView } from '../../components/map/MapView';
import type { Vehicle } from '../../types/vehicle';
import type { IncidentType } from '../../types/incident';
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Compass
} from 'lucide-react';
import styles from './Dispatch.module.css';

import GradientBackground from '../../components/ui/noisy-gradient-backgrounds';
import { PageGuideTrigger, PageGuidebook } from '../../components/ui/PageGuide';
import { ShaderBackground } from '../../components/ui/ShaderBackground';
gsap.registerPlugin(ScrollTrigger);

import { useTranslation } from 'react-i18next';
import { DynamicText } from '../../components/ui/DynamicText';
import { EmptyState } from '../../components/ui/SystemStates';
import { useOperationalState, type DispatchMission } from '../../context/OperationalStateContext';

const HISTORY_MISSIONS = [
  { id: 'DSP-DEL-038', status: 'DELIVERED', dest: 'Rohini Sector 15 Shelter', resource: '500 blankets', time: '11:02' },
  { id: 'DSP-DEL-039', status: 'DELIVERED', dest: 'Okhla Collapse Site', resource: 'Heavy tools', time: '10:54' },
  { id: 'DSP-DEL-040', status: 'DELIVERED', dest: 'Lajpat Nagar Camp', resource: 'Portable water', time: '10:48' }
];

export const Dispatch: React.FC = () => {
  const { t } = useTranslation();
  const { requests, vehicles, setVehicles, setRequests, missions, setMissions, deliveries, setDeliveries, addToast } = useOperationalState();
  const [selectedMissionId, setSelectedMissionId] = useState<string>('DSP-DEL-041');
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Dispatch Form State
  const [formAllocationId, setFormAllocationId] = useState('');
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formOperator, setFormOperator] = useState('Sgt. Amit Sharma');

  // Refs for animations
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Get active mission
  const activeMission = useMemo(() => {
    return missions.find(m => m.id === selectedMissionId) || missions[0] || null;
  }, [missions, selectedMissionId]);

  // Find requests with status 'ALLOCATED' to show in the dropdown for creating dispatches
  const allocationsAwaitingDispatch = useMemo(() => {
    return requests.filter(r => r.status === 'ALLOCATED');
  }, [requests]);

  // Filter compatible and available vehicles
  const compatibleVehicles = useMemo(() => {
    return vehicles.filter(v => v.status === 'AVAILABLE');
  }, [vehicles]);

  // Sync state back to global operational context for mock integration
  const syncMissionsToGlobalContext = useCallback((updatedMissions: DispatchMission[]) => {
    // Sync request statuses
    setRequests(prev => prev.map(req => {
      const match = updatedMissions.find(m => m.requestId === req.id);
      if (match) {
        let status = req.status;
        if (match.status === 'DELIVERED') status = 'FULFILLED';
        else if (match.status === 'ARRIVED') status = 'FULFILLING';
        else if (match.status === 'EN_ROUTE' || match.status === 'DISPATCHED') status = 'DISPATCHED';
        return { ...req, status };
      }
      return req;
    }));

    // Sync vehicle locations and destinations
    setVehicles(prev => prev.map(veh => {
      const match = updatedMissions.find(m => m.vehicleId === veh.id);
      if (match) {
        let status = veh.status;
        if (match.status === 'EN_ROUTE') status = 'EN_ROUTE';
        else if (match.status === 'DISPATCHED') status = 'DISPATCHED';
        else if (match.status === 'ARRIVED') status = 'ARRIVED';
        else if (match.status === 'DELIVERED') status = 'AVAILABLE';
        
        // Find destination coordinates from requests
        const reqObj = requests.find(r => r.id === match.requestId);
        return {
          ...veh,
          status,
          destination: reqObj?.coordinates,
          cargo: `${match.quantity.toLocaleString()} ${match.unit} ${match.resourceType}`
        };
      }
      return veh;
    }));
  }, [requests, setRequests, setVehicles]);

  // Trigger sync once on mount
  useEffect(() => {
    syncMissionsToGlobalContext(missions);
  }, []); // Run once on mount to avoid infinite rendering loop

  // Pre-fill from URL parameters if available
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const allocId = searchParams.get('allocationId');
    if (allocId) {
      setFormAllocationId(allocId);
      setShowCreatePanel(true);
      // Auto-assign first available vehicle
      const availVeh = compatibleVehicles[0];
      if (availVeh) {
        setFormVehicleId(availVeh.id);
      }
    }
  }, [searchParams, compatibleVehicles]);

  // Calculations for summary tiles
  const summaryStats = useMemo(() => {
    const active = missions.filter(m => m.status !== 'DELIVERED').length;
    const awaiting = allocationsAwaitingDispatch.length;
    const enroute = missions.filter(m => m.status === 'EN_ROUTE').length;
    const arriving = missions.filter(m => m.status === 'ARRIVED').length;
    return { active, awaiting, enroute, arriving };
  }, [missions, allocationsAwaitingDispatch]);

  // ─── GSAP Entrance Animations ──────────────────────────────────────────────
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(heroRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 0)
        .fromTo(`.${styles.summaryTile}`, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, 0.25)
        .fromTo(workspaceRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.65 }, 0.45);
    }, pageRef);

    return () => ctx.revert();
  }, []);

  // Update Status Action Handler
  const handleUpdateStatus = () => {
    if (!activeMission) return;
    const order: DispatchMission['status'][] = ['AWAITING_DISPATCH', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'DELIVERED'];
    const currentIndex = order.indexOf(activeMission.status);
    if (currentIndex === -1 || currentIndex === order.length - 1) return;
    
    const nextStatus = order[currentIndex + 1];
    
    const updated = missions.map(m => {
      if (m.id !== activeMission.id) return m;
      
      const newTimeline = [...m.timeline];
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
      });
      
      // Update matching timeline item
      if (nextStatus === 'DISPATCHED') {
        newTimeline[2] = { time: timeStr, title: 'DISPATCH AUTHORIZED', done: true };
      } else if (nextStatus === 'EN_ROUTE') {
        newTimeline[3] = { time: timeStr, title: 'EN ROUTE TO TARGET', done: true };
      } else if (nextStatus === 'ARRIVED') {
        newTimeline[4] = { time: timeStr, title: 'DESTINATION ARRIVAL', done: true };
      } else if (nextStatus === 'DELIVERED') {
        newTimeline[5] = { time: timeStr, title: 'CARGO DELIVERY VERIFIED', done: true };
      }
      
      return {
        ...m,
        status: nextStatus,
        timeline: newTimeline,
        speedKmh: nextStatus === 'DELIVERED' ? 0 : m.speedKmh,
        distanceKm: nextStatus === 'ARRIVED' || nextStatus === 'DELIVERED' ? 0 : m.distanceKm,
        etaMinutes: nextStatus === 'ARRIVED' || nextStatus === 'DELIVERED' ? 0 : m.etaMinutes
      };
    });

    setMissions(updated);
    syncMissionsToGlobalContext(updated);
  };

  // Re-route Action Handler (Trigger Alternative Route)
  const handleReroute = () => {
    if (!activeMission) return;
    setMissions(prev => prev.map(m => {
      if (m.id !== activeMission.id) return m;
      return {
        ...m,
        trafficLevel: 'LOW',
        etaMinutes: m.etaMinutes + 4,
        distanceKm: m.distanceKm + 1.2,
        routePath: [m.routePath[0], 'Ring Road Alternative', ...m.routePath.slice(2)],
        alertMessage: undefined
      };
    }));
  };

  // Create Dispatch Handler
  const handleCreateDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAllocationId || !formVehicleId || isSubmitting) return;

    const request = requests.find(r => r.id === formAllocationId);
    const vehicle = vehicles.find(v => v.id === formVehicleId);

    if (!request || !vehicle) {
      addToast('ERROR', 'INVALID DISPATCH DATA: The selected request or vehicle is not valid.');
      return;
    }

    // Validate that the vehicle is still available
    if (vehicle.status !== 'AVAILABLE') {
      addToast('ERROR', 'VEHICLE NO LONGER AVAILABLE: This vehicle is currently assigned to another mission.');
      return;
    }

    setIsSubmitting(true);

    // Simulate dispatch processing lag (800ms) to prevent double clicks and give a premium responsive feel
    setTimeout(() => {
      const newMissionId = `DSP-DEL-0${missions.length + 41}`;
      const newMission: DispatchMission = {
        id: newMissionId,
        requestId: request.id,
        vehicleId: vehicle.id,
        status: 'DISPATCHED',
        destinationName: request.zoneName,
        resourceType: request.itemNeeded,
        quantity: request.quantity,
        unit: request.unit,
        etaMinutes: 22,
        operatorName: formOperator,
        speedKmh: 50,
        distanceKm: 8.5,
        signalStrength: 95,
        fuelPct: 90,
        trafficLevel: 'LOW',
        routePath: ['Central Command Depot', 'Ring Road Bypass', request.zoneName.split(',')[0]],
        timeline: [
          { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), title: 'ALLOCATION APPROVED', done: true },
          { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), title: 'VEHICLE ASSIGNED', done: true },
          { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), title: 'DISPATCH AUTHORIZED', done: true },
          { time: '--:--', title: 'EN ROUTE TO TARGET', done: false },
          { time: '--:--', title: 'DESTINATION ARRIVAL', done: false },
          { time: '--:--', title: 'CARGO DELIVERY VERIFIED', done: false }
        ]
      };

      const updatedMissions = [newMission, ...missions];
      setMissions(updatedMissions);
      syncMissionsToGlobalContext(updatedMissions);

      // Create and append a corresponding ReliefDelivery item
      const newDeliveryId = `DEL-2026-0${deliveries.length + 81}`;
      const newDelivery = {
        id: newDeliveryId,
        dispatchId: newMissionId,
        demandId: request.id,
        incidentId: request.incidentId || '',
        resourceId: request.allocatedResourceId || '',
        vehicleId: vehicle.id,
        requestedQty: request.quantity,
        allocatedQty: request.quantity,
        deliveredQty: 0,
        unit: request.unit,
        status: 'PENDING' as const,
        resourceType: request.itemNeeded,
        destinationName: request.zoneName
      };
      setDeliveries(prev => [newDelivery, ...prev]);

      addToast('SUCCESS', `✓ Vehicle ${vehicle.id} dispatched successfully to coordinate zone.`);
      setSelectedMissionId(newMissionId);
      setShowCreatePanel(false);
      setFormAllocationId('');
      setFormVehicleId('');
      setIsSubmitting(false);
    }, 800);
  };

  // Convert selected mission properties to draw lines on map
  const activeVehicle = useMemo(() => {
    if (!activeMission) return null;
    return vehicles.find(v => v.id === activeMission.vehicleId) || null;
  }, [activeMission, vehicles]);

  const mapVehicles = useMemo<Vehicle[]>(() => {
    if (!activeVehicle || !activeMission) return [];
    
    // Create temporary coordinates based on the status for routing rendering
    let destCoords: any = undefined;
    const reqObj = requests.find(r => r.id === activeMission.requestId);
    if (reqObj) {
      destCoords = reqObj.coordinates;
    }

    return [{
      ...activeVehicle,
      status: activeMission.status === 'DELIVERED' ? 'AVAILABLE' : (activeMission.status === 'ARRIVED' ? 'ARRIVED' : 'EN_ROUTE'),
      destination: destCoords
    }];
  }, [activeVehicle, activeMission, requests]);

  const mapIncidents = useMemo(() => {
    if (!activeMission) return [];
    const reqObj = requests.find(r => r.id === activeMission.requestId);
    if (!reqObj?.incidentId) return [];
    const incidentObj = requests.find(r => r.id === activeMission.requestId);
    return incidentObj ? [{
      id: reqObj.incidentId,
      type: 'RESOURCE_SHORTAGE' as IncidentType,
      severity: 'CRITICAL' as const,
      location: reqObj.zoneName,
      coordinates: reqObj.coordinates,
      time: new Date().toISOString(),
      status: 'UNDER_RESPONSE' as const,
      assignedTeam: 'NDRF TEAM ALPHA',
      description: `Target for dispatch allocation.`,
      reportedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'COMMAND CENTER',
      peopleAffected: reqObj.affectedCount,
      requiredResources: [],
      reporterName: 'Control Operator',
      reporterContact: 'Internal Line'
    }] : [];
  }, [activeMission, requests]);

  return (
    <div ref={pageRef} className={styles.page}>
      <GradientBackground />
      
      <header ref={heroRef} className={`${styles.hero} shaderHeaderWrapper`}>
        <ShaderBackground className="absolute inset-0" />
        <div className={styles.heroLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className={styles.heroEyebrow} style={{ marginBottom: 0 }}>{t('dispatch.title')}</span>
            <PageGuideTrigger />
          </div>
          <h1 className={styles.heroTitle}>{t('dispatch.title')}</h1>
          <p className={styles.heroLead}>
            {t('dispatch.subtitle')}
          </p>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.statusIndicator}>
            <span className={styles.statusDotPulse} />
            <span className={styles.statusLabel}>{t('common.active')}</span>
          </div>
          <span className={styles.statusDetails}>
            {summaryStats.active} {t('dashboard.activeDispatches')}
          </span>
        </div>
      </header>

      {/* ── Operational Summary Row ── */}
      <section ref={summaryRef} className={styles.summarySection}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.active).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('dashboard.activeDispatches')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.awaiting).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('status.PENDING')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.enroute).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('status.EN_ROUTE')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.arriving).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('status.ARRIVED')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>88%</span>
            <span className={styles.summaryLabel}>{t('common.status')}</span>
          </div>
        </div>
      </section>

      {/* ── Main Workspace ── */}
      <div ref={workspaceRef} className={styles.workspace}>
        
        {/* Left Column: Map */}
        <div className={styles.leftCol}>
          <div className={styles.mapHeader}>
            <div className={styles.mapTitleBlock}>
              <span className={styles.mapTitle}>{t('dashboard.liveTelemetry')}</span>
              <span className={styles.mapSubtitle}>{t('map.legendTitle')}</span>
            </div>
            <div className={styles.mapSyncBlock}>
              <span className={styles.mapPulse} />
              <span className={styles.mapSyncLabel}>{t('dashboard.liveStatus')}</span>
            </div>
          </div>
          <div className={styles.mapContainer}>
            <MapView
              incidents={mapIncidents}
              resources={[]}
              vehicles={mapVehicles}
              shelters={[]}
              layerFilters={{
                incidents: true,
                resources: false,
                vehicles: true,
                shelters: false,
                routes: true
              }}
            />
          </div>
          
          {/* Action Area below Map */}
          {activeMission && (
            <div className={styles.actionWorkspace}>
              <div className={styles.actionHeader}>
                <span className={styles.actionEyebrow}>{t('dispatch.title')}</span>
                <span className={styles.actionStatusLabel}>{t('common.status')}: <strong>{t(`status.${activeMission.status}`) || activeMission.status}</strong></span>
              </div>
              <div className={styles.actionButtons}>
                {activeMission.status === 'DISPATCHED' && (
                  <button className={styles.primaryActionBtn} onClick={handleUpdateStatus}>
                    {t('dispatch.confirmDispatch')} <ArrowRight size={13} />
                  </button>
                )}
                {activeMission.status === 'EN_ROUTE' && (
                  <button className={styles.primaryActionBtn} onClick={handleUpdateStatus}>
                    {t('status.ARRIVED')} <ArrowRight size={13} />
                  </button>
                )}
                {activeMission.status === 'ARRIVED' && (
                  <>
                    <button className={styles.primaryActionBtn} onClick={handleUpdateStatus}>
                      {t('delivery.verifyDelivery')} <CheckCircle size={13} />
                    </button>
                    <Link
                      to={`/operations/delivery?deliveryId=${deliveries.find(d => d.dispatchId === activeMission.id)?.id || ''}`}
                      className={styles.primaryActionBtn}
                      style={{ background: '#2563EB', textDecoration: 'none' }}
                    >
                      OPEN DELIVERY RECONCILIATION <ArrowRight size={13} />
                    </Link>
                  </>
                )}
                {activeMission.status === 'DELIVERED' && (
                  <>
                    <div className={styles.completedBanner}>
                      <Check size={14} /> {t('status.DELIVERED')}
                    </div>
                    <Link
                      to="/operations/command-center"
                      className={styles.primaryActionBtn}
                      style={{ background: '#10B981', textDecoration: 'none' }}
                    >
                      RETURN TO COMMAND CENTER <ArrowRight size={13} />
                    </Link>
                  </>
                )}
                
                {activeMission.status !== 'DELIVERED' && activeMission.trafficLevel === 'BLOCKED' && (
                  <button className={styles.alertActionBtn} onClick={handleReroute}>
                    REROUTE MISSION NOW <Compass size={13} />
                  </button>
                )}

                <button className={styles.secondaryActionBtn} onClick={() => {
                  setSelectedMissionId(activeMission.id);
                  setShowCreatePanel(true);
                }}>
                  + NEW DISPATCH
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mission Details & Queue */}
        <div className={styles.rightCol}>
          
          {/* Active Missions Queue list */}
          <div className={styles.missionQueueSection}>
            <div className={styles.mqHeader}>
              <span className={styles.mqEyebrow}>ACTIVE MISSIONS</span>
              <button className={styles.mqCreateBtn} onClick={() => setShowCreatePanel(true)}>
                + CREATE DISPATCH
              </button>
            </div>
            
            <div className={styles.missionList}>
              {missions.length === 0 ? (
                <EmptyState
                  title="No Active Dispatch Missions"
                  description="All allocated demands have either completed delivery or require initial fleet dispatch assignment."
                  iconType="check"
                  actionLabel="+ Create New Dispatch"
                  onAction={() => setShowCreatePanel(true)}
                />
              ) : (
                missions.map(m => {
                  const isActive = m.id === selectedMissionId;
                  return (
                    <button
                      key={m.id}
                      className={`${styles.missionRow} ${isActive ? styles.missionRowActive : ''}`}
                      onClick={() => setSelectedMissionId(m.id)}
                    >
                      <div className={styles.mrLeft}>
                        <span className={styles.mrId}>{m.id}</span>
                        <span className={`${styles.mrStatusBadge} ${styles['status_' + m.status]}`}>
                          {m.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className={styles.mrDetails}>
                        <span className={styles.mrTarget}>{m.destinationName.split(',')[0]}</span>
                        <span className={styles.mrCargo}>{m.quantity.toLocaleString()} {m.unit} {m.resourceType}</span>
                      </div>
                      <div className={styles.mrRight}>
                        <span className={styles.mrEtaLabel}>ETA</span>
                        <span className={styles.mrEtaVal}>{m.etaMinutes > 0 ? `${m.etaMinutes}m` : 'ARRIVED'}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detailed Context Panel */}
          {activeMission && (
            <div ref={detailRef} className={styles.detailPanel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelEyebrow}>MISSION DETAILS</span>
                <span className={styles.panelId}>{activeMission.id}</span>
              </div>

              {activeMission.alertMessage && (
                <div className={styles.operationalAlert}>
                  <AlertTriangle size={14} className={styles.alertIcon} />
                  <div className={styles.alertTextBlock}>
                    <strong>ALERT RESOLUTION REQUIRED</strong>
                    <span>{activeMission.alertMessage}</span>
                  </div>
                  {activeMission.trafficLevel === 'HEAVY' && (
                    <button className={styles.alertSolveBtn} onClick={handleReroute}>
                      REROUTE
                    </button>
                  )}
                </div>
              )}

              <div className={styles.detailGrid}>
                <div>
                  <span className={styles.detailLabel}>RESOURCE TYPE</span>
                  <span className={styles.detailVal}>{activeMission.resourceType}</span>
                </div>
                <div>
                  <span className={styles.detailLabel}>QUANTITY DISPATCHED</span>
                  <span className={styles.detailVal}>{activeMission.quantity.toLocaleString()} {activeMission.unit}</span>
                </div>
                <div>
                  <span className={styles.detailLabel}>VEHICLE FLEET UNIT</span>
                  <span className={styles.detailVal}>{activeMission.vehicleId}</span>
                </div>
                <div>
                  <span className={styles.detailLabel}>ASSIGNED OPERATOR</span>
                  <span className={styles.detailVal}>{activeMission.operatorName}</span>
                </div>
              </div>

              {/* Progress Timeline */}
              <div className={styles.timelineSection}>
                <span className={styles.panelEyebrow}>MISSION TIMELINE</span>
                <div className={styles.timeline}>
                  {activeMission.timeline.map((step, idx) => (
                    <div key={idx} className={`${styles.timelineStep} ${step.done ? styles.stepDone : ''}`}>
                      <div className={styles.stepCircle}>
                        {step.done && <Check size={8} />}
                      </div>
                      <div className={styles.stepContent}>
                        <span className={styles.stepTitle}>{step.title}</span>
                        <span className={styles.stepTime}>{step.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Route Path list */}
              <div className={styles.routeSection}>
                <span className={styles.panelEyebrow}>APPROVED ROUTE PATH</span>
                <div className={styles.routePath}>
                  {activeMission.routePath.map((stop, idx) => (
                    <div key={idx} className={styles.routeStop}>
                      {idx > 0 && <span className={styles.routeArrow}>↓</span>}
                      <DynamicText text={stop} className={styles.routeStopName} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicle Telemetry stats */}
              <div className={styles.telemetrySection}>
                <span className={styles.panelEyebrow}>VEHICLE TELEMETRY</span>
                <div className={styles.telemetryGrid}>
                  <div>
                    <span className={styles.teleLabel}>SPEED</span>
                    <span className={styles.teleVal}>{activeMission.speedKmh} km/h</span>
                  </div>
                  <div>
                    <span className={styles.teleLabel}>HEADING</span>
                    <span className={styles.teleVal}><Compass size={10} style={{ display: 'inline', marginRight: 2 }} /> SE 124°</span>
                  </div>
                  <div>
                    <span className={styles.teleLabel}>DISTANCE REMAINING</span>
                    <span className={styles.teleVal}>{activeMission.distanceKm} km</span>
                  </div>
                  <div>
                    <span className={styles.teleLabel}>SIGNAL STRENGTH</span>
                    <span className={styles.teleVal}>{activeMission.signalStrength}%</span>
                  </div>
                  <div>
                    <span className={styles.teleLabel}>FUEL / BATTERY</span>
                    <span className={styles.teleVal} style={{ color: activeMission.fuelPct < 30 ? '#C0392B' : undefined }}>{activeMission.fuelPct}%</span>
                  </div>
                  <div>
                    <span className={styles.teleLabel}>ROUTE STATUS</span>
                    <span className={styles.teleVal} style={{ color: activeMission.trafficLevel === 'BLOCKED' ? '#C0392B' : undefined }}>
                      {activeMission.trafficLevel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Dispatch Side Panel ── */}
      {showCreatePanel && (
        <div className={styles.panelOverlay}>
          <div className={styles.createPanel}>
            <div className={styles.cpHeader}>
              <h3>AUTHORIZE DISPATCH MISSION</h3>
              <button className={styles.cpCloseBtn} onClick={() => setShowCreatePanel(false)}>
                <X size={15} />
              </button>
            </div>
            
            <form onSubmit={handleCreateDispatch} className={styles.cpForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>SELECT APPROVED ALLOCATION</label>
                <select
                  value={formAllocationId}
                  onChange={e => setFormAllocationId(e.target.value)}
                  required
                >
                  <option value="">-- Choose allocation --</option>
                  {allocationsAwaitingDispatch.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.id} - {a.quantity.toLocaleString()} {a.unit} {a.itemNeeded} to {a.zoneName.split(',')[0]}
                    </option>
                  ))}
                  {allocationsAwaitingDispatch.length === 0 && (
                    <option value="" disabled>No approved allocations awaiting dispatch</option>
                  )}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>SELECT COMPATIBLE VEHICLE</label>
                <select
                  value={formVehicleId}
                  onChange={e => setFormVehicleId(e.target.value)}
                  required
                >
                  <option value="">-- Choose vehicle --</option>
                  {compatibleVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.id} - {v.name} ({v.type} | Cap: {v.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ASSIGN OPERATOR / TEAM LEAD</label>
                <input
                  type="text"
                  value={formOperator}
                  onChange={e => setFormOperator(e.target.value)}
                  required
                />
              </div>

              {/* Stock check & Verification Preview */}
              {formAllocationId && (
                <div className={styles.stockVerification}>
                  <div className={styles.verificationRow}>
                    <span>✓ STOCK ALLOCATION VERIFIED</span>
                    <span className={styles.verificationOk}>READY</span>
                  </div>
                  <div className={styles.verificationPreview}>
                    <p><strong>MISSION SUMMARY</strong></p>
                    <p>Resource: 12,000 L Clean Drinking Water</p>
                    <p>Target Zone: Yamuna Bank Floodplain</p>
                    <p>Fleet Code: VEH-BT-401 (NDRF supply boat)</p>
                    <p>ETA: ~18 mins (Route via Canal link)</p>
                  </div>
                </div>
              )}

              <div className={styles.cpActions}>
                <button type="button" className={styles.cpCancelBtn} onClick={() => setShowCreatePanel(false)}>
                  CANCEL
                </button>
                <button type="submit" className={styles.cpSubmitBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'DISPATCHING...' : 'AUTHORIZE DISPATCH →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dispatch History Section ── */}
      <section className={styles.historySection}>
        <div className={styles.historyHeader}>
          <span className={styles.historyEyebrow}>RECENT MISSION HISTORY</span>
        </div>
        <div className={styles.historyGrid}>
          {HISTORY_MISSIONS.map(h => (
            <div key={h.id} className={styles.historyCard}>
              <div className={styles.hcHeader}>
                <span className={styles.hcId}>{h.id}</span>
                <span className={styles.hcStatus}>{h.status}</span>
              </div>
              <div className={styles.hcBody}>
                <p><strong>Destination:</strong> {h.dest}</p>
                <p><strong>Cargo payload:</strong> {h.resource}</p>
                <span className={styles.hcTimestamp}>Delivered at {h.time}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mission Lifecycle Section ── */}
      <section className={styles.lifecycleSection}>
        <div className={styles.lcTitleBlock}>
          <span className={styles.lcEyebrow}>MISSION LIFECYCLE</span>
          <h2 className={styles.lcTitle}>SAKSHAM Dispatch Execution Pipeline</h2>
        </div>
        <div className={styles.lcPipeline}>
          {[
            { step: 'ALLOCATED', label: 'Match engine commits stock resources.' },
            { step: 'DISPATCHED', label: 'Operator assigns logistics vehicle and departs.' },
            { step: 'EN ROUTE', label: 'Field telemetry feeds real-time coordinates.' },
            { step: 'ARRIVED', label: 'Vehicle registers destination geo-fence arrival.' },
            { step: 'DELIVERED', label: 'Operator uploads relief handover certificate.' }
          ].map((l, idx) => (
            <div key={idx} className={styles.lcStep}>
              <div className={styles.lcCircle}>{idx + 1}</div>
              <strong className={styles.lcStepTitle}>{l.step}</strong>
              <span className={styles.lcStepDesc}>{l.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.lcTransition}>
          <span>LIFECYCLE TARGET PIPELINE COMPLETE</span>
          <Link to="/operations/delivery" className={styles.lcLink}>
            CONTINUE TO DELIVERY VERIFICATION &rarr;
          </Link>
        </div>
      </section>

      <PageGuidebook guideKey="dispatch" />
    </div>
  );
};

export default Dispatch;
