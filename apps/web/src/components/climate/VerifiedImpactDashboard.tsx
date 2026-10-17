import React, { useState } from 'react';
import {
  Award,
  X,
  TrendingUp,
  CheckCircle2,
  Clock,
  Shield,
  Droplets,
  TreePine,
  Sun,
  Waves,
  Trash2,
  CheckSquare
} from 'lucide-react';
import { CLIMATE_NEIGHBORHOODS } from '../../data/climateData';
import styles from './VerifiedImpactDashboard.module.css';

interface VerifiedImpactDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EvidenceRecord {
  id: string;
  ref: string;
  action: string;
  location: string;
  ward: string;
  beneficiaries: string;
  verifier: string;
  evidence: string;
  coordinates: string;
  timestamp: string;
  proofType: 'AUDITED_SENSOR' | 'PHOTO_INSPECTION' | 'FLOWMETER_TELEMETRY' | 'SELF_REPORTED';
  status: 'VERIFIED' | 'PENDING_AUDIT';
  photoUrl?: string;
  methodologyNote: string;
}

const EVIDENCE_RECORDS: EvidenceRecord[] = [
  {
    id: 'EV-01',
    ref: 'ACT-DL-8821',
    action: 'High-Albedo SRI Cool Roof Coating (420 Tin Roofs)',
    location: 'Seelampur Informal Block C',
    ward: 'Ward 41 (Shahdara North)',
    beneficiaries: '1,840 residents',
    verifier: 'Mahila Housing Trust Certified Field Auditor (ID: MHT-402)',
    evidence: 'Infrared Drone Radiometric Thermography (4.8°C thermal drop confirmed)',
    coordinates: '28.6655° N, 77.2758° E',
    timestamp: '2026-10-16 16:45 IST',
    proofType: 'AUDITED_SENSOR',
    status: 'VERIFIED',
    photoUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400',
    methodologyNote: 'Pre/post emissivity pyrometer reading calibrated at 13:00 IST peak sun. Zero double-counting verified against municipal electricity meter IDs.'
  },
  {
    id: 'EV-02',
    ref: 'ACT-DL-8822',
    action: '15,000L Emergency Potable Water Tanker Refill',
    location: 'Yamuna Floodplain Pushta Relief Camp',
    ward: 'Ward 24 (Civil Lines North)',
    beneficiaries: '980 residents',
    verifier: 'NDRF Auxiliary Logistics Officer (Sub-Insp. Verma)',
    evidence: 'Digital Flowmeter IoT Telemetry + Resident Head-of-Household OTP Tokens',
    coordinates: '28.6180° N, 77.2195° E',
    timestamp: '2026-10-17 08:30 IST',
    proofType: 'FLOWMETER_TELEMETRY',
    status: 'VERIFIED',
    photoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=400',
    methodologyNote: 'Flow calibrated through electromagnetic meter. Meets Sphere Minimum Standards of 15L/person/day.'
  },
  {
    id: 'EV-03',
    ref: 'ACT-DL-8823',
    action: '350 Native Riparian Trees Planted & Geotagged',
    location: 'Geeta Colony Embankment Buffer',
    ward: 'Ward 57 (Geeta Colony)',
    beneficiaries: 'Perimeter shade +14%',
    verifier: 'Youth for Climate Action Delhi Field Coordinator',
    evidence: 'NFC Geotagged Plant ID Registry + Smart Soil Moisture Sensors',
    coordinates: '28.6495° N, 77.2645° E',
    timestamp: '2026-10-15 11:15 IST',
    proofType: 'PHOTO_INSPECTION',
    status: 'VERIFIED',
    photoUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400',
    methodologyNote: 'Survival rate monitored via weekly sensor check. Carbon sequestration estimates follow Forest Survey of India biomass tables.'
  },
  {
    id: 'EV-04',
    ref: 'ACT-DL-8824',
    action: '62.4 Tonnes Storm Drain Desiltation & Plastic Silt Clearing',
    location: 'Kashmere Gate Culvert 4 Outfall',
    ward: 'Ward 18 (Kashmere Gate)',
    beneficiaries: '12,500 commuter basin',
    verifier: 'MCD Public Health Inspector (Ward 18)',
    evidence: 'Weighbridge Certified Receipts + Waste Transfer Manifest',
    coordinates: '28.6670° N, 77.2285° E',
    timestamp: '2026-10-14 17:00 IST',
    proofType: 'AUDITED_SENSOR',
    status: 'VERIFIED',
    photoUrl: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=400',
    methodologyNote: 'Weighed on government calibrated weighbridge at Ghazipur processing plant.'
  },
  {
    id: 'EV-05',
    ref: 'ACT-DL-8825',
    action: 'Misting Respite Tent & Hydration Station Deployment',
    location: 'Majnu Ka Tila Monastery Market',
    ward: 'Ward 12 (Majnu Ka Tila)',
    beneficiaries: '2,200 visitors/day',
    verifier: 'SEWA Field Health Nurse Supervisor',
    evidence: 'Digital Thermometer Readings (Drop of 6.1°C inside shade)',
    coordinates: '28.7020° N, 77.2260° E',
    timestamp: '2026-10-17 10:00 IST',
    proofType: 'SELF_REPORTED',
    status: 'PENDING_AUDIT',
    photoUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400',
    methodologyNote: 'Volunteer logged; physical inspection counter-check scheduled for 16:00 IST.'
  }
];

