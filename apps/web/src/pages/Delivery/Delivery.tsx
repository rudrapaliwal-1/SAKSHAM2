import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Clock,
  Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemandRequest } from '../../types/request';
import styles from './Delivery.module.css';

import { PageGuideTrigger, PageGuidebook } from '../../components/ui/PageGuide';
import { ShaderBackground } from '../../components/ui/ShaderBackground';
import GradientBackground from '../../components/ui/noisy-gradient-backgrounds';
import { EmptyState } from '../../components/ui/SystemStates';

import { useOperationalState } from '../../context/OperationalStateContext';

gsap.registerPlugin(ScrollTrigger);

export const Delivery: React.FC = () => {
  const { t } = useTranslation();
  const {
    requests,
    vehicles,
    incidents,
    setRequests,
    setVehicles,
    setIncidents,
    deliveries,
    setDeliveries,
    setMissions,
    setResources,
    addToast
  } = useOperationalState();

  const [selectedDelId, setSelectedDelId] = useState<string>('DEL-2026-081');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Input states for reconciliation & verification
  const [inputQty, setInputQty] = useState<string>('');
  const [inputOfficer, setInputOfficer] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [inputProofRef, setInputProofRef] = useState<string>('');
  const [selectedException, setSelectedException] = useState<string>('');

  // Modals & Panels toggle
  const [showConfirmArrival, setShowConfirmArrival] = useState(false);
  const [showStartDelivery, setShowStartDelivery] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);

  // GSAP animation refs
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const activeDelivery = useMemo(() => {
    return deliveries.find(d => d.id === selectedDelId) || deliveries[0] || null;
  }, [deliveries, selectedDelId]);

  // Find linked models
  const linkedRequest = useMemo(() => {
    if (!activeDelivery) return null;
    return requests.find(r => r.id === activeDelivery.demandId) || null;
  }, [activeDelivery, requests]);

  const linkedVehicle = useMemo(() => {
    if (!activeDelivery) return null;
    return vehicles.find(v => v.id === activeDelivery.vehicleId) || null;
  }, [activeDelivery, vehicles]);

  const linkedIncident = useMemo(() => {
    if (!activeDelivery) return null;
    // Attempt match via demand incident id
    const req = requests.find(r => r.id === activeDelivery.demandId);
    if (!req?.incidentId) return null;
    return incidents.find(i => i.id === req.incidentId) || null;
  }, [activeDelivery, requests, incidents]);

  // Calculation for operational stats summary
  const summaryStats = useMemo(() => {
    const active = deliveries.filter(d => d.status !== 'VERIFIED').length;
    const awaiting = deliveries.filter(d => d.status === 'ARRIVED').length;
    const fulfilledCount = deliveries.filter(d => d.status === 'VERIFIED' && d.deliveredQty >= d.requestedQty).length;
    const partialCount = deliveries.filter(d => d.status === 'VERIFIED' && d.deliveredQty > 0 && d.deliveredQty < d.requestedQty).length;
    return { active, awaiting, fulfilledCount, partialCount };
  }, [deliveries]);

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

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const delId = searchParams.get('deliveryId');
    if (delId) {
      const match = deliveries.find(d => d.id === delId);
      if (match) {
        setSelectedDelId(delId);
      }
    }
  }, [searchParams, deliveries]);

  // Set default form inputs on selection change
  useEffect(() => {
    if (activeDelivery) {
      setInputQty(activeDelivery.allocatedQty.toString());
      setInputOfficer('Officer S. Prasad');
      setInputNotes('');
      setInputProofRef(`POD-DEL-${activeDelivery.id.split('-').pop()}`);
      setSelectedException('');
    }
  }, [activeDelivery]);

  // Reconciliation validation variables
  const enteredQtyNum = parseFloat(inputQty) || 0;
  const isOverDelivery = activeDelivery ? enteredQtyNum > activeDelivery.requestedQty : false;
  const isPartialDelivery = activeDelivery ? enteredQtyNum < activeDelivery.requestedQty && enteredQtyNum > 0 : false;
  const isZeroDelivery = enteredQtyNum === 0;

  // Actions handlers
  const handleConfirmArrival = () => {
    if (!activeDelivery) return;
    setDeliveries(prev => prev.map(d => {
      if (d.id !== activeDelivery.id) return d;
      return { ...d, status: 'ARRIVED' };
    }));
    setMissions(prev => prev.map(m => {
      if (m.id !== activeDelivery.dispatchId) return m;
      return { ...m, status: 'ARRIVED' };
    }));
    setShowConfirmArrival(false);
  };

  const handleStartDelivery = () => {
    if (!activeDelivery) return;
    setDeliveries(prev => prev.map(d => {
      if (d.id !== activeDelivery.id) return d;
      return { ...d, status: 'IN_DELIVERY' };
    }));
    setMissions(prev => prev.map(m => {
      if (m.id !== activeDelivery.dispatchId) return m;
      return { ...m, status: 'EN_ROUTE' };
    }));
    setShowStartDelivery(false);
  };

  const handleVerifyDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery || isSubmitting) return;

    if (isOverDelivery) {
      addToast('ERROR', 'DELIVERY CANNOT BE VERIFIED: Delivered quantity exceeds original allocation.');
      return;
    }

    setIsSubmitting(true);

    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
    });

    // Simulate verification processing lag (750ms) to prevent double clicks and ensure smooth UX
    setTimeout(() => {
      // 1. Update delivery status locally
      setDeliveries(prev => prev.map(d => {
        if (d.id !== activeDelivery.id) return d;
        return {
          ...d,
          status: 'VERIFIED',
          deliveredQty: enteredQtyNum,
          verifiedBy: inputOfficer,
          verifiedAt: timeStr,
          notes: inputNotes,
          exceptionReason: isZeroDelivery ? selectedException : undefined
        };
      }));

      // 2. Sync Demand request status
      setRequests(prev => prev.map(req => {
        if (req.id !== activeDelivery.demandId) return req;
        return {
          ...req,
          status: isZeroDelivery ? 'UNFULFILLED' : (isPartialDelivery ? 'PARTIALLY_FULFILLED' : 'FULFILLED')
        };
      }));

      // 2b. Reconcile resource stock
      const diff = activeDelivery.allocatedQty - enteredQtyNum;
      if (diff > 0) {
        setResources(prev => prev.map(res => {
          if (res.id !== activeDelivery.resourceId) return res;
          const newQty = res.quantity + diff;
          const newAllocated = Math.max(0, (res.allocatedQuantity ?? 0) - diff);
          return {
            ...res,
            quantity: newQty,
            allocatedQuantity: newAllocated,
            status: newQty > 0 ? 'AVAILABLE' : res.status
          };
        }));
      } else {
        setResources(prev => prev.map(res => {
          if (res.id !== activeDelivery.resourceId) return res;
          const newAllocated = Math.max(0, (res.allocatedQuantity ?? 0) - activeDelivery.allocatedQty);
          return {
            ...res,
            allocatedQuantity: newAllocated
          };
        }));
      }

      // 3. Sync vehicle status to AVAILABLE
      setVehicles(prev => prev.map(veh => {
        if (veh.id !== activeDelivery.vehicleId) return veh;
        return { ...veh, status: 'AVAILABLE', incidentId: undefined, destination: undefined, cargo: undefined };
      }));

      // 3b. Sync dispatch mission status to DELIVERED
      setMissions(prev => prev.map(m => {
        if (m.id !== activeDelivery.dispatchId) return m;
        return { ...m, status: 'DELIVERED' };
      }));

      // 4. Sync incidents with a new timeline log entry
      if (linkedIncident) {
        const description = isZeroDelivery 
          ? `Delivery mission failed or cancelled (0 units delivered). Reason: ${selectedException || 'unspecified'}.`
          : `Verified distribution of ${enteredQtyNum.toLocaleString()} ${activeDelivery.unit} of ${activeDelivery.resourceType} by field team (Ref: ${activeDelivery.id}).`;
        
        setIncidents(prev => prev.map(inc => {
          if (inc.id !== linkedIncident.id) return inc;
          const currentTimeline = inc.timeline || [];
          return {
            ...inc,
            updatedAt: new Date().toISOString(),
            timeline: [...currentTimeline, {
              time: timeStr,
              title: isZeroDelivery ? 'DELIVERY FAILED' : 'DELIVERY VERIFIED',
              description
            }]
          };
        }));
      }

      // 5. Create follow-up demand if partial fulfillment occurs
      if (isPartialDelivery && linkedRequest) {
        const followUpId = `${linkedRequest.id}-F01`;
        const outstandingQty = linkedRequest.quantity - enteredQtyNum;

        const followUpRequest: DemandRequest = {
          ...linkedRequest,
          id: followUpId,
          quantity: outstandingQty,
          status: 'PENDING',
          requestedAt: new Date().toISOString(),
          allocatedResourceId: undefined,
          allocatedVehicleId: undefined
        };

        setRequests(prev => [...prev, followUpRequest]);

        // Log the follow-up demand creation on the linked incident timeline
        if (linkedIncident) {
          setIncidents(prev => prev.map(inc => {
            if (inc.id !== linkedIncident.id) return inc;
            const currentTimeline = inc.timeline || [];
            return {
              ...inc,
              timeline: [...currentTimeline, {
                time: timeStr,
                title: 'FOLLOW-UP DEMAND GENERATED',
                description: `Outstanding quantity of ${outstandingQty.toLocaleString()} units logged under ref: ${followUpId}.`
              }]
            };
          }));
        }
      }

      if (isZeroDelivery) {
        addToast('WARNING', `⚠ Relief delivery failed or rejected. Incident log recorded.`);
      } else if (isPartialDelivery) {
        addToast('WARNING', `⚠ Relief delivery verified. Created follow-up demand for remaining ${diff.toLocaleString()} units.`);
      } else {
        addToast('SUCCESS', '✓ Relief delivery verified and recorded successfully.');
      }

      setShowVerification(false);
      setIsSubmitting(false);
    }, 750);
  };

  // Close Incident Handler
  const handleCloseIncident = () => {
    if (!linkedIncident) return;
    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
    });

    setIncidents(prev => prev.map(inc => {
      if (inc.id !== linkedIncident.id) return inc;
      const currentTimeline = inc.timeline || [];
      return {
        ...inc,
        status: 'RESOLVED',
        updatedAt: new Date().toISOString(),
        timeline: [...currentTimeline, {
          time: timeStr,
          title: 'INCIDENT CLOSED',
          description: 'Emergency response mission closed. Operational objectives fully satisfied.'
        }]
      };
    }));

    setShowClosureModal(false);
  };

  // Check if all demands connected to the incident are fulfilled
  const incidentClosureCheck = useMemo(() => {
    if (!linkedIncident) return { ready: false, activeCount: 0 };
    // Find all requests belonging to the incident
    const incidentRequests = requests.filter(r => r.incidentId === linkedIncident.id);
    const pendingCount = incidentRequests.filter(r => (r.status as string) !== 'FULFILLED').length;
    return {
      ready: pendingCount === 0,
      activeCount: pendingCount
    };
  }, [linkedIncident, requests]);

  return (
    <div ref={pageRef} className={styles.page}>
      <GradientBackground />
      
      {/* ── Page Hero ── */}
      <header ref={heroRef} className={`${styles.hero} shaderHeaderWrapper`}>
        <ShaderBackground className="absolute inset-0" />
        <div className={styles.heroLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className={styles.heroEyebrow} style={{ marginBottom: 0 }}>{t('delivery.title')}</span>
            <PageGuideTrigger />
          </div>
          <h1 className={styles.heroTitle}>{t('delivery.title')}</h1>
          <p className={styles.heroLead}>
            {t('delivery.subtitle')}
          </p>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.statusIndicator}>
            <span className={styles.statusDotPulse} />
            <span className={styles.statusLabel}>{t('common.active')}</span>
          </div>
          <span className={styles.statusDetails}>
            {summaryStats.active} {t('common.active')} · {summaryStats.awaiting} {t('status.PENDING')}
          </span>
        </div>
      </header>

      {/* ── Operational Summary Row ── */}
      <section ref={summaryRef} className={styles.summarySection}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.active).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('common.active')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.awaiting).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('status.PENDING')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.fulfilledCount).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('status.FULFILLED')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>{String(summaryStats.partialCount).padStart(2, '0')}</span>
            <span className={styles.summaryLabel}>{t('common.pending')}</span>
          </div>
          <div className={styles.summaryTile}>
            <span className={styles.summaryNum}>92%</span>
            <span className={styles.summaryLabel}>{t('common.status')}</span>
          </div>
        </div>
      </section>

      {/* ── Main Workspace ── */}
      <div ref={workspaceRef} className={styles.workspace}>
        
        {/* Left Column: Delivery Queue */}
        <div className={styles.leftCol}>
          <div className={styles.queueHeader}>
            <span className={styles.queueTitle}>{t('delivery.title')}</span>
            <span className={styles.queueSubtitle}>{deliveries.length} total</span>
          </div>
          
          <div className={styles.deliveryList}>
            {deliveries.length === 0 ? (
              <EmptyState
                title="No Pending Deliveries"
                description="All dispatched relief convoys have been reconciled and verified, or no active dispatches are currently awaiting handover."
                iconType="check"
              />
            ) : (
              deliveries.map(d => {
                const isActive = d.id === selectedDelId;
                const reqObj = requests.find(r => r.id === d.demandId);
                return (
                  <button
                    key={d.id}
                    className={`${styles.deliveryRow} ${isActive ? styles.deliveryRowActive : ''}`}
                    onClick={() => setSelectedDelId(d.id)}
                  >
                    <div className={styles.drLeft}>
                      <span className={styles.drId}>{d.id}</span>
                      <span className={`${styles.drBadge} ${styles['status_' + d.status]}`}>
                        {t(`status.${d.status}`) || d.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className={styles.drMiddle}>
                      <span className={styles.drTarget}>{reqObj?.zoneName.split(',')[0]}</span>
                      <span className={styles.drCargo}>{d.allocatedQty.toLocaleString()} {d.unit} {d.resourceType}</span>
                    </div>
                    <div className={styles.drRight}>
                      <span className={styles.drActionText}>
                        {d.status === 'VERIFIED' ? t('status.DELIVERED') : t('status.PENDING')}
                      </span>
                      <ArrowRight size={12} className={styles.drArrow} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Delivery Exception Alert Component */}
          {activeDelivery && activeDelivery.status !== 'VERIFIED' && (
            <div className={styles.exceptionCard}>
              <div className={styles.excHeader}>
                <AlertTriangle size={14} className={styles.excIcon} />
                <span>FIELD TELEMETRY DELAY ALERT</span>
              </div>
              <p className={styles.excText}>
                No auto-GPS updates received from vehicle {activeDelivery.vehicleId} in the last 15 minutes. Manual dispatcher verification required to progress status.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Delivery Workspace Panel */}
        <div className={styles.rightCol}>
          {activeDelivery && (
            <div ref={detailRef} className={styles.workspacePanel}>
              <div className={styles.wpHeader}>
                <span className={styles.wpEyebrow}>DELIVERY BRIEF</span>
                <span className={styles.wpId}>{activeDelivery.id}</span>
              </div>

              <div className={styles.briefInfo}>
                <h3 className={styles.briefLocation}>{linkedRequest?.zoneName.split(',')[0]}</h3>
                <span className={styles.briefSubtitle}>{linkedRequest?.zoneName.includes(',') ? linkedRequest.zoneName.split(',').slice(1).join(',').trim() : 'Active Area'}</span>
              </div>

              {/* Progress Tracker */}
              <div className={styles.progressSection}>
                <span className={styles.sectionLabel}>LIFECYCLE PIPELINE</span>
                <div className={styles.pipeline}>
                  {[
                    { label: 'ALLOCATED', done: true },
                    { label: 'DISPATCHED', done: true },
                    { label: 'ARRIVED', done: activeDelivery.status !== 'PENDING' },
                    { label: 'DELIVERY', done: activeDelivery.status === 'IN_DELIVERY' || activeDelivery.status === 'VERIFIED' },
                    { label: 'VERIFIED', done: activeDelivery.status === 'VERIFIED' }
                  ].map((p, idx) => (
                    <div key={idx} className={`${styles.pipeStep} ${p.done ? styles.pipeDone : ''}`}>
                      <div className={styles.pipeDot} />
                      <span className={styles.pipeLabel}>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.briefGrid}>
                <div>
                  <span className={styles.briefLabel}>REQUEST REFERENCE</span>
                  <span className={styles.briefValue}>{activeDelivery.demandId}</span>
                </div>
                <div>
                  <span className={styles.briefLabel}>CARGO TYPE</span>
                  <span className={styles.briefValue}>{activeDelivery.resourceType}</span>
                </div>
                <div>
                  <span className={styles.briefLabel}>REQUESTED UNITS</span>
                  <span className={styles.briefValue}>{activeDelivery.requestedQty.toLocaleString()} {activeDelivery.unit}</span>
                </div>
                <div>
                  <span className={styles.briefLabel}>ALLOCATED UNITS</span>
                  <span className={styles.briefValue}>{activeDelivery.allocatedQty.toLocaleString()} {activeDelivery.unit}</span>
                </div>
                <div>
                  <span className={styles.briefLabel}>LOGISTICS VEHICLE</span>
                  <span className={styles.briefValue}>{activeDelivery.vehicleId}</span>
                </div>
                <div>
                  <span className={styles.briefLabel}>OPERATOR IN CHARGE</span>
                  <span className={styles.briefValue}>{linkedVehicle?.driverName || 'Sgt. Harish Negi'}</span>
                </div>
              </div>

              {/* Contextual Flow Buttons */}
              <div className={styles.flowActions}>
                {activeDelivery.status === 'PENDING' && (
                  <button className={styles.primaryFlowBtn} onClick={() => setShowConfirmArrival(true)}>
                    CONFIRM SITE ARRIVAL &rarr;
                  </button>
                )}
                {activeDelivery.status === 'ARRIVED' && (
                  <button className={styles.primaryFlowBtn} onClick={() => setShowStartDelivery(true)}>
                    START SUPPLY DELIVERY &rarr;
                  </button>
                )}
                {activeDelivery.status === 'IN_DELIVERY' && (
                  <button className={styles.primaryFlowBtn} onClick={() => setShowVerification(true)}>
                    ENTER QUANTITY &amp; VERIFY &rarr;
                  </button>
                )}
                {activeDelivery.status === 'VERIFIED' && (
                  <div className={styles.verifiedCard}>
                    <div className={styles.vcTitleRow}>
                      <CheckCircle size={15} />
                      <span>DELIVERY VERIFIED</span>
                    </div>
                    <div className={styles.vcStats}>
                      <span>Delivered: <strong>{activeDelivery.deliveredQty.toLocaleString()} {activeDelivery.unit}</strong></span>
                      <span>Verified by: <strong>{activeDelivery.verifiedBy}</strong></span>
                    </div>
                    {activeDelivery.notes && <p className={styles.vcNotes}>"{activeDelivery.notes}"</p>}
                  </div>
                )}
              </div>

              {/* Reconcile meter preview for verified status */}
              {activeDelivery.status === 'VERIFIED' && (
                <div className={styles.reconcilePreview}>
                  <span className={styles.sectionLabel}>QUANTITY RECONCILIATION</span>
                  <div className={styles.reconcileBar}>
                    <div
                      className={styles.reconcileFill}
                      style={{ width: `${Math.min(100, (activeDelivery.deliveredQty / activeDelivery.requestedQty) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.reconcileText}>
                    <span>Reconciled: {Math.round((activeDelivery.deliveredQty / activeDelivery.requestedQty) * 100)}% of demand satisfied</span>
                    <span>Remaining: {(activeDelivery.requestedQty - activeDelivery.deliveredQty).toLocaleString()} {activeDelivery.unit}</span>
                  </div>
                </div>
              )}

              {/* Incident Closure Block */}
              {linkedIncident && activeDelivery.status === 'VERIFIED' && (
                <div className={styles.closureContainer}>
                  <span className={styles.sectionLabel}>INCIDENT CLOSED PROTOCOL</span>
                  <p className={styles.closureText}>
                    Incident: <strong>{linkedIncident.id} ({linkedIncident.location})</strong> is currently <strong>{linkedIncident.status}</strong>.
                  </p>
                  
                  {incidentClosureCheck.ready ? (
                    <div className={styles.closureReadyBox}>
                      <span>✓ ALL CRITICAL DEMANDS FULLY SATISFIED</span>
                      <button className={styles.closureBtn} onClick={() => setShowClosureModal(true)}>
                        CLOSE INCIDENT OPERATIONS
                      </button>
                    </div>
                  ) : (
                    <div className={styles.closureBlockBox}>
                      <Info size={13} />
                      <span>{incidentClosureCheck.activeCount} outstanding demand requests still active. Incident cannot be closed.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Arrival Modal ── */}
      {showConfirmArrival && activeDelivery && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>CONFIRM VEHICLE ARRIVAL</h3>
            <p>Verify that the logistics unit has safely entered the geofence perimeter.</p>
            <div className={styles.modalFields}>
              <div><span>VEHICLE FLEET</span><strong>{activeDelivery.vehicleId}</strong></div>
              <div><span>DESTINATION ZONE</span><strong>{activeDelivery.destinationName.split(',')[0]}</strong></div>
              <div><span>OPERATOR</span><strong>{linkedVehicle?.driverName || 'Sgt. Harish Negi'}</strong></div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setShowConfirmArrival(false)}>
                CANCEL
              </button>
              <button className={styles.modalConfirmBtn} onClick={handleConfirmArrival}>
                CONFIRM ARRIVAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Start Delivery Modal ── */}
      {showStartDelivery && activeDelivery && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>START FIELD DISTRIBUTION</h3>
            <p>Confirm that cargo offloading and relief handover operations have commenced.</p>
            <div className={styles.modalFields}>
              <div><span>CARGO ITEM</span><strong>{activeDelivery.resourceType}</strong></div>
              <div><span>QUANTITY</span><strong>{activeDelivery.allocatedQty.toLocaleString()} {activeDelivery.unit}</strong></div>
              <div><span>PERIMETER</span><strong>{activeDelivery.destinationName.split(',')[0]}</strong></div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setShowStartDelivery(false)}>
                CANCEL
              </button>
              <button className={styles.modalConfirmBtn} onClick={handleStartDelivery}>
                START DELIVERY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reconciliation & Verification Side Panel ── */}
      {showVerification && activeDelivery && (
        <div className={styles.panelOverlay}>
          <div className={styles.verifyPanel}>
            <div className={styles.vHeader}>
              <h3>DELIVERY RECONCILIATION &amp; VERIFICATION</h3>
              <button className={styles.vCloseBtn} onClick={() => setShowVerification(false)}>
                <X size={15} />
              </button>
            </div>
            
            <form onSubmit={handleVerifyDelivery} className={styles.vForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ACTUAL DELIVERED QUANTITY ({activeDelivery.unit})</label>
                <input
                  type="number"
                  value={inputQty}
                  onChange={e => setInputQty(e.target.value)}
                  max={activeDelivery.allocatedQty * 1.5}
                  min={0}
                  required
                />
              </div>

              {/* Dynamic feedback based on quantity entered */}
              {isOverDelivery && (
                <div className={`${styles.feedbackCard} ${styles.feedbackAlert}`}>
                  <AlertTriangle size={14} />
                  <div>
                    <strong>OVER-DELIVERY TRIGGERED</strong>
                    <span>Delivered quantity ({enteredQtyNum.toLocaleString()}) exceeds matched allocation. Cannot complete until approved.</span>
                  </div>
                </div>
              )}

              {isPartialDelivery && (
                <div className={`${styles.feedbackCard} ${styles.feedbackWarning}`}>
                  <Info size={14} />
                  <div>
                    <strong>PARTIAL FULFILLMENT WARNING</strong>
                    <span>Only {Math.round((enteredQtyNum / activeDelivery.requestedQty) * 100)}% of demand met. Outstanding {(activeDelivery.requestedQty - enteredQtyNum).toLocaleString()} units will generate a follow-up request.</span>
                  </div>
                </div>
              )}

              {!isOverDelivery && !isPartialDelivery && !isZeroDelivery && (
                <div className={`${styles.feedbackCard} ${styles.feedbackSuccess}`}>
                  <Check size={14} />
                  <div>
                    <strong>FULL FULFILLMENT APPROVED</strong>
                    <span>100% of demand satisfied. Reconciling resources cleanly.</span>
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>RECIPIENT / FIELD COORDINATOR NAME</label>
                <input
                  type="text"
                  value={inputOfficer}
                  onChange={e => setInputOfficer(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>PROOF OF DELIVERY REFERENCE ID</label>
                <input
                  type="text"
                  value={inputProofRef}
                  onChange={e => setInputProofRef(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>FIELD HANDOVER NOTES / OBSERVATIONS</label>
                <textarea
                  value={inputNotes}
                  onChange={e => setInputNotes(e.target.value)}
                  placeholder="Describe delivery conditions, damage metrics or recipient remarks..."
                  rows={4}
                />
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.vCancelBtn} onClick={() => setShowVerification(false)}>
                  CANCEL
                </button>
                <button
                  type="submit"
                  className={styles.vSubmitBtn}
                  disabled={isOverDelivery || isSubmitting}
                >
                  {isSubmitting ? 'VERIFYING...' : 'VERIFY & CONFIRM HANDOVER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Incident Closure Review Modal ── */}
      {showClosureModal && linkedIncident && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>INCIDENT RESOLUTION REVIEW</h3>
            <p>Confirm that the disaster scenario is fully closed. All critical operational objectives have been reconciled.</p>
            <div className={styles.modalRows}>
              <div className={styles.modalRow}>
                <span>INCIDENT ID</span><strong>{linkedIncident.id}</strong>
              </div>
              <div className={styles.modalRow}>
                <span>LOCATION</span><strong>{linkedIncident.location}</strong>
              </div>
              <div className={styles.modalRow}>
                <span>RESOURCES DISTRIBUTED</span><strong>100% RECONCILED</strong>
              </div>
              <div className={styles.modalRow}>
                <span>ACTIVE FIELD MISSIONS</span><strong>0</strong>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setShowClosureModal(false)}>
                CANCEL
              </button>
              <button className={styles.modalConfirmBtn} style={{ background: '#0B2119' }} onClick={handleCloseIncident}>
                CONFIRM RESOLUTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Relief Response Timeline ── */}
      {linkedIncident && (
        <section className={styles.timelineSection}>
          <div className={styles.timelineHeader}>
            <span className={styles.timelineEyebrow}>RELIEF RESPONSE TIMELINE</span>
            <h2 className={styles.timelineTitle}>Incident Execution Logs ({linkedIncident.id})</h2>
          </div>
          <div className={styles.timelineList}>
            {linkedIncident.timeline?.map((log, idx) => (
              <div key={idx} className={styles.timelineLog}>
                <div className={styles.logLeft}>
                  <span className={styles.logTime}>{log.time}</span>
                  <Clock size={11} className={styles.logIcon} />
                </div>
                <div className={styles.logRight}>
                  <strong className={styles.logTitle}>{log.title}</strong>
                  <p className={styles.logDesc}>{log.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Mission Lifecycle Pipeline ── */}
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
          <Link to="/operations/analytics" className={styles.lcLink}>
            CONTINUE TO DECISION-SUPPORT ANALYTICS &rarr;
          </Link>
        </div>
      </section>

      <PageGuidebook guideKey="delivery" />
    </div>
  );
};

export default Delivery;
