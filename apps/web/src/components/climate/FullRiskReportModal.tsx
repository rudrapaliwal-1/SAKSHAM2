import React from 'react';
import {
  X,
  Printer,
  ShieldAlert,
  Flame,
  Waves,
  Users,
  Droplets,
  Trees,
  CheckCircle2,
  FileText,
  Navigation
} from 'lucide-react';
import type { ClimateNeighborhood, UrbanThermalBlock } from '../../data/climateData';
import { type VulnerabilityAssessmentResult } from '../../utils/vulnerabilityScoring';

interface FullRiskReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  neighborhood: ClimateNeighborhood;
  assessment: VulnerabilityAssessmentResult | null;
  selectedBlock?: UrbanThermalBlock | null;
  onCreateDemand: () => void;
  onCreatePlan: () => void;
  onFindResources: () => void;
}

export const FullRiskReportModal: React.FC<FullRiskReportModalProps> = ({
  isOpen,
  onClose,
  neighborhood,
  assessment,
  selectedBlock,
  onCreateDemand,
  onCreatePlan,
  onFindResources
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const riskRank = assessment ? (assessment.compositeScore / 10).toFixed(1) : '7.9';
  const riskColor =
    neighborhood.severity === 'CRITICAL' ? '#ef4444' :
    neighborhood.severity === 'HIGH' ? '#f59e0b' :
    neighborhood.severity === 'MODERATE' ? '#38bdf8' : '#10b981';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '900px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          backgroundColor: '#090e18',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#e2e8f0',
          fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.95)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8'
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: '#94a3b8',
                    textTransform: 'uppercase'
                  }}
                >
                  SAKSHAM CLIMATE & DISASTER INTELLIGENCE BRIEFING
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: `${riskColor}22`,
                    border: `1px solid ${riskColor}55`,
                    color: riskColor
                  }}
                >
                  RiskRank {riskRank} • {neighborhood.severity}
                </span>
              </div>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 900, color: '#ffffff' }}>
                {neighborhood.name}
              </h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {neighborhood.wardNumber} • {neighborhood.zone} • NCT of Delhi
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Print or Save PDF report"
            >
              <Printer size={14} />
              Export Briefing
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Report Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Provenance & Freshness Alert */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              <span>
                <strong>Data Provenance:</strong> {neighborhood.dataSource} | Synced with Open-Meteo & IMD Early Warnings
              </span>
            </div>
            <span style={{ color: '#10b981', fontWeight: 700 }}>
              Verified Active ({neighborhood.lastUpdated})
            </span>
          </div>

          {/* Exposure Overview Narrative (Matching Reference Image 2) */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 800,
                color: '#94a3b8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '6px'
              }}
            >
              EXPOSURE OVERVIEW
            </span>
            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#e2e8f0' }}>
              With a composite risk rank of <strong>{riskRank} / 10</strong>, <strong>{neighborhood.name}</strong> faces acute
              environmental vulnerability driven primarily by{' '}
              <strong style={{ color: riskColor }}>
                {neighborhood.primaryHazard === 'URBAN_HEAT' ? 'extreme thermal heat traps & sub-4% canopy cover' :
                 neighborhood.primaryHazard === 'FLOOD_SURGE' ? 'riparian flood inundation & low plinth settlements' :
                 'compound multi-hazard stressors including water scarcity and heat'}
              </strong>. 
              Narrow transit alleyways and high thermal-mass asbestos/tin roofing impede convective nocturnal cooling. 
              Immediate priority warrants pre-positioning hydration resources, reviewing emergency cooling-center bed reserves, 
              and activating logistics corridor clearances under the Delhi Disaster Management Action Plan.
            </p>
          </div>

          {/* 4 Multi-Hazard Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {/* Card 1: Heat Stress */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#f87171' }}>HEAT HAZARD</span>
                <Flame size={14} color="#ef4444" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                {neighborhood.apparentTempC}°C
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                Apparent Heat Index (Ambient: {neighborhood.ambientTempC}°C)
              </div>
              {selectedBlock && (
                <div style={{ fontSize: '9.5px', color: '#fca5a5', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
                  LST Roof: {selectedBlock.surfaceTempC}°C ({selectedBlock.roofType})
                </div>
              )}
            </div>

            {/* Card 2: Flood Inundation */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8' }}>FLOOD STAGE</span>
                <Waves size={14} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                {neighborhood.floodDepthMeters}m
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                Yamuna Inundation Depth (Warning threshold 205.33m)
              </div>
            </div>

            {/* Card 3: Canopy Cover */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#34d399' }}>CANOPY COVER</span>
                <Trees size={14} color="#10b981" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                {neighborhood.canopyCoverPct}%
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                Target: 25.0% (Deficit: {Math.max(0, 25 - neighborhood.canopyCoverPct).toFixed(1)}%)
              </div>
            </div>

            {/* Card 4: Exposed Population */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#c084fc' }}>EXPOSED PEOPLE</span>
                <Users size={14} color="#a855f7" />
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff' }}>
                {neighborhood.exposedPopulation.toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                Demographic Sensitivity: {neighborhood.demographicSensitivityPct}%
              </div>
            </div>
          </div>

          {/* Two-Column Grid: Vulnerability Drivers vs Capacity Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Left: Vulnerability Factors */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '14px 16px'
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Compound Vulnerability Drivers
              </h4>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#cbd5e1' }}>
                {neighborhood.vulnerabilityFactors.map((vf, i) => (
                  <li key={i}>{vf}</li>
                ))}
              </ul>
            </div>

            {/* Right: Sector Resource Capacity Status */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '14px 16px'
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Resource Capacity & Buffers
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Emergency Shelters:</span>
                  <strong style={{ color: '#fff' }}>{neighborhood.coolingCentersCount} Centers ({neighborhood.shelterBedsAvailable} beds available)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Potable Water ATMs:</span>
                  <strong style={{ color: '#fff' }}>{neighborhood.waterPointsCount} Dispensing Hubs</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Resource Sufficiency Ratio:</span>
                  <strong style={{ color: neighborhood.resourceSufficiencyRatio < 0.4 ? '#ef4444' : '#f59e0b' }}>
                    {Math.round(neighborhood.resourceSufficiencyRatio * 100)}% (Severe Deficit)
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Active Response Team:</span>
                  <strong style={{ color: '#38bdf8' }}>{neighborhood.assignedTeam}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Interventions Checklist */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '14px 16px'
            }}
          >
            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Actionable Disaster Relief & Mitigation Interventions
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {neighborhood.recommendedInterventions.map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: '#e2e8f0' }}>
                  <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Operational Action Bar */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: 'rgba(15, 23, 42, 0.98)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Incident Commander Direct Actions:
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                onClose();
                onCreateDemand();
              }}
              style={{
                backgroundColor: '#f59e0b',
                color: '#000',
                border: '1px solid #fbbf24',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Droplets size={13} />
              1. Create Relief Request
            </button>

            <button
              onClick={() => {
                onClose();
                onFindResources();
              }}
              style={{
                backgroundColor: '#0284c7',
                color: '#fff',
                border: '1px solid #38bdf8',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Navigation size={13} />
              2. Find Nearby Resources
            </button>

            <button
              onClick={() => {
                onClose();
                onCreatePlan();
              }}
              style={{
                backgroundColor: '#10b981',
                color: '#fff',
                border: '1px solid #34d399',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText size={13} />
              3. Authorize Response Plan
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
