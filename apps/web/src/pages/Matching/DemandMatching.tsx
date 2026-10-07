import React, {
  useState, useMemo, useEffect, useRef, useCallback
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Search, X, Check, ChevronDown, ChevronUp, ArrowRight, Info } from 'lucide-react';
import { useOperationalState } from '../../context/OperationalStateContext';
import { useTranslation } from 'react-i18next';
import { EmptyState, NoResultsState } from '../../components/ui/SystemStates';
import { MapView } from '../../components/map/MapView';
import {
  matchResources,
  MATCH_WEIGHTS,
  type MatchResult,
  type MatchEngineOutput,
} from '../../engine/matchingEngine';
import type { DemandRequest } from '../../types/request';
import type { ResourceItem } from '../../types/resource';
import styles from './DemandMatching.module.css';
import { PageGuideTrigger, PageGuidebook } from '../../components/ui/PageGuide';
import { ShaderBackground } from '../../components/ui/ShaderBackground';

import GradientBackground from '../../components/ui/noisy-gradient-backgrounds';

gsap.registerPlugin(ScrollTrigger);

/* ─── Constants ──────────────────────────────────────────────────────────── */

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: '#C0392B', HIGH: '#E86F16', MEDIUM: '#D4A017', LOW: '#2E7D32',
};

const QUALITY_CFG: Record<string, { label: string; color: string }> = {
  EXCELLENT:    { label: 'EXCELLENT MATCH', color: '#2E7D32' },
  GOOD:         { label: 'GOOD MATCH',      color: '#0B2119' },
  PARTIAL:      { label: 'PARTIAL MATCH',   color: '#E86F16' },
  POOR:         { label: 'POOR MATCH',      color: '#C0392B' },
  INCOMPATIBLE: { label: 'INCOMPATIBLE',    color: '#6B7280' },
};

/* ─── Hooks ──────────────────────────────────────────────────────────────── */

// Simple power2.out ease without GSAP dependency
const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);

function useCountUp(target: number, duration = 1400, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let frame = 0;
    const total = Math.ceil(duration / 16);
    const timer = setInterval(() => {
      frame++;
      const progress = easeOut(Math.min(frame / total, 1));
      setVal(Math.round(target * progress));
      if (frame >= total) { setVal(target); clearInterval(timer); }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, active]);
  return val;
}

function useAnimatedBar(target: number, max: number, active = false) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!active) { setWidth(0); return; }
    setTimeout(() => setWidth((target / max) * 100), 80);
  }, [target, max, active]);
  return width;
}

/* ─── SVG Radial Score Meter ─────────────────────────────────────────────── */

interface RadialScoreProps {
  score: number;
  maxScore?: number;
  active: boolean;
  color?: string;
}

const RadialScore: React.FC<RadialScoreProps> = ({
  score, maxScore = 100, active, color = '#0B2119'
}) => {
  const displayed = useCountUp(score, 1600, active);
  const R = 52;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * R;
  const progress = active ? (score / maxScore) * circumference : 0;

  return (
    <div className={styles.radialWrap}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        {/* Track */}
        <circle cx={cx} cy={cy} r={R} fill="none"
          stroke="rgba(11,33,25,0.07)" strokeWidth={5} />
        {/* Fill */}
        <circle cx={cx} cy={cy} r={R} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className={styles.radialCenter}>
        <span className={styles.radialNum}>{displayed}</span>
        <span className={styles.radialDenom}>/100</span>
      </div>
    </div>
  );
};

/* ─── Score Bar Row ──────────────────────────────────────────────────────── */

