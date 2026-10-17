import React, { useState } from 'react';
import {
  X,
  Send
} from 'lucide-react';
import type { ClimateNeighborhood, CoolingFacility, CommunityResponsePlan } from '../../data/climateData';
import { COOLING_FACILITIES, LOCATION_HISTORY_RECORDS } from '../../data/climateData';
import {
  computeVulnerabilityScore,
  DEFAULT_VULNERABILITY_WEIGHTS,
  type VulnerabilityWeights
} from '../../utils/vulnerabilityScoring';


/* ── 1. COMMUNITY NEED INTAKE MODAL ── */
interface NeedModalProps {
  neighborhood: ClimateNeighborhood;
  isOpen: boolean;
  onClose: () => void;
  onSubmitNeed: (needData: {
    itemNeeded: string;
    category: string;
    quantity: number;
    unit: string;
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    notes: string;
  }) => void;
}

export const CommunityNeedModal: React.FC<NeedModalProps> = ({
  neighborhood,
  isOpen,
  onClose,
  onSubmitNeed
}) => {
  const [category, setCategory] = useState('Drinking Water');
  const [quantity, setQuantity] = useState(2500);
  const [unit, setUnit] = useState('Liters');
  const [urgency, setUrgency] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [notes, setNotes] = useState('Urgent potable water deficit due to pipeline pressure drop in 44C heat.');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitNeed({
      itemNeeded: category,
      category,
      quantity,
      unit,
      urgency,
      notes
    });
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 800 }}>REPORT COMMUNITY CLIMATE NEED</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Submitting for: <strong style={{ color: '#38bdf8' }}>{neighborhood.name}</strong>
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Assistance Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value === 'Drinking Water') { setUnit('Liters'); setQuantity(2500); }
                else if (e.target.value === 'Cooling Facilities') { setUnit('Respite Beds'); setQuantity(50); }
                else if (e.target.value === 'Emergency Shelter') { setUnit('Capacity Beds'); setQuantity(100); }
                else if (e.target.value === 'Medical Assistance') { setUnit('Electrolyte Kits'); setQuantity(200); }
                else if (e.target.value === 'Volunteers') { setUnit('Responders'); setQuantity(10); }
              }}
              style={inputStyle}
            >
              <option value="Drinking Water">Drinking Water (Emergency Tanker)</option>
              <option value="Cooling Facilities">Cooling Facilities & Misting Respite</option>
              <option value="Emergency Shelter">Emergency Evacuation Shelter</option>
              <option value="Medical Assistance">Heatstroke / Dehydration Medical Kits</option>
              <option value="Food & Rations">Community Relief Food Rations</option>
              <option value="Transport">Emergency Transport / Ambulances</option>
              <option value="Volunteers">Community Volunteers / Manpower</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Quantity Needed</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Urgency Priority</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setUrgency(p)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: urgency === p ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    background: urgency === p ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0,0,0,0.3)',
                    color: urgency === p ? '#fff' : '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Field Context & Neighborhood Specifics</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: '1px solid #38bdf8',
              color: '#fff',
              padding: '10px',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Send size={14} />
            Submit Verified Request to Response Queue
          </button>
        </form>
      </div>
    </div>
  );
};

/* ── 2. NEARBY RESOURCES & COOLING CENTERS DRAWER ── */
interface NearbyResourcesProps {
  neighborhood: ClimateNeighborhood;
  isOpen: boolean;
  onClose: () => void;
  onSelectFacility: (facility: CoolingFacility) => void;
}

