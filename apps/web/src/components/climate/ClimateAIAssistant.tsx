import React, { useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle,
  Lock,
  Send,
  AlertCircle
} from 'lucide-react';
import type { ClimateNeighborhood } from '../../data/climateData';
import styles from './ClimateAIAssistant.module.css';

interface Message {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: string;
  recommendations?: string[];
  resourceShortage?: string;
  isActionable?: boolean;
}

interface ClimateAIAssistantProps {
  neighborhood: ClimateNeighborhood;
  isOpen: boolean;
  onClose: () => void;
  onTriggerActionPlan: (planDetails: string) => void;
}

export const ClimateAIAssistant: React.FC<ClimateAIAssistantProps> = ({
  neighborhood,
  isOpen,
  onClose,
  onTriggerActionPlan
}) => {
  const [approvedPlan, setApprovedPlan] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [conversation, setConversation] = useState<Message[]>([
    {
      id: 'msg-init-1',
      sender: 'AI',
      text: `Situational Synthesis for ${neighborhood.name} (${neighborhood.wardNumber}): Primary hazard is ${neighborhood.primaryHazard.replace('_', ' ')}. Apparent heat index is ${neighborhood.apparentTempC}°C with flood depth of ${neighborhood.floodDepthMeters}m. Exposed population: ${neighborhood.exposedPopulation.toLocaleString()} residents.`,
      timestamp: 'Just now',
      recommendations: neighborhood.recommendedInterventions,
      resourceShortage: `Critical Deficit: ${neighborhood.waterPointsCount} water ATMs available against Sphere benchmark of ${(neighborhood.exposedPopulation * 15).toLocaleString()} L/day needed.`,
      isActionable: true
    }
  ]);

  if (!isOpen) return null;

  const handleApprove = () => {
    setApprovedPlan(true);
    onTriggerActionPlan(`Approved AI Resilience Plan for ${neighborhood.name}: Dispatched 2 water bowsers, pre-positioned medical triage team, issued SMS heat/flood advisory.`);
  };

  const handleSendMessage = (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'USER',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Generate context-aware response using active neighborhood data
    let responseText = '';
    let shortageText: string | undefined = undefined;

    const lowerQ = q.toLowerCase();
    if (lowerQ.includes('why') || lowerQ.includes('risk') || lowerQ.includes('vulnerab')) {
      responseText = `${neighborhood.name} is classified as ${neighborhood.severity} risk due to compounding factors: 1) ${neighborhood.vulnerabilityFactors[0] || 'High thermal retention'}; 2) Canopy deficit of ${neighborhood.canopyCoverPct}% (safe threshold: >25%); 3) Inundation exposure of ${neighborhood.floodDepthMeters}m under peak Yamuna stage.`;
    } else if (lowerQ.includes('shortage') || lowerQ.includes('resource') || lowerQ.includes('water') || lowerQ.includes('deficit')) {
      responseText = `Resource Sufficiency Audit for ${neighborhood.name}: Current ratio is ${Math.round(neighborhood.resourceSufficiencyRatio * 100)}% of required minimums. The ward has ${neighborhood.coolingCentersCount} cooling center(s) and ${neighborhood.waterPointsCount} water dispensing kiosk(s).`;
      shortageText = `Immediate deficit: Minimum ${(Math.round(neighborhood.exposedPopulation * 12)).toLocaleString()} Liters of potable water and 120 additional respite beds required during extreme heatwave.`;
    } else if (lowerQ.includes('allocat') || lowerQ.includes('propos')) {
      responseText = `OR-Tools Resource Matching recommendation for ${neighborhood.name}: Pre-position 2 mobile water bowsers from Shahdara Depot (distance: 3.4km, transit: 14 mins). Route is safe from waterlogging via Majnu Ka Tila bypass.`;
    } else if (lowerQ.includes('complet') || lowerQ.includes('pend') || lowerQ.includes('activit')) {
      responseText = `Activity Summary: 180 cool roofs inspected & verified; 350 native shade trees planted; 1 open drinking water request pending volunteer assignment. Assigned lead unit is ${neighborhood.assignedTeam}.`;
    } else {
      responseText = `Analysis for ${neighborhood.name}: Observed data confirms ${neighborhood.apparentTempC}°C apparent temperature and ${neighborhood.exposedPopulation.toLocaleString()} residents in risk zone. Recommended priority is deploying shaded hydration hubs and mobile medical spotters.`;
    }

    const aiMsg: Message = {
      id: `ai-${Date.now() + 1}`,
      sender: 'AI',
      text: responseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resourceShortage: shortageText
    };

    setConversation(prev => [...prev, userMsg, aiMsg]);
    setInputQuery('');
  };

  return (
    <div className={styles.assistantDrawer}>
      {/* Header */}
      <div className={styles.assistantHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>AI COPILOT</span>
          <h4>Climate Resilience Assistant</h4>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Real-time Data Freshness Banner */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '6px 14px',
        fontSize: '10px',
        color: '#94a3b8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={12} color="#10b981" />
          <span>Active Context: <strong style={{ color: '#fff' }}>{neighborhood.name}</strong></span>
        </div>
        <span style={{ color: '#38bdf8' }}>CWC + Open-Meteo Live</span>
      </div>

      {/* Chat / Analysis Content */}
      <div className={styles.chatContent}>
        {conversation.map(msg => (
          <div
            key={msg.id}
            className={styles.messageBubble}
            style={{
              background: msg.sender === 'USER' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.85)',
              borderLeft: msg.sender === 'USER' ? '3px solid #38bdf8' : '3px solid #10b981'
            }}
          >
            <div className={styles.messageHeader}>
              <span style={{ color: msg.sender === 'USER' ? '#38bdf8' : '#10b981' }}>
                {msg.sender === 'USER' ? 'Operator Query' : 'Explainable Synthesis (94% Conf.)'}
              </span>
              <span>{msg.timestamp}</span>
            </div>
            <p style={{ margin: '4px 0 6px 0', lineHeight: 1.4, color: '#f1f5f9', fontSize: '12px' }}>
              {msg.text}
            </p>

            {/* Resource Shortages Card */}
            {msg.resourceShortage && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', padding: '8px 10px', fontSize: '11px', color: '#fca5a5', marginTop: '6px' }}>
                <strong>Vulnerability Shortage Detected: </strong>{msg.resourceShortage}
              </div>
            )}

            {/* Recommendations List */}
            {msg.recommendations && msg.recommendations.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                  Recommended Community Interventions:
                </span>
                <ul className={styles.recommendationsList} style={{ marginTop: '4px' }}>
                  {msg.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Human-in-the-loop Guardrail on actionable response */}
            {msg.isActionable && (
              <div style={{ marginTop: '10px' }}>
                {approvedPlan ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '11px', fontWeight: 700, padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
                    <CheckCircle size={16} />
                    Action Plan Approved by Human Operator & Dispatched to Field Unit!
                  </div>
                ) : (
                  <button className={styles.actionButton} onClick={handleApprove}>
                    <Sparkles size={14} />
                    Authorize & Dispatch Recommended Plan
                  </button>
                )}
                <div className={styles.humanGuardrail}>
                  <Lock size={12} />
                  Human-in-the-loop verification required. AI cannot independently dispatch emergency personnel or commit municipal resources.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Context-Aware Action Prompts */}
      <div className={styles.quickPrompts}>
        <button
          className={styles.quickPromptBtn}
          onClick={() => handleSendMessage('Why is this location high risk?')}
        >
          Why is this location high risk?
        </button>
        <button
          className={styles.quickPromptBtn}
          onClick={() => handleSendMessage('Identify resource shortages in this ward')}
        >
          Identify resource shortages
        </button>
        <button
          className={styles.quickPromptBtn}
          onClick={() => handleSendMessage('Explain proposed resource allocations')}
        >
          Explain resource allocations
        </button>
        <button
          className={styles.quickPromptBtn}
          onClick={() => handleSendMessage('Summarize completed and pending activities')}
        >
          Completed vs Pending Activities
        </button>
      </div>

      {/* Custom Query Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px',
          background: 'rgba(11, 18, 30, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <input
          type="text"
          placeholder="Ask AI about climate risks, routes, or resources..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#fff',
            fontSize: '12px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            border: '1px solid #38bdf8',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
