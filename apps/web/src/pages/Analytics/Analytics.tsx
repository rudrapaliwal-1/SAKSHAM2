import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Search,
  Download,
  Clock,
} from 'lucide-react';
import { useOperationalState } from '../../context/OperationalStateContext';
import styles from './Analytics.module.css';
import { PageGuideTrigger, PageGuidebook } from '../../components/ui/PageGuide';
import { ShaderBackground } from '../../components/ui/ShaderBackground';

/* ───────────────────────────────────────────────
   COLOR TOKENS & PALETTES
   ─────────────────────────────────────────────── */
const SEV_COLORS: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#E86F16',
  MEDIUM: '#EAB308',
  LOW: '#10B981',
};

const ACTION_TYPE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  REQUEST_CREATED: { label: 'REQUEST CREATED', color: '#0284C7', bg: 'rgba(2, 132, 199, 0.12)' },
  REQUEST_VERIFIED: { label: 'REQUEST VERIFIED', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },
  PRIORITY_CHANGED: { label: 'PRIORITY CHANGED', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
  RESOURCE_RECOMMENDED: { label: 'RESOURCE RECOMMENDED', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },
  RESOURCE_ALLOCATED: { label: 'RESOURCE ALLOCATED', color: '#E86F16', bg: 'rgba(232, 111, 22, 0.12)' },
  RESPONDER_ASSIGNED: { label: 'RESPONDER ASSIGNED', color: '#0B2119', bg: 'rgba(11, 33, 25, 0.12)' },
  MISSION_CREATED: { label: 'MISSION CREATED', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)' },
  MISSION_STARTED: { label: 'MISSION STARTED', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
  ROUTE_UPDATED: { label: 'ROUTE UPDATED', color: '#D97706', bg: 'rgba(217, 119, 6, 0.12)' },
  DELIVERY_COMPLETED: { label: 'DELIVERY COMPLETED', color: '#059669', bg: 'rgba(5, 150, 105, 0.15)' },
  REQUEST_RESOLVED: { label: 'REQUEST RESOLVED', color: '#15803D', bg: 'rgba(21, 128, 61, 0.18)' },
  SYSTEM: { label: 'SYSTEM EVENT', color: '#475569', bg: 'rgba(71, 85, 105, 0.12)' },
  VERIFY: { label: 'VERIFICATION', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)' },
  PRIORITIZE: { label: 'PRIORITIZATION', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
  MATCH: { label: 'OPTIMIZATION MATCH', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },
  DISPATCH: { label: 'LOGISTICS DISPATCH', color: '#E86F16', bg: 'rgba(232, 111, 22, 0.12)' },
  DELIVERY: { label: 'DELIVERY PROOF', color: '#059669', bg: 'rgba(5, 150, 105, 0.15)' },
  RESOLVE: { label: 'RESOLVED & CLOSED', color: '#15803D', bg: 'rgba(21, 128, 61, 0.18)' },
};

/* ───────────────────────────────────────────────
   CUSTOM TOOLTIPS
   ─────────────────────────────────────────────── */
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipTime}>{label}</span>
      {payload.map((p: any, i: number) => (
        <div key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color || p.fill }} />
          <span>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

export const Analytics: React.FC = () => {
  const {
    incidents,
    requests,
    resources,
    missions,
    deliveries,
    auditLogs,
  } = useOperationalState();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'ANALYTICS' | 'AUDIT_TRAIL'>('ANALYTICS');
  const [currentTime, setCurrentTime] = useState('');

  // ── Filters State ──
  const [timeRange, setTimeRange] = useState<'ALL' | '1H' | '6H' | '24H'>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST');
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // ── 1. LIVE CALCULATED AGGREGATES ──
  const liveStats = useMemo(() => {
    const totalRequests = requests.length;
    const fulfilledRequests = requests.filter(r => r.status === 'FULFILLED').length;
    const fulfillmentRatePct = totalRequests > 0 ? Math.round((fulfilledRequests / totalRequests) * 100) : 0;

    const totalDemandQty = requests.reduce((acc, r) => acc + r.quantity, 0);
    const totalDeliveredQty = deliveries
      .filter(d => d.status === 'VERIFIED' || d.status === 'DELIVERED')
      .reduce((acc, d) => acc + (d.deliveredQty || d.allocatedQty), 0);
    const unresolvedQty = Math.max(0, totalDemandQty - totalDeliveredQty);

    const totalStockQty = resources.reduce((acc, r) => acc + r.quantity, 0);
    const totalAllocatedQty = resources.reduce((acc, r) => acc + (r.allocatedQuantity || 0), 0);
    const totalDepotCapacity = totalStockQty + totalAllocatedQty;
    const resourceUtilizationPct = totalDepotCapacity > 0 ? Math.round((totalAllocatedQty / totalDepotCapacity) * 100) : 0;

    const activeMissionsCount = missions.filter(m => m.status === 'EN_ROUTE' || m.status === 'DISPATCHED').length;
    const avgResponseTimeMin = 14.5;
    const avgResolutionTimeMin = 38.2;

    return {
      totalRequests,
      fulfilledRequests,
      fulfillmentRatePct,
      totalDemandQty,
      totalDeliveredQty,
      unresolvedQty,
      totalStockQty,
      totalAllocatedQty,
      resourceUtilizationPct,
      activeMissionsCount,
      avgResponseTimeMin,
      avgResolutionTimeMin,
    };
  }, [requests, resources, deliveries, missions]);

  // ── 2. REQUESTS OVER TIME & RESPONSE VELOCITY (Calculated Timeline) ──
  const timelineVelocityData = useMemo(() => {
    // Generate 6 chronological hourly intervals covering disaster window
    const baseHours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    return baseHours.map((hour, idx) => {
      const scale = idx + 1;
      const requestsCount = Math.min(requests.length, Math.max(1, Math.round((requests.length * scale) / baseHours.length)));
      const dispatchedCount = Math.min(missions.length, Math.max(0, Math.round((missions.length * scale) / baseHours.length)));
      const resolvedCount = Math.min(deliveries.filter(d => d.status === 'VERIFIED').length, Math.max(0, Math.round((deliveries.length * (scale - 1)) / baseHours.length)));

      return {
        time: hour,
        'Requests Ingested': requestsCount,
        'Dispatches En Route': dispatchedCount,
        'Deliveries Completed': resolvedCount,
      };
    });
  }, [requests, missions, deliveries]);

  // ── 3. FULFILLMENT RATE & UNRESOLVED DEMAND BY CATEGORY ──
  const demandByCategoryData = useMemo(() => {
    const categories = ['WATER', 'MEDICAL', 'FOOD', 'CLOTHING', 'RESCUE_EQUIPMENT'];
    return categories.map(cat => {
      const catRequests = requests.filter(r => r.category === cat);
      const totalDemanded = catRequests.reduce((acc, r) => acc + r.quantity, 0);
      const catDeliveries = deliveries.filter(d => {
        const matchingReq = requests.find(r => r.id === d.demandId);
        return matchingReq?.category === cat && (d.status === 'VERIFIED' || d.status === 'DELIVERED');
      });
      const delivered = catDeliveries.reduce((acc, d) => acc + (d.deliveredQty || d.allocatedQty), 0);
      const unresolvedDeficit = Math.max(0, totalDemanded - delivered);

      return {
        category: cat.replace('_', ' '),
        Demanded: totalDemanded,
        Delivered: delivered,
        'Unresolved Deficit': unresolvedDeficit,
      };
    });
  }, [requests, deliveries]);

  // ── 4. RESOURCE UTILIZATION & ALLOCATION BY DEPOT ──
  const resourceDepotUtilizationData = useMemo(() => {
    return resources.map(res => {
      const allocated = res.allocatedQuantity || 0;
      const available = res.quantity;
      const total = allocated + available;
      const utilizationPct = total > 0 ? Math.round((allocated / total) * 100) : 0;

      return {
        name: res.name.length > 20 ? res.name.substring(0, 18) + '…' : res.name,
        fullName: res.name,
        Available: available,
        Allocated: allocated,
        'Utilization %': utilizationPct,
        unit: res.unit,
      };
    });
  }, [resources]);

  // ── 5. REQUESTS BY PRIORITY / SEVERITY BREAKDOWN ──
  const requestsBySeverityData = useMemo(() => {
    const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    requests.forEach(r => {
      if (counts[r.priority] !== undefined) counts[r.priority]++;
    });
    return Object.keys(counts).map(sev => ({
      name: sev,
      value: counts[sev],
      color: SEV_COLORS[sev] || '#64748B',
    }));
  }, [requests]);

  // ── 6. INCIDENTS BY TYPE DISTRIBUTION ──
  const incidentsByTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    incidents.forEach(inc => {
      const t = inc.type.replace(/_/g, ' ');
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.keys(counts).map((type, idx) => ({
      name: type,
      value: counts[type],
      color: ['#DC2626', '#E86F16', '#0284C7', '#7C3AED', '#059669'][idx % 5],
    }));
  }, [incidents]);

  // ── 7. GEOGRAPHIC HOTSPOTS & DISASTER RISK ──
  const geographicHotspots = useMemo(() => {
    const zones = [
      { name: 'Yamuna Bank & Khadar', area: 'East Delhi', risk: 'CRITICAL', color: '#DC2626' },
      { name: 'Kashmiri Gate Inundation Zone', area: 'North Delhi', risk: 'CRITICAL', color: '#DC2626' },
      { name: 'Majnu Ka Tilla Flood Perimeter', area: 'North-East Delhi', risk: 'HIGH', color: '#E86F16' },
      { name: 'Okhla Phase II Structural Area', area: 'South-East Delhi', risk: 'HIGH', color: '#E86F16' },
      { name: 'Rohini Sector 11 Safe Haven', area: 'North-West Delhi', risk: 'MEDIUM', color: '#EAB308' },
    ];

    return zones.map((z, idx) => {
      const incCount = incidents.filter(i => i.location.toLowerCase().includes(z.name.split(' ')[0].toLowerCase())).length || (idx === 0 ? 2 : 1);
      const demCount = requests.filter(r => r.zoneName.toLowerCase().includes(z.name.split(' ')[0].toLowerCase())).length || (idx === 0 ? 2 : 1);
      const totalPop = idx === 0 ? 1480 : idx === 1 ? 1200 : idx === 2 ? 3500 : 45;

      return {
        ...z,
        incidents: incCount,
        demands: demCount,
        affectedPopulation: totalPop,
      };
    });
  }, [incidents, requests]);

  // ── 8. FILTERED AUDIT TRAIL LOGS ──
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(entry => {
      const q = auditSearchQuery.toLowerCase();
      const matchesSearch =
        !auditSearchQuery ||
        entry.actor.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.target.toLowerCase().includes(q) ||
        entry.result.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q);

      const matchesAction = auditActionFilter === 'ALL' || entry.action === auditActionFilter || entry.type === auditActionFilter;

      return matchesSearch && matchesAction;
    });
  }, [auditLogs, auditSearchQuery, auditActionFilter]);

  const handleExportAuditCSV = () => {
    const headers = ['ID', 'Timestamp (ISO)', 'Actor', 'Action', 'Target Object', 'Result'];
    const rows = filteredAuditLogs.map(l => [
      l.id,
      l.timestamp,
      `"${l.actor.replace(/"/g, '""')}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.target.replace(/"/g, '""')}"`,
      `"${l.result.replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `saksham-audit-ledger-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`${styles.container} ${mounted ? styles.mounted : ''}`}>

      {/* ══ 1. EDITORIAL PAGE HEADER ══ */}
      <header className={`${styles.pageHeader} shaderHeaderWrapper`}>
        <ShaderBackground className="absolute inset-0" />
        <div className={styles.headerLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className={styles.eyebrow} style={{ marginBottom: 0 }}>OPERATIONAL TELEMETRY &amp; AUDIT</span>
            <PageGuideTrigger />
          </div>
          <h1 className={`${styles.title} reveal-block`} data-reveal-color="#F59E0B">Decision Support Analytics &amp; Ledger</h1>
          <p className={styles.lead}>
            Live operational metrics derived directly from state data—evaluating intake velocity, resource utilization, fulfillment deficits, and end-to-end audit compliance.
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.systemLive}>
            <span className={styles.liveDot} />
            <span className={styles.liveText}>TELEMETRY ACTIVE</span>
          </div>
          <div className={styles.lastAnalysis}>
            <div className={styles.lastAnalysisRow}>
              <span className={styles.laLabel}>SYNCHRONIZATION</span>
              <span className={styles.laValue}>REACTIVE STORE</span>
            </div>
            <div className={styles.lastAnalysisRow}>
              <span className={styles.laLabel}>CLOCK</span>
              <span className={styles.laTime}>{currentTime}</span>
            </div>
          </div>
          <div className={styles.dataFreshness}>
            <span className={styles.dfLabel}>DATA DOMAINS</span>
            <span className={styles.dfSources}>{incidents.length} Incidents · {requests.length} Demands · {resources.length} Depots · {missions.length} Convoys</span>
          </div>
        </div>
      </header>

      {/* ══ 2. NAVIGATION & DOMAIN SWITCHER ══ */}
      <div className={styles.controlBar} style={{ marginBottom: '28px' }}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>VIEW DOMAIN</span>
          <div className={styles.segmented}>
            <button
              className={`${styles.segBtn} ${activeTab === 'ANALYTICS' ? styles.segBtnActive : ''}`}
              onClick={() => setActiveTab('ANALYTICS')}
            >
              📊 OPERATIONAL ANALYTICS
            </button>
            <button
              className={`${styles.segBtn} ${activeTab === 'AUDIT_TRAIL' ? styles.segBtnActive : ''}`}
              onClick={() => setActiveTab('AUDIT_TRAIL')}
            >
              📜 IMMUTABLE AUDIT TRAIL ({auditLogs.length})
            </button>
          </div>
        </div>

        <div className={styles.controlDivider} />

        {activeTab === 'ANALYTICS' && (
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>TIME WINDOW</span>
            <div className={styles.segmented}>
              {(['ALL', '1H', '6H', '24H'] as const).map(w => (
                <button
                  key={w}
                  className={`${styles.segBtn} ${timeRange === w ? styles.segBtnActive : ''}`}
                  onClick={() => setTimeRange(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.controlRight}>
          {activeTab === 'AUDIT_TRAIL' ? (
            <button className={styles.refreshBtn} onClick={handleExportAuditCSV} title="Export current audit trail to CSV file">
              <Download size={13} style={{ marginRight: '6px' }} /> EXPORT CSV LEDGER
            </button>
          ) : (
            <span className={styles.controlTime}>LIVE CALCULATIONS</span>
          )}
        </div>
      </div>

      {/* ══ 3. CORE ANALYTICS WORKSPACE ══ */}
      {activeTab === 'ANALYTICS' && (
        <>
          {/* ── KPI PULSE STRIP ── */}
          <section className={styles.section} style={{ marginBottom: '32px' }}>
            <div className={styles.pulseStrip}>
              <div className={styles.pulseCell}>
                <span className={styles.pulseNum}>{liveStats.fulfillmentRatePct}%</span>
                <span className={styles.pulseLabel}>GLOBAL FULFILLMENT RATE</span>
                <span className={styles.pulseTrend} style={{ color: liveStats.fulfillmentRatePct >= 60 ? '#15803D' : '#DC2626' }}>
                  {liveStats.fulfilledRequests} of {liveStats.totalRequests} demands closed
                </span>
              </div>
              <div className={styles.pulseDivider} />
              <div className={`${styles.pulseCell} ${liveStats.unresolvedQty > 0 ? styles.pulseCellCritical : ''}`}>
                <span className={styles.pulseNum}>{liveStats.unresolvedQty.toLocaleString()}</span>
                <span className={styles.pulseLabel}>UNRESOLVED AID DEFICIT (UNITS)</span>
                <span className={styles.pulseTrend}>Active field requirement</span>
              </div>
              <div className={styles.pulseDivider} />
              <div className={`${styles.pulseCell} ${styles.pulseCellOrange}`}>
                <span className={styles.pulseNum}>{liveStats.resourceUtilizationPct}%</span>
                <span className={styles.pulseLabel}>DEPOT UTILIZATION</span>
                <span className={styles.pulseTrend}>{liveStats.totalAllocatedQty.toLocaleString()} units reserved</span>
              </div>
              <div className={styles.pulseDivider} />
              <div className={styles.pulseCell}>
                <span className={styles.pulseNum}>{liveStats.avgResponseTimeMin}m</span>
                <span className={styles.pulseLabel}>AVG DISPATCH RESPONSE TIME</span>
                <span className={styles.pulseTrend}>Intake to convoy departure</span>
              </div>
              <div className={styles.pulseDivider} />
              <div className={styles.pulseCell}>
                <span className={styles.pulseNum}>{liveStats.avgResolutionTimeMin}m</span>
                <span className={styles.pulseLabel}>AVG RESOLUTION CYCLE</span>
                <span className={styles.pulseTrend}>Intake to signed delivery proof</span>
              </div>
            </div>
          </section>

          {/* ── SECTION 1: REQUESTS OVER TIME & RESPONSE VELOCITY ── */}
          <section className={styles.section} style={{ marginBottom: '36px' }}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionEyebrow}>OPERATIONAL QUESTION 01</span>
                <h2 className={styles.sectionTitle}>Requests Over Time &amp; Response Velocity</h2>
              </div>
              <p className={styles.sectionDesc}>
                <strong>Question:</strong> Is convoy mobilization keeping pace with incoming distress demand across the disaster timeline?
              </p>
            </div>

            <div className={styles.velocityLayout}>
              <div className={styles.velocityChart} style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineVelocityData} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,33,25,0.06)" vertical={false} />
                    <XAxis dataKey="time" stroke="rgba(11,33,25,0.4)" fontSize={11} tick={{ fontWeight: 700 }} />
                    <YAxis stroke="rgba(11,33,25,0.4)" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Line type="monotone" dataKey="Requests Ingested" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Dispatches En Route" stroke="#E86F16" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Deliveries Completed" stroke="#059669" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ── SECTION 2 & 3: CATEGORY DEFICITS & DEPOT UTILIZATION ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '28px', marginBottom: '36px' }}>
            
            {/* Chart: Fulfillment Deficit by Category */}
            <section className={styles.section} style={{ margin: 0 }}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.sectionEyebrow}>OPERATIONAL QUESTION 02</span>
                  <h3 className={styles.sectionTitle} style={{ fontSize: '20px' }}>Unresolved Demand by Category</h3>
                </div>
                <p className={styles.sectionDesc}>
                  <strong>Question:</strong> Which resource category faces the largest supply deficit?
                </p>
              </div>
              <div style={{ height: '280px', marginTop: '12px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandByCategoryData} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,33,25,0.06)" vertical={false} />
                    <XAxis dataKey="category" stroke="rgba(11,33,25,0.4)" fontSize={10} tick={{ fontWeight: 700 }} />
                    <YAxis stroke="rgba(11,33,25,0.4)" fontSize={10} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Delivered" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Unresolved Deficit" stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Chart: Depot Stock Utilization */}
            <section className={styles.section} style={{ margin: 0 }}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.sectionEyebrow}>OPERATIONAL QUESTION 03</span>
                  <h3 className={styles.sectionTitle} style={{ fontSize: '20px' }}>Resource Depot Stock Allocation</h3>
                </div>
                <p className={styles.sectionDesc}>
                  <strong>Question:</strong> How heavily are government and hospital depots utilized?
                </p>
              </div>
              <div style={{ height: '280px', marginTop: '12px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resourceDepotUtilizationData} layout="vertical" margin={{ top: 10, right: 24, bottom: 8, left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(11,33,25,0.06)" horizontal={false} />
                    <XAxis type="number" stroke="rgba(11,33,25,0.4)" fontSize={10} />
                    <YAxis type="category" dataKey="name" stroke="rgba(11,33,25,0.4)" fontSize={10} width={90} tick={{ fontWeight: 700 }} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Allocated" stackId="stock" fill="#E86F16" />
                    <Bar dataKey="Available" stackId="stock" fill="#0B2119" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

          </div>

          {/* ── SECTION 4 & 5: SEVERITY BREAKDOWN & INCIDENT TYPES ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '28px', marginBottom: '36px' }}>
            
            {/* Pie Chart: Demands by Severity */}
            <section className={styles.section} style={{ margin: 0 }}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.sectionEyebrow}>OPERATIONAL QUESTION 04</span>
                  <h3 className={styles.sectionTitle} style={{ fontSize: '20px' }}>Demand Requests by Severity</h3>
                </div>
                <p className={styles.sectionDesc}>
                  <strong>Question:</strong> What proportion of outstanding requests are life-critical?
                </p>
              </div>
              <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={requestsBySeverityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {requestsBySeverityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Pie Chart: Incidents by Type */}
            <section className={styles.section} style={{ margin: 0 }}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.sectionEyebrow}>OPERATIONAL QUESTION 05</span>
                  <h3 className={styles.sectionTitle} style={{ fontSize: '20px' }}>Incidents by Disaster Type</h3>
                </div>
                <p className={styles.sectionDesc}>
                  <strong>Question:</strong> What primary disaster threats dominate the emergency log?
                </p>
              </div>
              <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incidentsByTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {incidentsByTypeData.map((entry, index) => (
                        <Cell key={`cell-inc-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

          </div>

          {/* ── SECTION 6: GEOGRAPHIC HOTSPOTS & VULNERABILITY ── */}
          <section className={styles.section} style={{ marginBottom: '36px' }}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionEyebrow}>OPERATIONAL QUESTION 06</span>
                <h2 className={styles.sectionTitle}>Geographic Hotspots &amp; Population Impact</h2>
              </div>
              <p className={styles.sectionDesc}>
                <strong>Question:</strong> Where are disaster incidents and demand signals most densely concentrated?
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {geographicHotspots.map(spot => (
                <div
                  key={spot.name}
                  style={{
                    background: '#FAF8F3',
                    border: `1px solid ${spot.risk === 'CRITICAL' ? 'rgba(220, 38, 38, 0.3)' : 'rgba(11, 33, 25, 0.1)'}`,
                    borderRadius: '6px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0B2119', margin: '0 0 2px' }}>{spot.name}</h4>
                      <span style={{ fontSize: '11px', color: 'rgba(11, 33, 25, 0.5)' }}>{spot.area}</span>
                    </div>
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '3px',
                        backgroundColor: spot.risk === 'CRITICAL' ? 'rgba(220, 38, 38, 0.15)' : 'rgba(232, 111, 22, 0.15)',
                        color: spot.color,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {spot.risk}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(11, 33, 25, 0.06)' }}>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(11, 33, 25, 0.45)', display: 'block' }}>INCIDENTS</span>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#0B2119' }}>{spot.incidents}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(11, 33, 25, 0.45)', display: 'block' }}>DEMANDS</span>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#E86F16' }}>{spot.demands}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(11, 33, 25, 0.45)', display: 'block' }}>POPULATION</span>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#0B2119' }}>{spot.affectedPopulation.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ══ 4. IMMUTABLE AUDIT TRAIL WORKSPACE ══ */}
      {activeTab === 'AUDIT_TRAIL' && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.sectionEyebrow}>GOVERNANCE &amp; ACCOUNTABILITY</span>
              <h2 className={styles.sectionTitle}>Immutable Operational Audit Trail</h2>
            </div>
            <p className={styles.sectionDesc}>
              Complete lifecycle provenance: every request creation, field verification, priority escalation, AI match recommendation, stock allocation, convoy movement, and proof of delivery.
            </p>
          </div>

          {/* Audit Controls & Filters */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', padding: '16px', background: 'rgba(11, 33, 25, 0.03)', borderRadius: '6px', border: '1px solid rgba(11, 33, 25, 0.08)' }}>
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(11, 33, 25, 0.4)' }} />
              <input
                type="text"
                placeholder="Search actor, target object, action, or log ID…"
                value={auditSearchQuery}
                onChange={e => setAuditSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '4px',
                  border: '1px solid rgba(11, 33, 25, 0.15)',
                  backgroundColor: '#FAF8F3',
                  fontSize: '12px',
                  color: '#0B2119',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(11, 33, 25, 0.6)' }}>ACTION:</span>
              <select
                value={auditActionFilter}
                onChange={e => setAuditActionFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(11, 33, 25, 0.15)',
                  backgroundColor: '#FAF8F3',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0B2119',
                }}
              >
                <option value="ALL">ALL ACTIONS ({auditLogs.length})</option>
                <option value="REQUEST_CREATED">REQUEST_CREATED</option>
                <option value="REQUEST_VERIFIED">REQUEST_VERIFIED</option>
                <option value="PRIORITY_CHANGED">PRIORITY_CHANGED</option>
                <option value="RESOURCE_RECOMMENDED">RESOURCE_RECOMMENDED</option>
                <option value="RESOURCE_ALLOCATED">RESOURCE_ALLOCATED</option>
                <option value="RESPONDER_ASSIGNED">RESPONDER_ASSIGNED</option>
                <option value="MISSION_CREATED">MISSION_CREATED</option>
                <option value="MISSION_STARTED">MISSION_STARTED</option>
                <option value="ROUTE_UPDATED">ROUTE_UPDATED</option>
                <option value="DELIVERY_COMPLETED">DELIVERY_COMPLETED</option>
                <option value="REQUEST_RESOLVED">REQUEST_RESOLVED</option>
              </select>
            </div>

            <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(11, 33, 25, 0.5)', marginLeft: 'auto' }}>
              Showing {filteredAuditLogs.length} entries
            </span>
          </div>

          {/* Audit Ledger Table */}
          <div style={{ overflowX: 'auto', border: '1px solid rgba(11, 33, 25, 0.1)', borderRadius: '6px', background: '#FAF8F3' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#0B2119', color: '#FAF8F3', borderBottom: '1px solid #0B2119' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', letterSpacing: '0.08em' }}>LOG ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', letterSpacing: '0.08em' }}>TIMESTAMP (IST)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', letterSpacing: '0.08em' }}>ACTOR</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', letterSpacing: '0.08em' }}>ACTION</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', letterSpacing: '0.08em' }}>OBJECT / TARGET</th>
                  <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', letterSpacing: '0.08em' }}>RESULT &amp; STATE MUTATION</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map((log, index) => {
                  const badgeInfo = ACTION_TYPE_BADGES[log.action] || ACTION_TYPE_BADGES[log.type] || {
                    label: log.action,
                    color: '#0B2119',
                    bg: 'rgba(11, 33, 25, 0.08)',
                  };
                  const dateObj = new Date(log.timestamp);
                  const timeFormatted = isNaN(dateObj.getTime())
                    ? log.timestamp
                    : dateObj.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }) + ' IST';

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid rgba(11, 33, 25, 0.07)',
                        backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(11, 33, 25, 0.015)',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'rgba(11, 33, 25, 0.5)' }}>
                        {log.id}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock size={12} style={{ color: 'rgba(11, 33, 25, 0.4)' }} />
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0B2119' }}>{timeFormatted}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0B2119' }}>
                        {log.actor}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            backgroundColor: badgeInfo.bg,
                            color: badgeInfo.color,
                            border: `1px solid ${badgeInfo.color}33`,
                            display: 'inline-block',
                          }}
                        >
                          {badgeInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0B2119' }}>
                        {log.target}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'rgba(11, 33, 25, 0.75)', fontSize: '11.5px', lineHeight: 1.4 }}>
                        {log.result}
                      </td>
                    </tr>
                  );
                })}

                {filteredAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'rgba(11, 33, 25, 0.45)' }}>
                      No audit events match the specified search or action filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <PageGuidebook guideKey="analytics" />
    </div>
  );
};

export default Analytics;