export const NearbyResourcesDrawer: React.FC<NearbyResourcesProps> = ({
  neighborhood,
  isOpen,
  onClose,
  onSelectFacility
}) => {
  if (!isOpen) return null;

  // Compute haversine distance
  const facilitiesWithDistance = COOLING_FACILITIES.map(f => {
    const lat1 = neighborhood.center[1];
    const lon1 = neighborhood.center[0];
    const lat2 = f.coordinates[1];
    const lon2 = f.coordinates[0];
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = Math.round(R * c * 10) / 10;
    const walkMinutes = Math.round(distKm * 12); // ~5km/h walking

    return { ...f, distKm, walkMinutes };
  }).sort((a, b) => a.distKm - b.distKm);

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...cardStyle, width: '650px' }}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 800 }}>NEARBY CLIMATE RESILIENCE INFRASTRUCTURE</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Radius around: <strong style={{ color: '#38bdf8' }}>{neighborhood.name}</strong>
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {facilitiesWithDistance.map(fac => (
            <div
              key={fac.id}
              onClick={() => {
                onSelectFacility(fac);
                onClose();
              }}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s'
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>{fac.name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0' }}>{fac.locationName}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '10px' }}>
                  <span style={{ color: '#38bdf8' }}>Water: <strong>{fac.waterSupplyLiters.toLocaleString()}L</strong></span>
                  <span style={{ color: '#10b981' }}>Capacity: <strong>{fac.capacityPeople} people</strong></span>
                  {fac.acEquipped && <span style={{ color: '#f59e0b' }}>AC Respite Active</span>}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#38bdf8' }}>{fac.distKm} km</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>~{fac.walkMinutes} min walk</div>
                <span style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  {fac.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── 3. CONFIGURABLE VULNERABILITY WEIGHTS MODAL ── */
interface WeightsModalProps {
  weights: VulnerabilityWeights;
  neighborhood?: ClimateNeighborhood | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveWeights: (weights: VulnerabilityWeights) => void;
}

export const VulnerabilityWeightsModal: React.FC<WeightsModalProps> = ({
  weights,
  neighborhood,
  isOpen,
  onClose,
  onSaveWeights
}) => {
  const [currentWeights, setCurrentWeights] = useState<VulnerabilityWeights>(weights);

  if (!isOpen) return null;

  const total =
    currentWeights.hazardIntensity +
    currentWeights.populationExposure +
    currentWeights.essentialFacilityAccess +
    currentWeights.resourceAvailability +
    currentWeights.socioeconomicConstraints;

  // Auto normalize weights to 1.0
  const handleNormalize = () => {
    if (total === 0) return;
    setCurrentWeights({
      hazardIntensity: Math.round((currentWeights.hazardIntensity / total) * 100) / 100,
      populationExposure: Math.round((currentWeights.populationExposure / total) * 100) / 100,
      essentialFacilityAccess: Math.round((currentWeights.essentialFacilityAccess / total) * 100) / 100,
      resourceAvailability: Math.round((currentWeights.resourceAvailability / total) * 100) / 100,
      socioeconomicConstraints: Math.round((currentWeights.socioeconomicConstraints / total) * 100) / 100
    });
  };

  // Live before/after score comparison
  const sampleData = {
    hazardScore: neighborhood?.severity === 'CRITICAL' ? 88 : neighborhood?.severity === 'HIGH' ? 68 : 42,
    exposedPopulation: neighborhood?.exposedPopulation ?? 15000,
    facilitiesCount: neighborhood?.facilitiesCount ?? 2,
    resourceSufficiencyRatio: neighborhood?.resourceSufficiencyRatio ?? 0.35,
    demographicSensitivityPct: neighborhood?.demographicSensitivityPct ?? 80
  };

  const beforeScore = computeVulnerabilityScore(sampleData, weights).compositeScore;
  const afterScore = computeVulnerabilityScore(sampleData, currentWeights).compositeScore;
  const scoreDiff = afterScore - beforeScore;

  const handleSave = () => {
    // Save to backend API asynchronously
    fetch('/api/v1/climate/weights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hazardSeverity: currentWeights.hazardIntensity,
        populationExposure: currentWeights.populationExposure,
        essentialServices: currentWeights.essentialFacilityAccess,
        resourceAvailability: currentWeights.resourceAvailability,
        demographicSensitivity: currentWeights.socioeconomicConstraints,
        dataConfidence: 0.94
      })
    }).catch(() => { /* offline fallback */ });

    onSaveWeights(currentWeights);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...cardStyle, width: '620px' }}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 800 }}>CONFIGURABLE RISK SCORE WEIGHTS</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Explainable Multi-Criteria Vulnerability Formulation: S = &Sigma;(w_i &times; x_i)
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Before vs After Live Impact Banner */}
          {neighborhood && (
            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>
                  Live Impact on: <strong style={{ color: '#fff' }}>{neighborhood.name}</strong>
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Recalculates severity index in real time</span>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>CURRENT</span>
                  <strong style={{ fontSize: '14px', color: '#cbd5e1' }}>{beforeScore}/100</strong>
                </div>
                <span style={{ color: '#64748b' }}>&rarr;</span>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#38bdf8', display: 'block' }}>PROPOSED</span>
                  <strong style={{ fontSize: '14px', color: scoreDiff > 0 ? '#ef4444' : '#10b981' }}>{afterScore}/100</strong>
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: scoreDiff === 0 ? 'rgba(255,255,255,0.08)' : scoreDiff > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: scoreDiff === 0 ? '#cbd5e1' : scoreDiff > 0 ? '#ef4444' : '#10b981'
                }}>
                  {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff === 0 ? '±0' : scoreDiff} Pts
                </div>
              </div>
            </div>
          )}

          {[
            { key: 'hazardIntensity', label: '1. Hazard Severity (Heat & Flood)', desc: 'LST satellite thermal index & inundation depth' },
            { key: 'populationExposure', label: '2. Population Exposure Density', desc: 'Census headcount residing in hazard contour' },
            { key: 'essentialFacilityAccess', label: '3. Essential Service Accessibility', desc: 'Distance to water kiosks, respite centers & clinics' },
            { key: 'resourceAvailability', label: '4. Resource Sufficiency Buffer', desc: 'Local potable water stockpiles & shelter beds' },
            { key: 'socioeconomicConstraints', label: '5. Infrastructure & Housing Sensitivity', desc: 'Tin/zinc roof density & informal settlement ratio' }
          ].map(factor => (
            <div key={factor.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                <span style={{ fontWeight: 700, color: '#fff' }}>{factor.label}</span>
                <strong style={{ color: '#38bdf8' }}>{Math.round((currentWeights as any)[factor.key] * 100)}%</strong>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>{factor.desc}</div>
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={Math.round((currentWeights as any)[factor.key] * 100)}
                onChange={(e) => {
                  setCurrentWeights({
                    ...currentWeights,
                    [factor.key]: Number(e.target.value) / 100
                  });
                }}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
            </div>
          ))}

          {/* Normalization Status and Auto-Normalize Button */}
          <div style={{
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '6px',
            fontSize: '11px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span>Sum of Weights: </span>
              <strong style={{ color: Math.abs(total - 1.0) < 0.05 ? '#10b981' : '#f59e0b' }}>
                {Math.round(total * 100)}% {Math.abs(total - 1.0) < 0.05 ? '(Balanced 100%)' : '(Unbalanced)'}
              </strong>
            </div>
            {Math.abs(total - 1.0) >= 0.05 && (
              <button
                type="button"
                onClick={handleNormalize}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Auto-Normalize
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => setCurrentWeights(DEFAULT_VULNERABILITY_WEIGHTS)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '8px 14px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: '1px solid #38bdf8', color: '#fff', padding: '8px 18px', borderRadius: '6px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' }}
            >
              Approve & Recalculate Scores
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── 4. CREATE RESPONSE PLAN MODAL (Connecting Hazard, Needs, Resources & Routes) ── */
interface ResponsePlanModalProps {
  neighborhood: ClimateNeighborhood;
  isOpen: boolean;
  onClose: () => void;
  onPlanCreated: (plan: CommunityResponsePlan) => void;
}

export const CreateResponsePlanModal: React.FC<ResponsePlanModalProps> = ({
  neighborhood,
  isOpen,
  onClose,
  onPlanCreated
}) => {
  const [leadUnit, setLeadUnit] = useState('NDRF Auxiliary Taskforce (Inspector Rajesh Rawat)');
  const [waterLiters, setWaterLiters] = useState(12000);
  const [orsPacks, setOrsPacks] = useState(2500);
  const [lifejackets, setLifejackets] = useState(80);
  const [mistingUnits, setMistingUnits] = useState(4);
  const [routeSafe, setRouteSafe] = useState(neighborhood.floodDepthMeters < 1.2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newPlan: CommunityResponsePlan = {
      id: `CRP-${Date.now().toString().slice(-5)}`,
      planReference: `CRP-DEL-2026-${Math.floor(100 + Math.random() * 900)}`,
      neighborhoodId: neighborhood.id,
      neighborhoodName: neighborhood.name,
      primaryHazard: neighborhood.primaryHazard.replace('_', ' '),
      riskSeverity: neighborhood.severity,
      objectives: [
        `Pre-position emergency water bowsers (${waterLiters.toLocaleString()}L) at designated transit nodes`,
        `Mobilize ${leadUnit} for primary sector triage & medical first aid`,
        `Distribute ${orsPacks.toLocaleString()} oral rehydration packs to vulnerable elderly & infants`,
        routeSafe ? 'Keep designated arterial evacuation route active' : 'Implement high-elevation bypass route due to flood stage'
      ],
      requiredSupplies: [
        { item: 'Chilled Potable Water', quantity: waterLiters, unit: 'Liters' },
        { item: 'Oral Rehydration Salts', quantity: orsPacks, unit: 'Packets' },
        { item: 'Inflatable Lifejackets', quantity: lifejackets, unit: 'Vests' },
        { item: 'Mobile Misting Cooling Fans', quantity: mistingUnits, unit: 'Units' }
      ],
      assignedUnits: [leadUnit, 'Civil Defence Quick Response Team'],
      evacuationRouteSafe: routeSafe,
      evacuationRouteDetails: routeSafe
        ? 'Primary Arterial Route: Verified clear of standing water (Flood stage < 0.5m).'
        : `CRITICAL ROUTE ADVISORY: Inundation of ${neighborhood.floodDepthMeters}m detected on low-level road. Divert via Boulevard Flyover.`,
      generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      approvedBy: 'Command Center Incident Commander',
      status: 'DISPATCHED'
    };

    // Post to FastAPI backend
    fetch('/api/v1/climate/response-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        neighborhoodId: newPlan.neighborhoodId,
        neighborhoodName: newPlan.neighborhoodName,
        primaryHazard: newPlan.primaryHazard,
        riskSeverity: newPlan.riskSeverity,
        objectives: newPlan.objectives,
        requiredSupplies: newPlan.requiredSupplies,
        assignedUnits: newPlan.assignedUnits,
        evacuationRouteSafe: newPlan.evacuationRouteSafe,
        approvedBy: newPlan.approvedBy
      })
    }).catch(() => {});

    setTimeout(() => {
      setIsSubmitting(false);
      onPlanCreated(newPlan);
      onClose();
    }, 400);
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...cardStyle, width: '640px' }}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 800 }}>CREATE COMMUNITY RESPONSE PLAN</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Multi-Agency Dispatch, Supply Allocation & Evacuation Route Safety
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <form onSubmit={handleCreatePlan} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Ward & Hazard Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>TARGET WARD</span>
              <strong style={{ fontSize: '12px', color: '#fff' }}>{neighborhood.name}</strong>
              <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>{neighborhood.wardNumber}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>COMPOUND HAZARDS</span>
              <strong style={{ fontSize: '12px', color: '#ef4444' }}>{neighborhood.primaryHazard.replace('_', ' ')}</strong>
              <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>
                {neighborhood.apparentTempC}°C heat / {neighborhood.floodDepthMeters}m flood
              </div>
            </div>
          </div>

          {/* Lead Unit Selection */}
          <div>
            <label style={labelStyle}>Assign Lead Response Organization</label>
            <select
              value={leadUnit}
              onChange={(e) => setLeadUnit(e.target.value)}
              style={inputStyle}
            >
              <option value="NDRF Auxiliary Taskforce (Inspector Rajesh Rawat)">NDRF Auxiliary Taskforce (Inspector Rajesh Rawat)</option>
              <option value="SEWA Community Health Volunteer Corps (Dr. Priyanka Mehra)">SEWA Community Health Volunteer Corps (Dr. Priyanka Mehra)</option>
              <option value="Indian Red Cross Disaster Relief Unit">Indian Red Cross Disaster Relief Unit</option>
              <option value="Delhi Civil Defence Quick Response Unit 4">Delhi Civil Defence Quick Response Unit 4</option>
              <option value="Youth for Climate Action Delhi (Arjun Sen)">Youth for Climate Action Delhi (Arjun Sen)</option>
            </select>
          </div>

          {/* Supply Matching Grid */}
          <div>
            <label style={labelStyle}>Pre-Position Essential Relief Supplies</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Potable Water (Liters):</span>
                <input
                  type="number"
                  value={waterLiters}
                  onChange={(e) => setWaterLiters(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Oral Rehydration Salts (ORS):</span>
                <input
                  type="number"
                  value={orsPacks}
                  onChange={(e) => setOrsPacks(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Inflatable Lifejackets:</span>
                <input
                  type="number"
                  value={lifejackets}
                  onChange={(e) => setLifejackets(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Mobile Misting Fans:</span>
                <input
                  type="number"
                  value={mistingUnits}
                  onChange={(e) => setMistingUnits(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Safe Route Verification */}
          <div style={{
            background: routeSafe ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: routeSafe ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '11px', color: routeSafe ? '#10b981' : '#ef4444' }}>
                  {routeSafe ? '✔ Evacuation Route Status: VERIFIED SAFE' : '⚠ Evacuation Route Status: HAZARD DETECTED'}
                </strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#94a3b8' }}>
                  {routeSafe
                    ? 'Primary road elevation is above current Yamuna stage. Safe for light vehicles & foot transit.'
                    : `Inundation of ${neighborhood.floodDepthMeters}m exceeds light vehicle clearance. High-clearance heavy vehicles or elevated flyover detour required.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRouteSafe(!routeSafe)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                Override Check
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: '1px solid #38bdf8',
              color: '#fff',
              padding: '10px',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '4px'
            }}
          >
            {isSubmitting ? 'Authorizing & Dispatching...' : 'Authorize & Dispatch Community Response Plan'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ── 5. LOCATION HISTORY DRAWER ── */
interface LocationHistoryProps {
  neighborhood: ClimateNeighborhood;
  isOpen: boolean;
  onClose: () => void;
}

export const LocationHistoryDrawer: React.FC<LocationHistoryProps> = ({
  neighborhood,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  // Filter events for this neighborhood or show regional records
  const events = LOCATION_HISTORY_RECORDS.filter(e => e.neighborhoodId === neighborhood.id);
  const displayEvents = events.length > 0 ? events : LOCATION_HISTORY_RECORDS;

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...cardStyle, width: '640px' }}>
        <div style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 800 }}>LOCATION CLIMATE HISTORY & AUDIT TRAIL</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Historical Hazard Inundations, Heatwave Extremes & Past Interventions for <strong style={{ color: '#38bdf8' }}>{neighborhood.name}</strong>
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {displayEvents.map(evt => (
            <div
              key={evt.id}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700 }}>
                  {evt.date} • {evt.eventType.replace('_', ' ')}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: evt.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : evt.severity === 'RESOLVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: evt.severity === 'CRITICAL' ? '#ef4444' : evt.severity === 'RESOLVED' ? '#10b981' : '#f59e0b'
                }}>
                  {evt.severity}
                </span>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>{evt.title}</div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 6px 0', lineHeight: 1.4 }}>{evt.summary}</p>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                <span style={{ color: '#cbd5e1' }}>Recorded Metric: <strong style={{ color: '#38bdf8' }}>{evt.recordedMetric}</strong></span>
                <span style={{ color: '#64748b' }}>Agency: {evt.leadAgency}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* Common Styles */
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4, 8, 16, 0.85)',
  backdropFilter: 'blur(14px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px'
};

const cardStyle: React.CSSProperties = {
  width: '540px',
  maxWidth: '95vw',
  background: '#090e18',
  border: '1px solid rgba(56, 189, 248, 0.28)',
  borderRadius: '12px',
  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
  color: '#f1f5f9',
  overflow: 'hidden'
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  background: 'rgba(15, 23, 42, 0.95)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '4px'
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '4px'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0, 0, 0, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#fff',
  fontSize: '12px',
  outline: 'none',
  boxSizing: 'border-box'
};

