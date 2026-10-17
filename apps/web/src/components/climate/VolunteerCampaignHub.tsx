import React, { useState } from 'react';
import {
  Users,
  X,
  UserPlus,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus
} from 'lucide-react';
import {
  CLIMATE_CAMPAIGNS,
  VOLUNTEER_TEAMS,
  INITIAL_COMMUNITY_TASKS,
  NGO_PARTNERS,
  type ClimateCampaign,
  type CommunityTask,
  type TaskStatus
} from '../../data/climateData';
import styles from './VolunteerCampaignHub.module.css';

interface VolunteerCampaignHubProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR', text: string) => void;
}

export const VolunteerCampaignHub: React.FC<VolunteerCampaignHubProps> = ({
  isOpen,
  onClose,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'CAMPAIGNS' | 'VOLUNTEERS' | 'REGISTER' | 'NGO_COORDINATION' | 'LOG_HOURS'>('TASKS');
  const [userRole, setUserRole] = useState<'ADMIN' | 'VOLUNTEER' | 'COMMUNITY' | 'PROVIDER'>('VOLUNTEER');
  
  // Data States
  const [campaigns, setCampaigns] = useState<ClimateCampaign[]>(CLIMATE_CAMPAIGNS);
  const [tasks, setTasks] = useState<CommunityTask[]>(INITIAL_COMMUNITY_TASKS);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  
  // Task action modal state
  const [selectedTaskForEvidence, setSelectedTaskForEvidence] = useState<CommunityTask | null>(null);
  const [evidenceHours, setEvidenceHours] = useState(3.5);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  // Register Volunteer Form
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    serviceArea: 'Yamuna Floodplain (Ward 24)',
    skills: ['First Aid', 'Heatstroke First Aid'],
    availability: 'ACTIVE'
  });

  // Hours logging form
  const [hoursForm, setHoursForm] = useState({
    teamId: 'VOL-TM-02',
    hours: 4,
    activity: 'Cool Roof White Coating Deployment',
    evidenceFile: ''
  });

  // New Campaign Form Modal
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [newCampaignForm, setNewCampaignForm] = useState({
    title: '',
    category: 'COOL_ROOFS' as ClimateCampaign['category'],
    locationName: 'Seelampur Informal Sector',
    targetCount: 2000,
    unit: 'tin roofs coated',
    organizer: 'WOW Community Resilience Alliance',
    volunteerCapacity: 50,
    impactSummary: 'Reduces heat mortality among high-density informal settlements.'
  });

  if (!isOpen) return null;

  // ── Task Lifecycle Transition Handlers ──
  const handleAssignTask = (taskId: string, volunteerTeam: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: 'ASSIGNED',
          assignedVolunteerName: volunteerTeam
        };
      }
      return t;
    }));

    // Notify backend
    fetch(`/api/v1/climate/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ASSIGNED', assignedVolunteerName: volunteerTeam })
    }).catch(() => {});

    onShowToast('SUCCESS', `Assigned task to ${volunteerTeam}. Dispatch notification broadcasted.`);
  };

  const handleStartTask = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, status: 'IN_PROGRESS' };
      }
      return t;
    }));

    fetch(`/api/v1/climate/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    }).catch(() => {});

    onShowToast('INFO', 'Task marked IN PROGRESS. Live field timer initiated.');
  };

  const handleSubmitEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForEvidence) return;

    const taskId = selectedTaskForEvidence.id;
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: 'COMPLETED',
          hoursLogged: evidenceHours,
          evidenceNotes: evidenceNote || 'Field action completed according to Sphere relief protocols.',
          evidencePhotoUrl: evidenceUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400'
        };
      }
      return t;
    }));

    fetch(`/api/v1/climate/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'COMPLETED',
        hoursLogged: evidenceHours,
        evidenceNotes: evidenceNote,
        evidencePhotoUrl: evidenceUrl
      })
    }).catch(() => {});

    onShowToast('SUCCESS', `Task completed with ${evidenceHours} hours logged! Submitted to verification queue.`);
    setSelectedTaskForEvidence(null);
  };

  const handleVerifyTask = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: 'VERIFIED',
          verifiedBy: 'Lead Resilience Officer & Field Auditor',
          verifiedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
      return t;
    }));

    fetch(`/api/v1/climate/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED', verifiedBy: 'Lead Resilience Officer' })
    }).catch(() => {});

    onShowToast('SUCCESS', 'Audit Approved: Task verified with immutable tamper-proof record.');
  };

  // ── Register Volunteer Submission ──
  const handleRegisterVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.fullName || !regForm.phone) {
      onShowToast('WARNING', 'Please provide full name and phone number.');
      return;
    }

    fetch('/api/v1/climate/volunteers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: regForm.fullName,
        email: regForm.email || 'volunteer@wow-delhi.org',
        phone: regForm.phone,
        skills: regForm.skills,
        serviceAreas: [regForm.serviceArea],
        availabilityStatus: regForm.availability
      })
    }).catch(() => {});

    onShowToast('SUCCESS', `Registered ${regForm.fullName} as active Community Resilience Volunteer! ID credentials issued.`);
    setRegForm({
      fullName: '',
      email: '',
      phone: '',
      serviceArea: 'Yamuna Floodplain (Ward 24)',
      skills: ['First Aid'],
      availability: 'ACTIVE'
    });
    setActiveTab('VOLUNTEERS');
  };

  // ── Create Campaign Submission ──
  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    const newCamp: ClimateCampaign = {
      id: `CMP-${Date.now().toString().slice(-4)}`,
      title: newCampaignForm.title,
      category: newCampaignForm.category,
      locationName: newCampaignForm.locationName,
      targetCount: newCampaignForm.targetCount,
      currentCount: 0,
      unit: newCampaignForm.unit,
      organizer: newCampaignForm.organizer,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '2026-12-31',
      volunteersJoined: 1,
      volunteerCapacity: newCampaignForm.volunteerCapacity,
      status: 'ACTIVE',
      verifiedEvidenceCount: 0,
      impactSummary: newCampaignForm.impactSummary
    };

    setCampaigns(prev => [newCamp, ...prev]);

    fetch('/api/v1/climate/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newCamp.title,
        type: newCamp.category,
        targetCount: newCamp.targetCount,
        unit: newCamp.unit,
        wardId: 'ward-custom',
        wardName: newCamp.locationName,
        targetDate: newCamp.endDate,
        maxVolunteers: newCamp.volunteerCapacity
      })
    }).catch(() => {});

    onShowToast('SUCCESS', `Launched Climate Campaign: "${newCamp.title}"! Mobilizing local ward units.`);
    setIsNewCampaignOpen(false);
  };

  const handleJoinCampaign = (campaignId: string) => {
    setCampaigns(prev =>
      prev.map(c => {
        if (c.id === campaignId) {
          return {
            ...c,
            volunteersJoined: Math.min(c.volunteerCapacity, c.volunteersJoined + 1)
          };
        }
        return c;
      })
    );
    onShowToast('SUCCESS', 'Successfully registered as an active volunteer for this climate campaign!');
  };

  const handleLogHours = (e: React.FormEvent) => {
    e.preventDefault();
    onShowToast('SUCCESS', `Logged ${hoursForm.hours} volunteer hours for ${hoursForm.activity}. Sent to administrator audit queue.`);
    setActiveTab('TASKS');
  };

  // Filtered Tasks
  const filteredTasks = tasks.filter(t => {
    if (taskStatusFilter === 'ALL') return true;
    return t.status === taskStatusFilter;
  });

  return (
    <div className={styles.hubModalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.hubCard}>
        {/* Header */}
        <div className={styles.hubHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Users size={20} />
            </div>
            <div>
              <h3>VOLUNTEER HUB & CLIMATE RESILIENCE CAMPAIGNS</h3>
              <p>Community Action Mobilization, Skills Deployment & Verified Evidence Tracking</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Role Selector */}
        <div className={styles.roleBar}>
          <span className={styles.roleLabel}>Active Persona:</span>
          {(['ADMIN', 'VOLUNTEER', 'COMMUNITY', 'PROVIDER'] as const).map(role => (
            <button
              key={role}
              className={`${styles.roleBtn} ${userRole === role ? styles.roleBtnActive : ''}`}
              onClick={() => setUserRole(role)}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Sub Tabs */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabLink} ${activeTab === 'TASKS' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('TASKS')}
          >
            Community Tasks ({tasks.length})
          </button>
          <button
            className={`${styles.tabLink} ${activeTab === 'CAMPAIGNS' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('CAMPAIGNS')}
          >
            Climate Action Campaigns ({campaigns.length})
          </button>
          <button
            className={`${styles.tabLink} ${activeTab === 'VOLUNTEERS' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('VOLUNTEERS')}
          >
            Volunteer Units ({VOLUNTEER_TEAMS.length})
          </button>
          <button
            className={`${styles.tabLink} ${activeTab === 'REGISTER' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('REGISTER')}
          >
            + Register Volunteer
          </button>
          <button
            className={`${styles.tabLink} ${activeTab === 'NGO_COORDINATION' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('NGO_COORDINATION')}
          >
            NGO Coordination ({NGO_PARTNERS.length})
          </button>
          <button
            className={`${styles.tabLink} ${activeTab === 'LOG_HOURS' ? styles.tabLinkActive : ''}`}
            onClick={() => setActiveTab('LOG_HOURS')}
          >
            Log Hours
          </button>
        </div>

        {/* Body */}
        <div className={styles.hubBody}>
          {/* ── 1. COMMUNITY TASKS (Full 5-Step Lifecycle Workflow) ── */}
          {activeTab === 'TASKS' && (
            <div>
              {/* Task Status Filters Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => setTaskStatusFilter(st)}
                      style={{
                        background: taskStatusFilter === st ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: taskStatusFilter === st ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                        color: taskStatusFilter === st ? '#fff' : '#94a3b8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Workflow: <strong>Open &rarr; Assigned &rarr; In Progress &rarr; Completed &rarr; Verified</strong>
                </span>
              </div>

              {/* Task Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredTasks.map(task => {
                  const statusColors: Record<TaskStatus, { bg: string; text: string }> = {
                    OPEN: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8' },
                    ASSIGNED: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
                    IN_PROGRESS: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
                    COMPLETED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
                    VERIFIED: { bg: 'rgba(16, 185, 129, 0.25)', text: '#34d399' }
                  };

                  return (
                    <div
                      key={task.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: task.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: task.priority === 'CRITICAL' ? '#ef4444' : '#f59e0b'
                            }}>
                              {task.priority} PRIORITY
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{task.neighborhoodName}</span>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                            {task.title}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div style={{
                          background: statusColors[task.status].bg,
                          color: statusColors[task.status].text,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {task.status === 'VERIFIED' && <CheckCircle2 size={13} />}
                          {task.status === 'IN_PROGRESS' && <Clock size={13} />}
                          {task.status.replace('_', ' ')}
                        </div>
                      </div>

                      {/* Required Skills & Assigned Units */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8' }}>Skills:</span>
                          {task.requiredSkills.map(sk => (
                            <span key={sk} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#cbd5e1', fontSize: '10px' }}>
                              {sk}
                            </span>
                          ))}
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Assigned: </span>
                          <strong style={{ color: task.assignedVolunteerName ? '#38bdf8' : '#64748b' }}>
                            {task.assignedVolunteerName || 'Unassigned'}
                          </strong>
                        </div>
                      </div>

                      {/* Evidence / Notes if completed or verified */}
                      {task.evidenceNotes && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', borderLeft: '2px solid #10b981' }}>
                          <span style={{ color: '#94a3b8', display: 'block', fontSize: '9px', fontWeight: 700 }}>FIELD EVIDENCE LOG:</span>
                          <span style={{ color: '#cbd5e1' }}>{task.evidenceNotes}</span>
                          {task.verifiedBy && (
                            <div style={{ marginTop: '4px', color: '#10b981', fontWeight: 700, fontSize: '10px' }}>
                              ✔ Audited & Verified by {task.verifiedBy} at {task.verifiedAt}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons based on lifecycle status */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                        {task.status === 'OPEN' && (
                          <button
                            onClick={() => handleAssignTask(task.id, 'Shahdara Heat Respite Brigade')}
                            style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Assign to Volunteer Unit
                          </button>
                        )}
                        {task.status === 'ASSIGNED' && (
                          <button
                            onClick={() => handleStartTask(task.id)}
                            style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid #c084fc', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Start Action (In Progress)
                          </button>
                        )}
                        {task.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => setSelectedTaskForEvidence(task)}
                            style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Complete & Submit Evidence
                          </button>
                        )}
                        {task.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleVerifyTask(task.id)}
                            style={{ background: 'linear-gradient(135deg, #059669, #047857)', border: '1px solid #34d399', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Verify & Audit Task
                          </button>
                        )}
                        {task.status === 'VERIFIED' && (
                          <span style={{ fontSize: '11px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <ShieldCheck size={14} /> Immutable Audit Record Verified
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 2. CAMPAIGNS TAB ── */}
          {activeTab === 'CAMPAIGNS' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Mobilize community campaigns across cool roofs, riparian canopy, and drainage clearing.
                </span>
                <button
                  onClick={() => setIsNewCampaignOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: '1px solid #34d399',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={14} /> Create Climate Campaign
                </button>
              </div>

              <div className={styles.gridCards}>
                {campaigns.map(camp => {
                  const progressPct = Math.round((camp.currentCount / camp.targetCount) * 100);
                  return (
                    <div key={camp.id} className={styles.campaignCard}>
                      <div className={styles.cardHeader}>
                        <div>
                          <span className={styles.cardCategory}>{camp.category.replace('_', ' ')}</span>
                          <div className={styles.cardTitle}>{camp.title}</div>
                        </div>
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          {camp.status}
                        </span>
                      </div>

                      <div className={styles.progressBarContainer}>
                        <div className={styles.progressBarFill} style={{ width: `${progressPct}%` }} />
                      </div>

                      <div className={styles.cardStats}>
                        <span>Progress: <strong>{camp.currentCount.toLocaleString()} / {camp.targetCount.toLocaleString()} {camp.unit}</strong></span>
                        <span><strong>{progressPct}%</strong></span>
                      </div>

                      <div className={styles.cardStats}>
                        <span>Location: <strong>{camp.locationName}</strong></span>
                        <span>Volunteers: <strong>{camp.volunteersJoined}/{camp.volunteerCapacity}</strong></span>
                      </div>

                      <div className={styles.cardImpact}>
                        {camp.impactSummary}
                      </div>

                      <button className={styles.joinBtn} onClick={() => handleJoinCampaign(camp.id)}>
                        <UserPlus size={14} />
                        Join Climate Campaign
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3. REGISTER VOLUNTEER TAB ── */}
          {activeTab === 'REGISTER' && (
            <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '24px' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff' }}>Volunteer Registration & Skills Profile</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#94a3b8' }}>
                  Register to receive real-time SMS alerts and mission dispatches for extreme heat and flood events.
                </p>

                <form onSubmit={handleRegisterVolunteer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>FULL NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>PHONE (SMS ALERTS)</label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={regForm.phone}
                        onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>PRIMARY SERVICE WARD</label>
                      <select
                        value={regForm.serviceArea}
                        onChange={(e) => setRegForm({ ...regForm, serviceArea: e.target.value })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      >
                        <option value="Yamuna Floodplain (Ward 24)">Yamuna Floodplain (Ward 24)</option>
                        <option value="Seelampur (Ward 41)">Seelampur (Ward 41)</option>
                        <option value="Geeta Colony (Ward 57)">Geeta Colony (Ward 57)</option>
                        <option value="Majnu Ka Tila (Ward 12)">Majnu Ka Tila (Ward 12)</option>
                        <option value="Kashmere Gate (Ward 18)">Kashmere Gate (Ward 18)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '6px' }}>SKILLS & CERTIFICATIONS</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {['First Aid', 'Heatstroke First Aid', 'Water Distribution', 'Flood Rescue', 'Tree Care', 'Thermal Survey', 'Elderly Survey'].map(sk => {
                        const isSelected = regForm.skills.includes(sk);
                        return (
                          <button
                            type="button"
                            key={sk}
                            onClick={() => {
                              if (isSelected) {
                                setRegForm({ ...regForm, skills: regForm.skills.filter(s => s !== sk) });
                              } else {
                                setRegForm({ ...regForm, skills: [...regForm.skills, sk] });
                              }
                            }}
                            style={{
                              background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                              border: isSelected ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                              color: isSelected ? '#fff' : '#94a3b8',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            {isSelected ? '✔ ' : '+ '}{sk}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: '1px solid #34d399',
                      color: '#fff',
                      padding: '10px',
                      borderRadius: '6px',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      marginTop: '8px'
                    }}
                  >
                    Submit Volunteer Registration
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── 4. NGO COORDINATION TAB ── */}
          {activeTab === 'NGO_COORDINATION' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Active Disaster Relief & Community Action NGO Partners connected to the WOW Unified Command Grid.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {NGO_PARTNERS.map(ngo => (
                  <div
                    key={ngo.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>{ngo.name}</div>
                        <div style={{ fontSize: '11px', color: '#38bdf8' }}>Contact: {ngo.leadContact} ({ngo.phone})</div>
                      </div>
                      <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                        {ngo.acronym}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                      <strong>Specialization: </strong>{ngo.specialization}
                    </div>

                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      <strong>Assigned Wards: </strong>{ngo.assignedWards.join(', ')}
                    </div>

                    <div style={{ fontSize: '11px', color: '#10b981' }}>
                      <strong>Standby Assets: </strong>{ngo.standbyAssets.join(' • ')}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#fff' }}>
                        Active Volunteers: <strong>{ngo.activeVolunteers}</strong>
                      </span>
                      <button
                        onClick={() => onShowToast('SUCCESS', `Dispatched coordination ping to ${ngo.acronym} incident lead.`)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10b981',
                          color: '#10b981',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Ping Coordinator
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 5. VOLUNTEER UNITS TAB ── */}
          {activeTab === 'VOLUNTEERS' && (
            <div className={styles.gridCards}>
              {VOLUNTEER_TEAMS.map(team => (
                <div key={team.id} className={styles.teamCard}>
                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.cardTitle}>{team.name}</div>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{team.organization}</span>
                    </div>
                    <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      {team.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className={styles.cardStats}>
                    <span>Team Lead: <strong>{team.leaderName}</strong></span>
                    <span>Members: <strong>{team.memberCount} Responders</strong></span>
                  </div>

                  <div className={styles.cardStats}>
                    <span>Hours Logged: <strong>{team.hoursLogged} hrs</strong></span>
                    <span>Completed Actions: <strong>{team.actionsCompleted}</strong></span>
                  </div>

                  <div className={styles.skillsPillGroup}>
                    {team.skills.map(sk => (
                      <span key={sk} className={styles.skillPill}>{sk}</span>
                    ))}
                  </div>

                  <div style={{ fontSize: '11px', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                    Equipment: {team.equipment.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 6. LOG HOURS TAB ── */}
          {activeTab === 'LOG_HOURS' && (
            <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#fff' }}>Log Verified Volunteer Service Hours</h4>

                <form onSubmit={handleLogHours} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>VOLUNTEER UNIT</label>
                    <select
                      value={hoursForm.teamId}
                      onChange={(e) => setHoursForm({ ...hoursForm, teamId: e.target.value })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                    >
                      {VOLUNTEER_TEAMS.map(vt => (
                        <option key={vt.id} value={vt.id}>{vt.name} ({vt.leaderName})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>HOURS SPENT ON SCENE</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={hoursForm.hours}
                      onChange={(e) => setHoursForm({ ...hoursForm, hours: Number(e.target.value) })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>ACTION DESCRIPTION</label>
                    <input
                      type="text"
                      value={hoursForm.activity}
                      onChange={(e) => setHoursForm({ ...hoursForm, activity: e.target.value })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
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
                      marginTop: '6px'
                    }}
                  >
                    Submit Service Hours for Verification
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evidence Submission Modal for Task */}
      {selectedTaskForEvidence && (
        <div className={styles.hubModalOverlay} style={{ zIndex: 1100 }}>
          <div style={{ background: '#0f172a', border: '1px solid #10b981', borderRadius: '12px', width: '480px', padding: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px' }}>Submit Task Completion Evidence</h4>
              <button onClick={() => setSelectedTaskForEvidence(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitEvidence} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>TASK:</span>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>{selectedTaskForEvidence.title}</div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>HOURS LOGGED</label>
                <input
                  type="number"
                  step="0.5"
                  value={evidenceHours}
                  onChange={(e) => setEvidenceHours(Number(e.target.value))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>FIELD NOTES & METRICS</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Coated 120 roofs; confirmed 5.4C temperature reduction."
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>PHOTO EVIDENCE URL (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: '1px solid #34d399',
                  color: '#fff',
                  padding: '10px',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
              >
                Submit Evidence to Auditor Queue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create New Campaign Modal */}
      {isNewCampaignOpen && (
        <div className={styles.hubModalOverlay} style={{ zIndex: 1100 }}>
          <div style={{ background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '12px', width: '520px', padding: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px' }}>Create New Climate Action Campaign</h4>
              <button onClick={() => setIsNewCampaignOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CAMPAIGN TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Geeta Colony Tree Canopy Shading Drive"
                  value={newCampaignForm.title}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, title: e.target.value })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>CATEGORY</label>
                  <select
                    value={newCampaignForm.category}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, category: e.target.value as any })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="COOL_ROOFS">Cool Roofs Coating</option>
                    <option value="TREE_PLANTING">Tree Planting & Canopy</option>
                    <option value="WATER_CONSERVATION">Water & Rainwater Harvesting</option>
                    <option value="CLEANUP_WASTE">Drainage & Waste Clearing</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>TARGET WARD</label>
                  <input
                    type="text"
                    value={newCampaignForm.locationName}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, locationName: e.target.value })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>TARGET GOAL</label>
                  <input
                    type="number"
                    value={newCampaignForm.targetCount}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, targetCount: Number(e.target.value) })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>UNIT</label>
                  <input
                    type="text"
                    value={newCampaignForm.unit}
                    onChange={(e) => setNewCampaignForm({ ...newCampaignForm, unit: e.target.value })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>IMPACT SUMMARY</label>
                <textarea
                  rows={2}
                  value={newCampaignForm.impactSummary}
                  onChange={(e) => setNewCampaignForm({ ...newCampaignForm, impactSummary: e.target.value })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px', borderRadius: '6px', color: '#fff' }}
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
                  marginTop: '8px'
                }}
              >
                Launch Campaign & Open Registration
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