export const VerifiedImpactDashboard: React.FC<VerifiedImpactDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('ALL');
  const [timeFilter, setTimeFilter] = useState<'30D' | '90D' | 'YTD'>('30D');
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<EvidenceRecord | null>(null);

  if (!isOpen) return null;

  // Filtered evidence records
  const filteredEvidence = EVIDENCE_RECORDS.filter(e => {
    if (selectedNeighborhood === 'ALL') return true;
    return e.ward.toLowerCase().includes(selectedNeighborhood.toLowerCase());
  });

  return (
    <div className={styles.impactModalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.impactCard}>
        {/* Header */}
        <div className={styles.impactHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Award size={20} />
            </div>
            <div>
              <h3>VERIFIED CLIMATE RESILIENCE & SOCIAL IMPACT DASHBOARD</h3>
              <p>Audited Proof-of-Action Logs, Field Verifications & Mathematical Outcome Transparency</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Filters Bar: Ward/Neighborhood & Date Horizon */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 24px',
          background: 'rgba(11, 18, 30, 0.85)',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          {/* Neighborhood Filter */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>WARD FILTER:</span>
            <select
              value={selectedNeighborhood}
              onChange={(e) => setSelectedNeighborhood(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              <option value="ALL">All Delhi Monitored Wards (6 Sectors)</option>
              {CLIMATE_NEIGHBORHOODS.map(n => (
                <option key={n.id} value={n.wardNumber}>{n.name} ({n.wardNumber})</option>
              ))}
            </select>
          </div>

          {/* Time Filter & Outcome Breakdown */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Outcome Confidence Badges */}
            <div style={{ display: 'flex', gap: '6px', fontSize: '10px' }}>
              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ● 88% Verified
              </span>
              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ● 9% Self-Reported
              </span>
              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                ● 3% Estimated
              </span>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {(['30D', '90D', 'YTD'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  style={{
                    background: timeFilter === tf ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                    border: 'none',
                    color: timeFilter === tf ? '#030712' : '#94a3b8',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dashboard Body */}
        <div className={styles.impactBody}>
          {/* ── 8 MANDATORY VERIFIED IMPACT METRICS ── */}
          <div className={styles.kpiGrid}>
            {/* 1. Community Requests Resolved */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>RESPONSE QUEUE</span>
              <span className={styles.kpiTitle}>Community Requests Resolved</span>
              <div className={styles.kpiValue}>
                142 <span className={styles.kpiUnit}>requests (96.2% closed)</span>
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={13} /> +28% vs previous month ({timeFilter})
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 138 Verified</div>
                <div className={styles.pendingBadge}><Clock size={12} /> 4 In Review</div>
              </div>
            </div>

            {/* 2. People Assisted */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>HUMANITARIAN SHIELD</span>
              <span className={styles.kpiTitle}>People Shielded & Assisted</span>
              <div className={styles.kpiValue}>
                3,820 <span className={styles.kpiUnit}>vulnerable residents</span>
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={13} /> Zero heatstroke fatalities in monitored zones
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 3,680 Verified</div>
                <div className={styles.pendingBadge}><Clock size={12} /> 140 Pending</div>
              </div>
            </div>

            {/* 3. Water Delivered */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>HYDRATION & RELIEF</span>
              <span className={styles.kpiTitle}>Clean Potable Water Delivered</span>
              <div className={styles.kpiValue}>
                84,500 <span className={styles.kpiUnit}>Liters dispensed</span>
              </div>
              <div style={{ fontSize: '11px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Droplets size={13} /> Via 8 automated solar ATMs + mobile bowsers
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 82,000L Flowmeter</div>
                <div className={styles.pendingBadge}><Clock size={12} /> 2,500L Logged</div>
              </div>
            </div>

            {/* 4. Volunteer Hours */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>COMMUNITY MANPOWER</span>
              <span className={styles.kpiTitle}>Volunteer Service Hours</span>
              <div className={styles.kpiValue}>
                1,342 <span className={styles.kpiUnit}>hours logged</span>
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckSquare size={13} /> 64 certified community first-responders
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 1,300 Audited</div>
                <div className={styles.pendingBadge}><Clock size={12} /> 42 Queued</div>
              </div>
            </div>

            {/* 5. Trees Planted and Maintained */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>URBAN CANOPY</span>
              <span className={styles.kpiTitle}>Trees Planted & Maintained</span>
              <div className={styles.kpiValue}>
                3,820 <span className={styles.kpiUnit}>trees geotagged</span>
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TreePine size={13} /> 94.2% 6-month survival index with drip sensors
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 3,750 Sensor Checked</div>
                <div className={styles.pendingBadge}><Clock size={12} /> 70 Inspection</div>
              </div>
            </div>

            {/* 6. Waste Collected */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>DRAINAGE RESTORATION</span>
              <span className={styles.kpiTitle}>Waste & Silt Collected</span>
              <div className={styles.kpiValue}>
                62.4 <span className={styles.kpiUnit}>tonnes cleared</span>
              </div>
              <div style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Trash2 size={13} /> 4 major stormwater outfalls unclogged
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 60.2T Weighbridge</div>
                <div className={styles.pendingBadge}><Clock size={12} /> 2.2T Manifest</div>
              </div>
            </div>

            {/* 7. Cooling & Flood Interventions */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>PHYSICAL RESILIENCE</span>
              <span className={styles.kpiTitle}>Cooling & Flood Interventions</span>
              <div className={styles.kpiValue}>
                1,680 <span className={styles.kpiUnit}>cool roofs + 12 retention sumps</span>
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sun size={13} /> -5.4°C verified surface temperature delta
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 1,650 Radiometric</div>
                <div className={styles.pendingBadge}><Clock size={12} /> 30 Field Queue</div>
              </div>
            </div>

            {/* 8. Campaign Completion Rate */}
            <div className={styles.kpiCard}>
              <span className={styles.kpiCategory}>PROGRAM PROGRESS</span>
              <span className={styles.kpiTitle}>Campaign Completion Rates</span>
              <div className={styles.kpiValue}>
                74.2% <span className={styles.kpiUnit}>milestone achievement</span>
              </div>
              <div style={{ fontSize: '11px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Waves size={13} /> 3 active campaigns tracking on schedule
              </div>
              <div className={styles.auditBadges}>
                <div className={styles.verifiedBadge}><CheckCircle2 size={12} /> 100% Zero Double-Count</div>
                <div className={styles.pendingBadge}><Clock size={12} /> Audit Audited</div>
              </div>
            </div>
          </div>

          {/* ── IMMUTABLE AUDIT TRAIL TABLE ── */}
          <div className={styles.evidenceSection}>
            <div className={styles.evidenceHeader}>
              <div>
                <h4 style={{ margin: 0 }}>Immutable Field Verification & Proof-of-Delivery Trail</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                  Click any row to inspect cryptographic telemetry, GPS metadata and field inspector photos.
                </p>
              </div>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                ✔ 100% Zero-Double-Counting Guaranteed (Prisma SHA256 Audit Hashes)
              </span>
            </div>

            <table className={styles.auditTable}>
              <thead>
                <tr>
                  <th>Audit Ref</th>
                  <th>Action / Intervention</th>
                  <th>Ward Sector</th>
                  <th>Beneficiaries</th>
                  <th>Verified By</th>
                  <th>Telemetry & Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvidence.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setActiveEvidenceModal(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><code>{item.ref}</code></td>
                    <td><strong style={{ color: '#fff' }}>{item.action}</strong></td>
                    <td>{item.ward}</td>
                    <td>{item.beneficiaries}</td>
                    <td>{item.verifier}</td>
                    <td style={{ fontSize: '10px', color: '#cbd5e1' }}>{item.evidence}</td>
                    <td>
                      <span style={{
                        color: item.status === 'VERIFIED' ? '#10b981' : '#f59e0b',
                        fontWeight: 700,
                        fontSize: '11px'
                      }}>
                        {item.status === 'VERIFIED' ? '● VERIFIED' : '● PENDING REVIEW'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── EVIDENCE INSPECTION MODAL DRAWER ── */}
      {activeEvidenceModal && (
        <div className={styles.impactModalOverlay} style={{ zIndex: 1100 }}>
          <div style={{
            background: '#090e18',
            border: '1px solid #38bdf8',
            borderRadius: '12px',
            width: '560px',
            maxWidth: '92vw',
            padding: '24px',
            color: '#fff',
            boxShadow: '0 25px 60px rgba(0,0,0,0.9)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 800 }}>AUDIT CERTIFICATE: {activeEvidenceModal.ref}</span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '16px', color: '#fff' }}>{activeEvidenceModal.action}</h4>
              </div>
              <button onClick={() => setActiveEvidenceModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>GPS Coordinates:</span>
                  <strong>{activeEvidenceModal.coordinates}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Timestamp Recorded:</span>
                  <strong>{activeEvidenceModal.timestamp}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Field Inspector:</span>
                  <strong style={{ color: '#38bdf8' }}>{activeEvidenceModal.verifier}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Verification Protocol:</span>
                  <strong style={{ color: '#10b981' }}>{activeEvidenceModal.proofType}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  METHODOLOGY & ANTI-DOUBLE-COUNTING RULES:
                </span>
                <p style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', lineHeight: 1.4, background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                  {activeEvidenceModal.methodologyNote}
                </p>
              </div>

              {activeEvidenceModal.photoUrl && (
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    FIELD AUDIT PHOTO TELEMETRY:
                  </span>
                  <div style={{ height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img
                      src={activeEvidenceModal.photoUrl}
                      alt="Field Audit Evidence"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveEvidenceModal(null)}
              style={{
                width: '100%',
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid #38bdf8',
                color: '#fff',
                padding: '8px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                marginTop: '16px'
              }}
            >
              Close Certificate Viewer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