interface ScoreBarRowProps {
  label: string;
  value: number;
  max: number;
  active: boolean;
}
const ScoreBarRow: React.FC<ScoreBarRowProps> = ({ label, value, max, active }) => {
  const width = useAnimatedBar(value, max, active);
  return (
    <div className={styles.scoreBarRow}>
      <span className={styles.scoreBarLabel}>{label}</span>
      <div className={styles.scoreBarTrack}>
        <div className={styles.scoreBarFill}
          style={{ width: `${width}%`, transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
      </div>
      <span className={styles.scoreBarVal}>{value}<span className={styles.scoreBarMax}>/{max}</span></span>
    </div>
  );
};

/* ─── Single Match Row ───────────────────────────────────────────────────── */

interface MatchRowProps {
  result: MatchResult;
  resource: ResourceItem;
  isTop: boolean;
  isExpanded: boolean;
  animateScore: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

const MatchRow: React.FC<MatchRowProps> = ({
  result, resource, isTop, isExpanded, animateScore, onToggle, onSelect
}) => {
  const qc = QUALITY_CFG[result.qualityLabel] ?? QUALITY_CFG.POOR;
  const score = useCountUp(result.matchScore, 1200, animateScore);

  return (
    <div className={`${styles.matchRow} ${isTop ? styles.matchRowTop : ''} ${isExpanded ? styles.matchRowExpanded : ''}`}>
      <div className={styles.matchRowMain} onClick={onToggle}>
        <div className={styles.matchRank}>{String(result.rank).padStart(2, '0')}</div>
        <div className={styles.matchRowInfo}>
          <span className={styles.matchRowName}>{resource.name}</span>
          <span className={styles.matchRowDepot}>{resource.locationName.split(',')[0]}</span>
        </div>
        <div className={styles.matchRowScoreArea}>
          <span className={styles.matchRowScore} style={{ color: qc.color }}>{score}</span>
          <span className={styles.matchRowScoreDenom}>/100</span>
        </div>
        <span className={styles.matchQualityTag} style={{ color: qc.color }}>{qc.label}</span>
        <span className={styles.matchRowMeta}>{resource.quantity.toLocaleString()} {resource.unit}</span>
        <span className={styles.matchRowDist}>{result.distanceKm} km</span>
        <div className={styles.matchRowChevron}>
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {isExpanded && (
        <div className={styles.matchRowDetail}>
          <div className={styles.matchDetailBars}>
            <ScoreBarRow label="Availability"   value={result.breakdown.availability}       max={MATCH_WEIGHTS.availability}       active={isExpanded} />
            <ScoreBarRow label="Distance"        value={result.breakdown.distance}            max={MATCH_WEIGHTS.distance}            active={isExpanded} />
            <ScoreBarRow label="Priority"        value={result.breakdown.priority}            max={MATCH_WEIGHTS.priority}            active={isExpanded} />
            <ScoreBarRow label="Compatibility"   value={result.breakdown.compatibility}       max={MATCH_WEIGHTS.compatibility}       active={isExpanded} />
            <ScoreBarRow label="Pressure"        value={result.breakdown.allocationPressure} max={MATCH_WEIGHTS.allocationPressure} active={isExpanded} />
          </div>
          <div className={styles.matchDetailReasons}>
            {result.reasoning.map((r, i) => (
              <div key={i} className={styles.reasonItem}
                style={{ animationDelay: `${i * 80}ms` }}>
                <Check size={9} className={styles.reasonCheck} />
                <span>{r}</span>
              </div>
            ))}
          </div>
          {isTop && (
            <button className={styles.matchSelectBtn} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
              USE THIS MATCH <ArrowRight size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Network Status ─────────────────────────────────────────────────────── */

interface NetworkStatusProps {
  resources: ResourceItem[];
  requests: DemandRequest[];
}
const NetworkStatus: React.FC<NetworkStatusProps> = ({ resources, requests }) => {
  const activeDepots   = new Set(resources.filter(r => r.status === 'AVAILABLE').map(r => r.locationName)).size;
  const available      = resources.filter(r => r.status === 'AVAILABLE' && r.quantity > 0).length;
  const allocated      = resources.filter(r => (r.allocatedQuantity ?? 0) > 0).length;
  const pending        = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className={styles.networkStatus}>
      <span className={styles.networkLabel}>NETWORK</span>
      <div className={styles.networkStats}>
        <span><strong>{activeDepots}</strong> depots</span>
        <span><strong>{available}</strong> available</span>
        <span><strong>{allocated}</strong> allocated</span>
        <span><strong>{pending}</strong> pending</span>
      </div>
    </div>
  );
};

/* ─── Recommendation Panel ───────────────────────────────────────────────── */

interface RecommendationPanelProps {
  bestMatch: MatchResult;
  demand: DemandRequest;
  resourceMap: Map<string, ResourceItem>;
  animateScore: boolean;
  onAuthorize: () => void;
  onAlternatives: () => void;
}

const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  bestMatch, demand, resourceMap, animateScore, onAuthorize, onAlternatives
}) => {
  const res = resourceMap.get(bestMatch.resourceId);
  const qc = QUALITY_CFG[bestMatch.qualityLabel] ?? QUALITY_CFG.POOR;
  const remaining = (res?.quantity ?? 0) - demand.quantity;

  if (!res) return null;

  return (
    <aside className={styles.recommendPanel}>
      <div className={styles.rpHeader}>
        <span className={styles.rpEyebrow}>RECOMMENDED MATCH</span>
        <div className={styles.rpScoreRow}>
          <RadialScore score={bestMatch.matchScore} active={animateScore} color={qc.color} />
          <div className={styles.rpScoreInfo}>
            <span className={styles.rpQualityTag} style={{ color: qc.color }}>{qc.label}</span>
            <h3 className={styles.rpResourceName}>{res.name}</h3>
            <span className={styles.rpDepotName}>{res.locationName.split(',')[0]}</span>
          </div>
        </div>
      </div>

      <div className={styles.rpMetaGrid}>
        <div className={styles.rpMetaCell}>
          <span className={styles.rpMetaLabel}>REQUESTED</span>
          <span className={styles.rpMetaVal}>{demand.quantity.toLocaleString()} {demand.unit}</span>
        </div>
        <div className={styles.rpMetaCell}>
          <span className={styles.rpMetaLabel}>AVAILABLE</span>
          <span className={styles.rpMetaVal}>{res.quantity.toLocaleString()} {res.unit}</span>
        </div>
        <div className={styles.rpMetaCell}>
          <span className={styles.rpMetaLabel}>DISTANCE & ETA</span>
          <span className={styles.rpMetaVal}>{bestMatch.distanceKm} km ({bestMatch.estimatedDeliveryTime})</span>
        </div>
        <div className={styles.rpMetaCell}>
          <span className={styles.rpMetaLabel}>FULFILLMENT</span>
          <span className={styles.rpMetaVal} style={{ color: bestMatch.canFullyFulfill ? '#2E7D32' : '#E86F16' }}>
            {bestMatch.canFullyFulfill ? 'FULL' : 'PARTIAL'}
          </span>
        </div>
      </div>

      <div className={styles.rpReasons}>
        <span className={styles.rpSectionLabel}>EXPLAINABLE DECISION REASONING</span>
        <div style={{
          padding: '10px 12px',
          background: 'rgba(11, 33, 25, 0.04)',
          borderRadius: '6px',
          fontSize: '0.82rem',
          lineHeight: '1.45',
          marginBottom: '10px',
          color: '#1e293b',
          borderLeft: '3px solid #0B2119',
          fontWeight: 500
        }}>
          "{bestMatch.explainableSentence}"
        </div>
        {bestMatch.reasoning.map((r, i) => (
          <div key={i} className={styles.rpReason} style={{ animationDelay: `${i * 100 + 200}ms` }}>
            <Check size={9} className={styles.rpCheck} />
            <span>{r}</span>
          </div>
        ))}
      </div>

      <div className={styles.rpDecision}>
        <span className={styles.rpSectionLabel}>ALLOCATION DECISION</span>
        <div className={styles.rpDecisionGrid}>
          <div className={styles.rpDecisionCell}>
            <span className={styles.rpDecisionLabel}>Recommended allocation</span>
            <span className={styles.rpDecisionVal}>{demand.quantity.toLocaleString()} {demand.unit}</span>
          </div>
          <div className={styles.rpDecisionCell}>
            <span className={styles.rpDecisionLabel}>Remaining depot stock</span>
            <span className={styles.rpDecisionVal} style={{ color: remaining <= 0 ? '#C0392B' : undefined }}>
              {remaining > 0 ? `${remaining.toLocaleString()} ${res.unit}` : 'DEPLETED'}
            </span>
          </div>
        </div>
        <p className={styles.rpDecisionNote}>
          The engine recommends this allocation. Authorized operator confirmation required before commitment.
        </p>
        <button className={styles.rpAuthorizeBtn} onClick={onAuthorize}>
          AUTHORIZE ALLOCATION <ArrowRight size={12} />
        </button>
        <button className={styles.rpAlternativesBtn} onClick={onAlternatives}>
          REVIEW ALTERNATIVES
        </button>
      </div>
    </aside>
  );
};

/* ─── Review Panel (slide-in) ────────────────────────────────────────────── */
interface ReviewPanelProps {
  reviewTarget: MatchResult;
  demand: DemandRequest;
  resourceMap: Map<string, ResourceItem>;
  onClose: () => void;
  onApprove: () => void;
}
const ReviewPanel: React.FC<ReviewPanelProps> = ({
  reviewTarget, demand, resourceMap, onClose, onApprove
}) => {
  const res = resourceMap.get(reviewTarget.resourceId);
  if (!res) return null;
  const remaining = res.quantity - demand.quantity;
  return (
    <div className={styles.reviewOverlay}>
      <div className={styles.reviewPanel}>
        <div className={styles.reviewPanelHeader}>
          <span>MATCH REVIEW</span>
          <button onClick={onClose}><X size={15} /></button>
        </div>
        <div className={styles.reviewGrid}>
          <div className={styles.reviewBlock}><span>DEMAND</span><strong>{demand.id}</strong><em>{demand.quantity.toLocaleString()} {demand.unit} {demand.itemNeeded}</em><b style={{ color: PRIORITY_COLOR[demand.priority] }}>{demand.priority}</b></div>
          <div className={styles.reviewBlock}><span>RESOURCE</span><strong>{res.name}</strong><em>{res.locationName.split(',')[0]}</em><em>{res.quantity.toLocaleString()} {res.unit} available</em></div>
          <div className={styles.reviewBlock}><span>DISTANCE</span><strong>{reviewTarget.distanceKm} km</strong></div>
          <div className={styles.reviewBlock}><span>MATCH SCORE</span><strong>{reviewTarget.matchScore} / 100</strong></div>
        </div>
        <div className={styles.reviewImpact}>
          <span>IMPACT AFTER ALLOCATION</span>
          <div><span>Remaining stock</span><strong style={{ color: remaining <= 0 ? '#C0392B' : '#2E7D32' }}>{remaining > 0 ? `${remaining.toLocaleString()} ${res.unit}` : 'DEPLETED'}</strong></div>
          <div><span>Other demands affected</span><strong>0</strong></div>
        </div>
        <div className={styles.reviewActions}>
          <button className={styles.rejectBtn} onClick={onClose}>REJECT</button>
          <button className={styles.approveBtn} onClick={onApprove}>APPROVE ALLOCATION</button>
        </div>
      </div>
    </div>
  );
};

/* ─── Confirm Modal ───────────────────────────────────────────────────────── */
interface ConfirmModalProps {
  reviewTarget: MatchResult;
  demand: DemandRequest;
  resourceMap: Map<string, ResourceItem>;
  onCancel: () => void;
  onConfirm: () => void;
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  reviewTarget, demand, resourceMap, onCancel, onConfirm
}) => {
  const res = resourceMap.get(reviewTarget.resourceId);
  if (!res) return null;
  const remaining = res.quantity - demand.quantity;
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>CONFIRM RESOURCE ALLOCATION</h3>
        <div className={styles.modalRows}>
          {[
            ['DEMAND', demand.id],
            ['RESOURCE', res.name],
            ['DEPOT', res.locationName.split(',')[0]],
            ['QUANTITY', `${demand.quantity.toLocaleString()} ${res.unit}`],
            ['REMAINING STOCK', remaining > 0 ? `${remaining.toLocaleString()} ${res.unit}` : 'DEPLETED after allocation'],
            ['CRITICAL IMPACT', 'None'],
          ].map(([label, val]) => (
            <div key={label} className={styles.modalRow}>
              <span>{label}</span>
              <strong style={{ color: label === 'REMAINING STOCK' && remaining <= 0 ? '#C0392B' : undefined }}>{val}</strong>
            </div>
          ))}
        </div>
        <div className={styles.modalStatusRow}>
          {[['DEMAND', '→ ALLOCATED'], ['RESOURCE', '→ COMMITTED'], ['VEHICLE', '→ PENDING']].map(([k, v]) => (
            <div key={k} className={styles.modalStatusTag}><span>{k}</span><strong>{v}</strong></div>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onCancel}>CANCEL</button>
          <button className={styles.modalConfirmBtn} onClick={onConfirm}>CONFIRM ALLOCATION</button>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */

export const DemandMatching: React.FC = () => {
  const { t } = useTranslation();
  const { requests, resources, incidents, allocateResourceToRequest } = useOperationalState();

  /* — State — */
  const [searchQuery, setSearchQuery]       = useState('');
  const [selectedDemand, setSelectedDemand] = useState<DemandRequest | null>(null);
  const [isAnalyzing, setIsAnalyzing]       = useState(false);
  const [matchOutput, setMatchOutput]       = useState<MatchEngineOutput | null>(null);
  const [showResults, setShowResults]       = useState(false);
  const [animateScore, setAnimateScore]     = useState(false);
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [reviewTarget, setReviewTarget]     = useState<MatchResult | null>(null);
  const [showReview, setShowReview]         = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showScoringLogic, setShowScoringLogic] = useState(false);
  const [allocationId, setAllocationId]     = useState<string | null>(null);
  const [scoringActive, setScoringActive]   = useState(false);

  /* — Refs — */
  const pageRef        = useRef<HTMLDivElement>(null);
  const heroRef        = useRef<HTMLElement>(null);
  const selectorRef    = useRef<HTMLDivElement>(null);
  const workspaceRef   = useRef<HTMLDivElement>(null);

  /* — Resource map — */
  const resourceMap = useMemo(
    () => new Map(resources.map(r => [r.id, r])),
    [resources]
  );

  /* — Matchable demands — */
  const matchableDemands = useMemo(
    () => requests.filter(r => r.status === 'PENDING' || r.status === 'MATCHED'),
    [requests]
  );

  const filteredDemands = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchableDemands;
    return matchableDemands.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.zoneName.toLowerCase().includes(q) ||
      r.itemNeeded.toLowerCase().includes(q) ||
      r.priority.toLowerCase().includes(q)
    );
  }, [matchableDemands, searchQuery]);

  /* — Related incident — */
  const relatedIncident = useMemo(() => {
    if (!selectedDemand?.incidentId) return null;
    return incidents.find(i => i.id === selectedDemand.incidentId) ?? null;
  }, [selectedDemand, incidents]);

  /* — Map resource — */
  const mapResources = useMemo<ResourceItem[]>(() => {
    if (!reviewTarget) return [];
    const r = resourceMap.get(reviewTarget.resourceId);
    return r ? [r] : [];
  }, [reviewTarget, resourceMap]);

  /* — Allocation state — */
  const liveSelectedDemand = selectedDemand
    ? requests.find(r => r.id === selectedDemand.id)
    : null;
  const isAllocated = liveSelectedDemand?.status === 'ALLOCATED';

  /* ── GSAP entrance animation ── */
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let ctx: any;
    try {
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

        if (heroRef.current) {
          tl.fromTo(heroRef.current,
            { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 0);
        }
        if (selectorRef.current) {
          tl.fromTo(selectorRef.current,
            { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, 0.2);
        }
        tl.fromTo(`.${styles.demandQueueRow}`,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.07 }, 0.35);
      }, pageRef);
    } catch (e) {
      console.error("GSAP entrance animation failed:", e);
    }

    return () => {
      if (ctx) ctx.revert();
    };
  }, [filteredDemands.length]);

  /* ── Run matching engine ── */
  const runMatching = useCallback((demand: DemandRequest) => {
    setIsAnalyzing(true);
    setShowResults(false);
    setAnimateScore(false);
    setMatchOutput(null);
    setExpandedId(null);
    setReviewTarget(null);
    setShowReview(false);
    setAllocationId(null);
    setShowAlternatives(false);

    // Short analysis pulse (600ms max)
    setTimeout(() => {
      const output = matchResources(demand, resources, { otherRequests: requests });
      setMatchOutput(output);
      if (output.bestMatch) {
        setReviewTarget(output.bestMatch);
        setExpandedId(output.bestMatch.resourceId);
      }
      setIsAnalyzing(false);

      // Animate workspace in
      setTimeout(() => {
        setShowResults(true);
        setTimeout(() => setAnimateScore(true), 150);

        // Stagger rows
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReducedMotion && workspaceRef.current) {
          gsap.fromTo(workspaceRef.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
          );
          gsap.fromTo(`.${styles.matchRow}`,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.35, stagger: 0.09, delay: 0.1, ease: 'power2.out' }
          );
        }
      }, 40);
    }, 580);
  }, [resources, requests]);

  const handleSelectDemand = (demand: DemandRequest) => {
    setSelectedDemand(demand);
    setSearchQuery('');
    runMatching(demand);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && selectorRef.current) {
      // Shrink selector area subtly
      gsap.to(`.${styles.demandQueueRow}:not(.${styles.demandRowActive})`,
        { opacity: 0.35, duration: 0.3 }
      );
    }
  };

  const handleConfirmAllocation = () => {
    if (!selectedDemand || !reviewTarget) return;
    const id = allocateResourceToRequest(selectedDemand.id, reviewTarget.resourceId, selectedDemand.quantity);
    setAllocationId(id);
    setShowConfirm(false);
    setShowReview(false);
  };

  /* ─── Scoring logic bar animation ─── */
  useEffect(() => {
    if (showScoringLogic) setTimeout(() => setScoringActive(true), 80);
    else setScoringActive(false);
  }, [showScoringLogic]);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const reqId = searchParams.get('requestId');
    if (reqId) {
      const req = requests.find(r => r.id === reqId);
      if (req && (!selectedDemand || selectedDemand.id !== req.id)) {
        handleSelectDemand(req);
      }
    }
  }, [requests, searchParams, selectedDemand]);

  /* ══════════════════════ RENDER ════════════════════════ */
  return (
    <div ref={pageRef} className={styles.page}>
      <GradientBackground />

      {/* ── Operational Header ── */}
      <header ref={heroRef} className={`${styles.hero} shaderHeaderWrapper`}>
        <ShaderBackground className="absolute inset-0" />
        <div className={styles.heroLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className={styles.heroEyebrow} style={{ marginBottom: 0 }}>{t('matching.title')}</span>
            <PageGuideTrigger />
          </div>
          <h1 className={styles.heroTitle}>{t('matching.title')}</h1>
          <p className={styles.heroLead}>
            {t('matching.subtitle')}
          </p>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.engineStatus}>
            <span className={styles.engineDot} />
            <span className={styles.engineLabel}>{t('common.active')}</span>
          </div>
          <p className={styles.engineSub}>{t('matching.aiMatchConfidence')}</p>
          <NetworkStatus resources={resources} requests={requests} />
        </div>
      </header>

      {/* ── Demand Selection Workspace ── */}
      <div ref={selectorRef} className={styles.selectorWorkspace}>
        <div className={styles.selectorTop}>
          <span className={styles.selectorEyebrow}>{t('demands.title')}</span>
          <div className={styles.searchBox}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('demands.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.clearBtn} onClick={() => setSearchQuery('')}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Demand Queue */}
        <div className={styles.demandQueue}>
          {matchableDemands.length === 0 ? (
            <EmptyState
              title={t('matching.noMatches')}
              description={t('matching.noMatches')}
              iconType="check"
            />
          ) : filteredDemands.length === 0 ? (
            <NoResultsState
              query={searchQuery}
              onClear={() => setSearchQuery('')}
            />
          ) : (
            filteredDemands.map(d => {
              const isActive = selectedDemand?.id === d.id;
              return (
                <button
                  key={d.id}
                  className={`${styles.demandQueueRow} ${isActive ? styles.demandRowActive : ''}`}
                  onClick={() => handleSelectDemand(d)}
                >
                  <span className={styles.dqId}>{d.id}</span>
                  <span className={styles.dqPriority} style={{ color: PRIORITY_COLOR[d.priority] }}>{t(`severity.${d.priority}`) || d.priority}</span>
                  <span className={styles.dqQty}>{d.quantity.toLocaleString()} {d.unit}</span>
                  <span className={styles.dqItem}>{d.itemNeeded}</span>
                  <span className={styles.dqZone}>{d.zoneName.split(',')[0]}</span>
                  <span className={styles.dqAffected}>{d.affectedCount.toLocaleString()}</span>
                  <span className={styles.dqStatus}>{t(`status.${d.status}`) || d.status}</span>
                  <ArrowRight size={12} className={styles.dqArrow} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Analyzing pulse ── */}
      {isAnalyzing && (
        <div className={styles.analyzingBar}>
          <div className={styles.analyzingPulse} />
          <span>ENGINE ANALYZING DEMAND → SCORING CANDIDATES</span>
        </div>
      )}

      {/* ── Main Workspace (after selection + analysis) ── */}
      {selectedDemand && showResults && matchOutput && (
        <div ref={workspaceRef} className={styles.workspace}>

          {/* LEFT COL */}
          <div className={styles.leftCol}>

            {/* Demand Context */}
            <div className={styles.demandContext}>
              <span className={styles.dcEyebrow}>DEMAND CONTEXT</span>
              <div className={styles.dcIdRow}>
                <span className={styles.dcId}>{selectedDemand.id}</span>
                <span className={styles.dcPriority} style={{ color: PRIORITY_COLOR[selectedDemand.priority] }}>
                  {selectedDemand.priority}
                </span>
                {isAllocated && allocationId && (
                  <span className={styles.dcAllocated}>ALLOCATED · {allocationId}</span>
                )}
              </div>
              <div className={styles.dcGrid}>
                <div className={styles.dcStat}>
                  <span className={styles.dcStatVal}>{selectedDemand.zoneName.split(',')[0]}</span>
                  <span className={styles.dcStatLabel}>{selectedDemand.zoneName.includes(',') ? selectedDemand.zoneName.split(',').slice(1).join(',').trim() : 'Demand location'}</span>
                </div>
                <div className={styles.dcStat}>
                  <span className={styles.dcStatVal}>{selectedDemand.affectedCount.toLocaleString()}</span>
                  <span className={styles.dcStatLabel}>People affected</span>
                </div>
                <div className={styles.dcStat}>
                  <span className={styles.dcStatVal}>{selectedDemand.quantity.toLocaleString()} {selectedDemand.unit}</span>
                  <span className={styles.dcStatLabel}>{selectedDemand.itemNeeded} required</span>
                </div>
                <div className={styles.dcStat}>
                  <span className={styles.dcStatVal}>
                    {selectedDemand.priority === 'CRITICAL' ? 'IMMEDIATE' : '< 4 HOURS'}
                  </span>
                  <span className={styles.dcStatLabel}>Required by</span>
                </div>
              </div>
              {relatedIncident && (
                <div className={styles.dcIncident}>
                  <span>Linked incident</span>
                  <Link to={`/operations/incidents/${relatedIncident.id}/response`} className={styles.dcIncidentLink}>
                    {relatedIncident.id} → {relatedIncident.location}
                  </Link>
                </div>
              )}
            </div>

            {/* Matching Results */}
            <div className={styles.matchingSection}>
              <div className={styles.matchingHeader}>
                <span className={styles.matchingEyebrow}>MATCHING ANALYSIS</span>
                <span className={styles.matchingCount}>{matchOutput.results.length} candidate{matchOutput.results.length !== 1 ? 's' : ''} evaluated</span>
              </div>

              {matchOutput.results.length === 0 ? (
                <div className={styles.noMatch}>
                  No compatible resources found for category "{selectedDemand.category}".
                </div>
              ) : (
                <div className={styles.matchList}>
                  {matchOutput.results.map(result => {
                    const res = resourceMap.get(result.resourceId);
                    if (!res) return null;
                    return (
                      <MatchRow
                        key={result.resourceId}
                        result={result}
                        resource={res}
                        isTop={result.rank === 1}
                        isExpanded={expandedId === result.resourceId}
                        animateScore={animateScore}
                        onToggle={() => setExpandedId(
                          expandedId === result.resourceId ? null : result.resourceId
                        )}
                        onSelect={() => {
                          setReviewTarget(result);
                          setShowReview(true);
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Shortfall / Split */}
              {matchOutput.shortfall > 0 && (
                <div className={styles.shortfallNote}>
                  Shortfall: {matchOutput.shortfall.toLocaleString()} {selectedDemand.unit} unavailable.
                  {matchOutput.splitAllocation?.isFulfilled && ' Split allocation available.'}
                </div>
              )}

              {/* Split Allocation */}
              {matchOutput.splitAllocation && !matchOutput.canFulfill && (
                <div className={styles.splitSection}>
                  <span className={styles.splitEyebrow}>SPLIT ALLOCATION</span>
                  <p className={styles.splitDesc}>
                    {matchOutput.splitAllocation.isFulfilled
                      ? 'No single source meets the full demand. Combination allocation is possible:'
                      : `Partial coverage only. Best combination: ${matchOutput.splitAllocation.totalQuantity.toLocaleString()} of ${matchOutput.splitAllocation.requestedQuantity.toLocaleString()} ${selectedDemand.unit}.`}
                  </p>
                  <div className={styles.splitParts}>
                    {matchOutput.splitAllocation.parts.map((part, i) => {
                      const r = resourceMap.get(part.resourceId);
                      if (!r) return null;
                      return (
                        <div key={part.resourceId} className={styles.splitPart}>
                          {i > 0 && <span className={styles.splitPlus}>+</span>}
                          <div className={styles.splitCard}>
                            <span className={styles.splitName}>{r.name}</span>
                            <span className={styles.splitDepot}>{r.locationName.split(',')[0]}</span>
                            <span className={styles.splitQty}>{part.quantity.toLocaleString()} {r.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scoring Logic */}
              <div className={styles.scoringLogicSection}>
                <button
                  className={styles.scoringLogicToggle}
                  onClick={() => setShowScoringLogic(v => !v)}
                >
                  <Info size={11} />
                  HOW WAS THIS MATCH SCORED?
                  {showScoringLogic ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                {showScoringLogic && (
                  <div className={styles.scoringLogicBody}>
                    {[
                      { label: 'Availability', weight: MATCH_WEIGHTS.availability },
                      { label: 'Distance', weight: MATCH_WEIGHTS.distance },
                      { label: 'Demand Priority', weight: MATCH_WEIGHTS.priority },
                      { label: 'Compatibility', weight: MATCH_WEIGHTS.compatibility },
                      { label: 'Allocation Pressure', weight: MATCH_WEIGHTS.allocationPressure },
                    ].map(({ label, weight }) => (
                      <ScoreBarRow key={label} label={label} value={weight} max={100} active={scoringActive} />
                    ))}
                    <p className={styles.scoringNote}>
                      Weighted deterministic model. Weights are centralized constants, replaceable with ML-ranked scoring in future iterations.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Compare Alternatives */}
            {matchOutput.results.length > 1 && (
              <div className={styles.compareSection}>
                <button
                  className={styles.compareToggle}
                  onClick={() => setShowAlternatives(v => !v)}
                >
                  COMPARE ALTERNATIVES
                  {showAlternatives ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showAlternatives && (
                  <div className={styles.compareTable}>
                    <div className={styles.compareHead}>
                      <span>RESOURCE</span><span>SCORE</span><span>STOCK</span><span>DISTANCE</span><span>STATUS</span>
                    </div>
                    {matchOutput.results.slice(0, 4).map(r => {
                      const res = resourceMap.get(r.resourceId);
                      if (!res) return null;
                      return (
                        <div key={r.resourceId} className={`${styles.compareRow} ${r.rank === 1 ? styles.compareRowBest : ''}`}>
                          <div className={styles.compareResName}>
                            <span>{res.locationName.split(',')[0]}</span>
                            <span className={styles.compareResType}>{res.name}</span>
                          </div>
                          <span style={{ color: QUALITY_CFG[r.qualityLabel]?.color }}>{r.matchScore}</span>
                          <span>{res.quantity.toLocaleString()} {res.unit}</span>
                          <span>{r.distanceKm} km</span>
                          <span className={`${styles.compareStatus} ${res.status === 'AVAILABLE' ? styles.compareAvail : styles.compareLow}`}>{res.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Map Context */}
            {reviewTarget && (
              <div className={styles.mapSection}>
                <span className={styles.mapEyebrow}>GEOGRAPHIC CONTEXT</span>
                <div className={styles.mapContainer}>
                  <MapView
                    incidents={relatedIncident ? [relatedIncident] : []}
                    resources={mapResources}
                    vehicles={[]}
                    shelters={[]}
                    layerFilters={{ incidents: !!relatedIncident, resources: true, vehicles: false, shelters: false, routes: false }}
                  />
                </div>
                <div className={styles.mapLegend}>
                  {relatedIncident && <span><span className={styles.mapDot} style={{ background: '#C0392B' }} /> Demand location</span>}
                  <span><span className={styles.mapDot} style={{ background: '#2E7D32' }} /> Resource depot</span>
                  {reviewTarget && <span className={styles.mapDist}>{reviewTarget.distanceKm} km between sites</span>}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COL */}
          <div className={styles.rightCol}>
            {isAllocated && allocationId ? (
              <div className={styles.allocatedState}>
                <div className={styles.allocCheck}><Check size={20} /></div>
                <h3>RESOURCE ALLOCATED</h3>
                <p>Ref: {allocationId}</p>
                <div className={styles.allocStateGrid}>
                  {[['DEMAND','ALLOCATED'],['RESOURCE','COMMITTED'],['INCIDENT','RESOURCE MATCHED'],['NEXT','VEHICLE DISPATCH →']].map(([k,v]) => (
                    <div key={k}><span>{k}</span><strong>{v}</strong></div>
                  ))}
                </div>
                <p className={styles.allocNote}>Ready for Dispatch &amp; Logistics phase. Vehicle and responder assignment required.</p>
                <Link
                  to={`/operations/dispatch?allocationId=${selectedDemand.id}`}
                  className={styles.dispatchNextBtn}
                >
                  <span>ASSIGN FLEET &amp; CREATE MISSION</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : matchOutput?.bestMatch ? (
              <RecommendationPanel
                bestMatch={matchOutput.bestMatch}
                demand={selectedDemand}
                resourceMap={resourceMap}
                animateScore={animateScore}
                onAuthorize={() => setShowReview(true)}
                onAlternatives={() => setShowAlternatives(true)}
              />
            ) : (
              <div className={styles.noMatchPanel}>
                <span>No suitable match found. Consider split allocation or escalation.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {showReview && reviewTarget && selectedDemand && (
        <ReviewPanel
          reviewTarget={reviewTarget}
          demand={selectedDemand}
          resourceMap={resourceMap}
          onClose={() => setShowReview(false)}
          onApprove={() => { setShowReview(false); setShowConfirm(true); }}
        />
      )}

      {showConfirm && reviewTarget && selectedDemand && (
        <ConfirmModal
          reviewTarget={reviewTarget}
          demand={selectedDemand}
          resourceMap={resourceMap}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirmAllocation}
        />
      )}
      <PageGuidebook guideKey="matching" />
    </div>
  );
};

export default DemandMatching;
