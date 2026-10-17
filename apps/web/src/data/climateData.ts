/**
 * WOW Platform — Climate Intelligence & Community Resilience Dataset
 * Realistic GeoJSON neighborhood zones, climate hazards, cooling centers,
 * drinking water distribution points, volunteers, campaigns, and impact records.
 */


export interface ClimateNeighborhood {
  id: string;
  code: string;
  name: string;
  wardNumber: string;
  zone: string;
  primaryHazard: 'URBAN_HEAT' | 'FLOOD_SURGE' | 'CANOPY_DEFICIT' | 'MULTI_HAZARD';
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  ambientTempC: number;
  apparentTempC: number;
  floodDepthMeters: number;
  canopyCoverPct: number;
  exposedPopulation: number;
  demographicSensitivityPct: number;
  facilitiesCount: number;
  resourceSufficiencyRatio: number;
  vulnerabilityFactors: string[];
  coolingCentersCount: number;
  waterPointsCount: number;
  shelterBedsAvailable: number;
  openRequestsCount: number;
  assignedTeam: string;
  recommendedInterventions: string[];
  coordinates: [number, number][][];
  center: [number, number];
  height: number;
  color: string;
  dataSource: string;
  lastUpdated: string;
}

export const CLIMATE_NEIGHBORHOODS: ClimateNeighborhood[] = [
  {
    id: 'ZONE-DL-001',
    code: 'NZ-YMN-01',
    name: 'Yamuna Riverfront Low-Lying Settlement',
    wardNumber: 'Ward 24 (Civil Lines North)',
    zone: 'Riparian Flood Inundation Buffer',
    primaryHazard: 'FLOOD_SURGE',
    severity: 'CRITICAL',
    ambientTempC: 38.4,
    apparentTempC: 44.2,
    floodDepthMeters: 1.85,
    canopyCoverPct: 8.2,
    exposedPopulation: 14200,
    demographicSensitivityPct: 88,
    facilitiesCount: 1,
    resourceSufficiencyRatio: 0.28,
    vulnerabilityFactors: [
      'Informal riverbed housing directly in active flood discharge channel',
      'No elevated plinth structures or permanent flood barriers',
      'High proportion of infants and daily-wage laborers with zero mobility assets',
      'Drinking water borewells contaminated by river silt overflow'
    ],
    coolingCentersCount: 1,
    waterPointsCount: 2,
    shelterBedsAvailable: 80,
    openRequestsCount: 7,
    assignedTeam: 'NDRF Unit 8 & Delhi Civil Defence Relief Taskforce',
    recommendedInterventions: [
      'Deploy inflatable rescue boats and amphibious personnel carriers',
      'Establish 5,000L high-capacity chlorinated water dispensing kiosks on elevated bund',
      'Evacuate vulnerable families to Civil Lines Government Senior Secondary Shelter'
    ],
    coordinates: [[
      [77.2185, 28.6185],
      [77.2205, 28.6185],
      [77.2208, 28.6165],
      [77.2188, 28.6165],
      [77.2185, 28.6185]
    ]],
    center: [77.2196, 28.6175],
    height: 48,
    color: '#ef4444',
    dataSource: 'Central Water Commission (CWC) Yamuna Gauging Station + Delhi GIS',
    lastUpdated: '12 mins ago'
  },
  {
    id: 'ZONE-DL-002',
    code: 'EZ-SLM-02',
    name: 'Seelampur High-Density Informal Sector',
    wardNumber: 'Ward 41 (Shahdara North)',
    zone: 'Extreme Urban Heat Island Precinct',
    primaryHazard: 'URBAN_HEAT',
    severity: 'CRITICAL',
    ambientTempC: 44.8,
    apparentTempC: 48.6,
    floodDepthMeters: 0.1,
    canopyCoverPct: 3.8,
    exposedPopulation: 28600,
    demographicSensitivityPct: 82,
    facilitiesCount: 2,
    resourceSufficiencyRatio: 0.35,
    vulnerabilityFactors: [
      'High thermal-mass corrugated tin and asbestos roofing (>85% of households)',
      'Sub-4% tree canopy cover causing extreme daytime microclimate radiative trap',
      'Narrow 1.5m alleyways blocking convective nighttime cooling winds',
      'Less than 14% of homes have functional air coolers or reliable electrical supply'
    ],
    coolingCentersCount: 2,
    waterPointsCount: 4,
    shelterBedsAvailable: 120,
    openRequestsCount: 9,
    assignedTeam: 'SEWA Community Health Volunteer Corps & Red Cross Delhi',
    recommendedInterventions: [
      'Apply high-albedo solar reflective white coating across 2,400 tin roofs',
      'Deploy mobile cool misting vans along main transit alleyways',
      'Install 4 shaded community hydration stations with chilled electrolyte packs'
    ],
    coordinates: [[
      [77.2210, 28.6190],
      [77.2230, 28.6190],
      [77.2232, 28.6172],
      [77.2212, 28.6172],
      [77.2210, 28.6190]
    ]],
    center: [77.2221, 28.6181],
    height: 42,
    color: '#ef4444',
    dataSource: 'MODIS Land Surface Temp (LST) & Delhi Heat Health Action Plan',
    lastUpdated: '18 mins ago'
  },
  {
    id: 'ZONE-DL-003',
    code: 'EZ-GTC-03',
    name: 'Geeta Colony Transit & Marginal Colony',
    wardNumber: 'Ward 33 (East Delhi)',
    zone: 'Combined Heat & Water-Deficit Ward',
    primaryHazard: 'MULTI_HAZARD',
    severity: 'HIGH',
    ambientTempC: 43.1,
    apparentTempC: 46.4,
    floodDepthMeters: 0.45,
    canopyCoverPct: 9.6,
    exposedPopulation: 19400,
    demographicSensitivityPct: 68,
    facilitiesCount: 3,
    resourceSufficiencyRatio: 0.52,
    vulnerabilityFactors: [
      'Groundwater salinity and municipal pipeline supply restricted to 45 mins/day',
      'High elderly population proportion (>16% over 60 years old)',
      'Periodic low-grade drainage backflow during high Yamuna gauge periods'
    ],
    coolingCentersCount: 3,
    waterPointsCount: 5,
    shelterBedsAvailable: 160,
    openRequestsCount: 5,
    assignedTeam: 'East Delhi District Disaster Management Authority (DDMA)',
    recommendedInterventions: [
      'Scheduled dispatch of 6,000L clean drinking water tankers twice daily',
      'Upgrade local Geeta Colony Community Centre into 24/7 air-conditioned cool shelter',
      'Plant 350 native shade trees along boundary perimeter road'
    ],
    coordinates: [[
      [77.2160, 28.6150],
      [77.2180, 28.6150],
      [77.2182, 28.6130],
      [77.2162, 28.6130],
      [77.2160, 28.6150]
    ]],
    center: [77.2171, 28.6140],
    height: 32,
    color: '#f59e0b',
    dataSource: 'Delhi Jal Board Pipeline Telemetry + Landsat-9 NDVI',
    lastUpdated: '25 mins ago'
  },
  {
    id: 'ZONE-DL-004',
    code: 'CZ-MJK-04',
    name: 'Majnu Ka Tila North Settlement',
    wardNumber: 'Ward 18 (Timarpur)',
    zone: 'Yamuna Riverbank & Refugee Enclave',
    primaryHazard: 'FLOOD_SURGE',
    severity: 'HIGH',
    ambientTempC: 40.2,
    apparentTempC: 44.5,
    floodDepthMeters: 1.10,
    canopyCoverPct: 14.1,
    exposedPopulation: 11200,
    demographicSensitivityPct: 62,
    facilitiesCount: 3,
    resourceSufficiencyRatio: 0.60,
    vulnerabilityFactors: [
      'Direct proximity to Yamuna embankment with limited emergency vehicle access',
      'Multi-storey dense brick structures with single narrow ingress lane'
    ],
    coolingCentersCount: 2,
    waterPointsCount: 3,
    shelterBedsAvailable: 110,
    openRequestsCount: 4,
    assignedTeam: 'Civil Defence Volunteers & Gurdwara Majnu Ka Tila Langar Trust',
    recommendedInterventions: [
      'Sandbag reinforcement of low-elevation drainage outfalls',
      'Pre-position life jackets, medical kits, and portable emergency generators'
    ],
    coordinates: [[
      [77.2190, 28.6145],
      [77.2210, 28.6145],
      [77.2212, 28.6128],
      [77.2192, 28.6128],
      [77.2190, 28.6145]
    ]],
    center: [77.2201, 28.6136],
    height: 28,
    color: '#f59e0b',
    dataSource: 'Flood Early Warning System (FLEWS) & Local Station Telemetry',
    lastUpdated: '31 mins ago'
  },
  {
    id: 'ZONE-DL-005',
    code: 'NZ-KSH-05',
    name: 'Kashmere Gate Inter-State Transit Hub',
    wardNumber: 'Ward 12 (Kashmere Gate)',
    zone: 'Canopy Deficit & Commuter Exposure Zone',
    primaryHazard: 'CANOPY_DEFICIT',
    severity: 'MODERATE',
    ambientTempC: 42.5,
    apparentTempC: 45.8,
    floodDepthMeters: 0.05,
    canopyCoverPct: 5.1,
    exposedPopulation: 35000,
    demographicSensitivityPct: 54,
    facilitiesCount: 4,
    resourceSufficiencyRatio: 0.72,
    vulnerabilityFactors: [
      'High open asphalt pavement area (>70%) causing immense heat radiation absorption',
      'Over 25,000 outdoor daily commuters and street vendors exposed without canopy cover'
    ],
    coolingCentersCount: 3,
    waterPointsCount: 6,
    shelterBedsAvailable: 220,
    openRequestsCount: 3,
    assignedTeam: 'Delhi Transport Infrastructure Development Corporation (DTIDC)',
    recommendedInterventions: [
      'Erect high-tension tensile fabric shade canopies over pedestrian boarding zones',
      'Set up 6 automated water-refill ATMs and cold electrolyte distribution'
    ],
    coordinates: [[
      [77.2235, 28.6160],
      [77.2260, 28.6160],
      [77.2262, 28.6138],
      [77.2237, 28.6138],
      [77.2235, 28.6160]
    ]],
    center: [77.2248, 28.6149],
    height: 24,
    color: '#38bdf8',
    dataSource: 'Sentinel-2 Urban Heat & Canopy Deficit Survey',
    lastUpdated: '45 mins ago'
  },
  {
    id: 'ZONE-DL-006',
    code: 'CZ-KTB-06',
    name: 'Central Secretariat & Green Enclave',
    wardNumber: 'Ward 01 (Central Delhi)',
    zone: 'High Canopy Climate Resilient Sector',
    primaryHazard: 'URBAN_HEAT',
    severity: 'LOW',
    ambientTempC: 37.8,
    apparentTempC: 40.1,
    floodDepthMeters: 0.0,
    canopyCoverPct: 42.5,
    exposedPopulation: 6800,
    demographicSensitivityPct: 22,
    facilitiesCount: 8,
    resourceSufficiencyRatio: 0.95,
    vulnerabilityFactors: [
      'Low socioeconomic vulnerability; ample municipal backup infrastructure'
    ],
    coolingCentersCount: 5,
    waterPointsCount: 8,
    shelterBedsAvailable: 350,
    openRequestsCount: 0,
    assignedTeam: 'NDMC Rapid Civic Maintenance Unit',
    recommendedInterventions: [
      'Serve as central staging depot and logistics stockpile hub for adjacent high-risk wards'
    ],
    coordinates: [[
      [77.2140, 28.6170],
      [77.2165, 28.6170],
      [77.2167, 28.6152],
      [77.2142, 28.6152],
      [77.2140, 28.6170]
    ]],
    center: [77.2153, 28.6161],
    height: 16,
    color: '#10b981',
    dataSource: 'Forest Survey of India (FSI) Canopy Assessment',
    lastUpdated: '1 hour ago'
  }
];

export interface CoolingFacility {
  id: string;
  name: string;
  type: 'COOLING_CENTER' | 'WATER_KIOSK' | 'EMERGENCY_SHELTER' | 'MEDICAL_CLINIC';
  locationName: string;
  coordinates: [number, number];
  capacityPeople: number;
  currentOccupancy: number;
  waterSupplyLiters: number;
  acEquipped: boolean;
  medicalStaffPresent: boolean;
  status: 'OPERATIONAL' | 'NEAR_CAPACITY' | 'RESTOCKING' | 'CLOSED';
  contactPerson: string;
  phone: string;
  hours: string;
}

export const COOLING_FACILITIES: CoolingFacility[] = [
  {
    id: 'FAC-DL-001',
    name: 'AIIMS Trauma Shaded Climate Respite Hub',
    type: 'COOLING_CENTER',
    locationName: 'Ring Road, Near AIIMS Metro Gate 2',
    coordinates: [77.2085, 28.5672],
    capacityPeople: 250,
    currentOccupancy: 140,
    waterSupplyLiters: 12000,
    acEquipped: true,
    medicalStaffPresent: true,
    status: 'OPERATIONAL',
    contactPerson: 'Dr. Neha Sharma (Emergency CMO)',
    phone: '+91-11-26588500',
    hours: '24/7 Continuous Emergency Response'
  },
  {
    id: 'FAC-DL-002',
    name: 'Civil Lines Public Relief & Hydration Center',
    type: 'COOLING_CENTER',
    locationName: 'Civil Lines Community Hall, Sham Nath Marg',
    coordinates: [77.2195, 28.6175],
    capacityPeople: 180,
    currentOccupancy: 125,
    waterSupplyLiters: 6500,
    acEquipped: true,
    medicalStaffPresent: true,
    status: 'OPERATIONAL',
    contactPerson: 'Rakesh Verma (DDMA Zone Lead)',
    phone: '+91-98112-34011',
    hours: '08:00 - 22:00 Daily'
  },
  {
    id: 'FAC-DL-003',
    name: 'Seelampur High-Volume Water ATM & Misting Kiosk',
    type: 'WATER_KIOSK',
    locationName: 'G.T. Road Junction, Seelampur Block C',
    coordinates: [77.2220, 28.6180],
    capacityPeople: 500,
    currentOccupancy: 310,
    waterSupplyLiters: 15000,
    acEquipped: false,
    medicalStaffPresent: false,
    status: 'OPERATIONAL',
    contactPerson: 'Imran Khan (Jal Board Supervisor)',
    phone: '+91-98711-22345',
    hours: '06:00 - 23:00 Continuous'
  },
  {
    id: 'FAC-DL-004',
    name: 'Geeta Colony Government Senior Secondary Shelter',
    type: 'EMERGENCY_SHELTER',
    locationName: 'Patparganj Road, Geeta Colony',
    coordinates: [77.2170, 28.6140],
    capacityPeople: 320,
    currentOccupancy: 210,
    waterSupplyLiters: 9000,
    acEquipped: true,
    medicalStaffPresent: true,
    status: 'OPERATIONAL',
    contactPerson: 'Sunita Devi (Principal & Center In-Charge)',
    phone: '+91-99100-88765',
    hours: '24/7 Multi-Day Shelter'
  },
  {
    id: 'FAC-DL-005',
    name: 'Gurdwara Majnu Ka Tila Community Relief Langar',
    type: 'WATER_KIOSK',
    locationName: 'Outer Ring Road, Yamuna Embankment',
    coordinates: [77.2200, 28.6135],
    capacityPeople: 600,
    currentOccupancy: 280,
    waterSupplyLiters: 20000,
    acEquipped: true,
    medicalStaffPresent: false,
    status: 'OPERATIONAL',
    contactPerson: 'Sardar Manjit Singh',
    phone: '+91-98101-77889',
    hours: '24/7 Community Relief'
  }
];

export interface VolunteerTeam {
  id: string;
  name: string;
  organization: string;
  leaderName: string;
  phone: string;
  memberCount: number;
  assignedZone: string;
  status: 'ACTIVE_DISPATCH' | 'ON_STANDBY' | 'ENGAGED_ON_SCENE' | 'OFF_DUTY';
  skills: string[];
  equipment: string[];
  hoursLogged: number;
  actionsCompleted: number;
}

export const VOLUNTEER_TEAMS: VolunteerTeam[] = [
  {
    id: 'VOL-TM-01',
    name: 'Yamuna Flood Responders Alpha',
    organization: 'National Disaster Response Force (NDRF) Auxiliary',
    leaderName: 'Inspector Rajesh Rawat',
    phone: '+91-98765-43210',
    memberCount: 16,
    assignedZone: 'Yamuna Riverfront Low-Lying Settlement',
    status: 'ENGAGED_ON_SCENE',
    skills: ['Water Rescue', 'Flood Evacuation', 'Emergency CPR', 'Boat Handling'],
    equipment: ['2 Inflatable Boats', '40 Lifejackets', '2 Water Purifiers', 'Satellite Phone'],
    hoursLogged: 342,
    actionsCompleted: 18
  },
  {
    id: 'VOL-TM-02',
    name: 'Shahdara Heat Respite Brigade',
    organization: 'SEWA Community Health Volunteer Corps',
    leaderName: 'Dr. Priyanka Mehra',
    phone: '+91-98112-99887',
    memberCount: 22,
    assignedZone: 'Seelampur High-Density Informal Sector',
    status: 'ACTIVE_DISPATCH',
    skills: ['Heatstroke First Aid', 'Dehydration Triage', 'Cool Roof Application', 'Door-to-Door Elderly Survey'],
    equipment: ['10 Misting Backpacks', '500 ORS Sachets', 'Digital Infrared Thermometers'],
    hoursLogged: 480,
    actionsCompleted: 34
  },
  {
    id: 'VOL-TM-03',
    name: 'Green Canopy Youth Initiative',
    organization: 'Youth for Climate Action Delhi',
    leaderName: 'Arjun Sen',
    phone: '+91-99887-11223',
    memberCount: 26,
    assignedZone: 'Geeta Colony Transit & Marginal Colony',
    status: 'ON_STANDBY',
    skills: ['Tree Planting', 'Micro-Forest Maintenance', 'Drip Irrigation Setup', 'Community Outreach'],
    equipment: ['Shovels & Digging Augers', 'Water Tanker Hitch', 'Plant Saplings', 'Mulch Sacks'],
    hoursLogged: 520,
    actionsCompleted: 42
  }
];

export interface ClimateCampaign {
  id: string;
  title: string;
  category: 'COOL_ROOFS' | 'TREE_PLANTING' | 'WATER_CONSERVATION' | 'CLEANUP_WASTE';
  locationName: string;
  targetCount: number;
  currentCount: number;
  unit: string;
  organizer: string;
  startDate: string;
  endDate: string;
  volunteersJoined: number;
  volunteerCapacity: number;
  status: 'ACTIVE' | 'PLANNED' | 'COMPLETED';
  verifiedEvidenceCount: number;
  impactSummary: string;
}

export const CLIMATE_CAMPAIGNS: ClimateCampaign[] = [
  {
    id: 'CMP-2026-01',
    title: 'Seelampur High-Albedo Cool Roof Drive',
    category: 'COOL_ROOFS',
    locationName: 'Seelampur Block B & C',
    targetCount: 2500,
    currentCount: 1680,
    unit: 'tin roofs coated',
    organizer: 'WOW Climate Resilience & Mahila Housing Trust',
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    volunteersJoined: 48,
    volunteerCapacity: 60,
    status: 'ACTIVE',
    verifiedEvidenceCount: 142,
    impactSummary: 'Reduces indoor peak room temperatures by 4.2°C to 5.8°C during 44°C heatwave peaks.'
  },
  {
    id: 'CMP-2026-02',
    title: 'Yamuna Riparian Green Canopy Re-Forestation',
    category: 'TREE_PLANTING',
    locationName: 'Geeta Colony Floodplain Buffer',
    targetCount: 5000,
    currentCount: 3820,
    unit: 'native saplings planted',
    organizer: 'Delhi Forest Department & Volunteers Alliance',
    startDate: '2026-08-15',
    endDate: '2026-12-15',
    volunteersJoined: 85,
    volunteerCapacity: 100,
    status: 'ACTIVE',
    verifiedEvidenceCount: 215,
    impactSummary: 'Stabilizes soil embankment against erosion, captures 42 tonnes CO2/yr at maturity.'
  },
  {
    id: 'CMP-2026-03',
    title: 'East Delhi Rainwater Retention & Micro-Drainage Clearing',
    category: 'WATER_CONSERVATION',
    locationName: 'Shahdara & Geeta Colony Outfalls',
    targetCount: 12,
    currentCount: 9,
    unit: 'drainage outfalls cleared',
    organizer: 'Municipal Corporation of Delhi + Community Ward Committee',
    startDate: '2026-07-01',
    endDate: '2026-10-31',
    volunteersJoined: 34,
    volunteerCapacity: 40,
    status: 'ACTIVE',
    verifiedEvidenceCount: 68,
    impactSummary: 'Prevents 85% of monsoon street waterlogging across 4 square kilometers.'
  }
];

export interface VerifiedImpactMetric {
  id: string;
  metricName: string;
  category: 'RELIEF' | 'COOLING' | 'REFORESTATION' | 'COMMUNITY';
  value: number;
  unit: string;
  changePct: number;
  period: string;
  verifiedCount: number;
  pendingAuditCount: number;
  proofDocumentUrl?: string;
}

export const VERIFIED_IMPACT_METRICS: VerifiedImpactMetric[] = [
  {
    id: 'IMP-01',
    metricName: 'Vulnerable People Shielded from Extreme Heat',
    category: 'COOLING',
    value: 3820,
    unit: 'residents assisted',
    changePct: 24.5,
    period: 'Last 30 Days',
    verifiedCount: 3680,
    pendingAuditCount: 140
  },
  {
    id: 'IMP-02',
    metricName: 'Safe Drinking Water Distributed',
    category: 'RELIEF',
    value: 84500,
    unit: 'liters delivered',
    changePct: 38.2,
    period: 'Last 30 Days',
    verifiedCount: 82000,
    pendingAuditCount: 2500
  },
  {
    id: 'IMP-03',
    metricName: 'Native Trees Planted & Geo-Tagged',
    category: 'REFORESTATION',
    value: 3820,
    unit: 'trees monitored',
    changePct: 15.8,
    period: 'Year to Date',
    verifiedCount: 3750,
    pendingAuditCount: 70
  },
  {
    id: 'IMP-04',
    metricName: 'Verified Volunteer Hours Logged',
    category: 'COMMUNITY',
    value: 1342,
    unit: 'service hours',
    changePct: 41.0,
    period: 'Last 30 Days',
    verifiedCount: 1300,
    pendingAuditCount: 42
  },
  {
    id: 'IMP-05',
    metricName: 'High-Albedo Cool Roofs Commissioned',
    category: 'COOLING',
    value: 1680,
    unit: 'households protected',
    changePct: 32.4,
    period: 'Last 60 Days',
    verifiedCount: 1650,
    pendingAuditCount: 30
  }
];

// ─────────────────────────────────────────────────────────────
// Candidate Intervention Sites (Renderable on 3D Map)
// ─────────────────────────────────────────────────────────────

export interface CandidateInterventionSite {
  id: string;
  neighborhoodId: string;
  name: string;
  type: 'COOL_ROOFS' | 'WATER_KIOSKS' | 'FLOOD_DRAINAGE' | 'TREE_CANOPY' | 'RAINWATER_HARVESTING';
  coordinates: [number, number];
  description: string;
  estimatedCostINR: number;
  capacityOrUnits: string;
  projectedBenefit: string;
  status: 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS';
}

export const CANDIDATE_INTERVENTION_SITES: CandidateInterventionSite[] = [
  // Yamuna Floodplain (ZONE-DL-001)
  {
    id: 'SITE-YMN-01',
    neighborhoodId: 'ZONE-DL-001',
    name: 'Pushta Road Elevated Cool-Roof Cluster',
    type: 'COOL_ROOFS',
    coordinates: [77.2195, 28.6180],
    description: 'High-albedo solar reflective coating on 140 informal tin-sheet shelters.',
    estimatedCostINR: 480000,
    capacityOrUnits: '140 households',
    projectedBenefit: '-3.8°C indoor peak thermal reduction',
    status: 'PROPOSED'
  },
  {
    id: 'SITE-YMN-02',
    neighborhoodId: 'ZONE-DL-001',
    name: 'Yamuna Bund Solar Water ATM & Respite Hub',
    type: 'WATER_KIOSKS',
    coordinates: [77.2202, 28.6170],
    description: 'Solar-powered 5,000L/day chilled water dispensing ATM with misting canopy.',
    estimatedCostINR: 650000,
    capacityOrUnits: '5,000 L/day capacity',
    projectedBenefit: 'Hydration for 3,200 daily informal workers',
    status: 'APPROVED'
  },
  {
    id: 'SITE-YMN-03',
    neighborhoodId: 'ZONE-DL-001',
    name: 'Riparian Silt Retention Bioswale A',
    type: 'FLOOD_DRAINAGE',
    coordinates: [77.2189, 28.6172],
    description: 'Permeable riprap bioswale & retention ditch to buffer rising river surge.',
    estimatedCostINR: 920000,
    capacityOrUnits: '450m drainage corridor',
    projectedBenefit: 'Prevents waterlogging up to 206.0m Yamuna stage',
    status: 'PROPOSED'
  },
  {
    id: 'SITE-YMN-04',
    neighborhoodId: 'ZONE-DL-001',
    name: 'Yamuna Floodplain Native Bamboo & Neem Green Buffer',
    type: 'TREE_CANOPY',
    coordinates: [77.2200, 28.6183],
    description: 'Dense native riparian afforestation to arrest embankment soil erosion.',
    estimatedCostINR: 750000,
    capacityOrUnits: '1,200 native saplings',
    projectedBenefit: '+14% shade coverage, 18 tCO2/yr sequestration',
    status: 'PROPOSED'
  },
  {
    id: 'SITE-YMN-05',
    neighborhoodId: 'ZONE-DL-001',
    name: 'Flood Bund Rainwater Aquifer Injection Well',
    type: 'RAINWATER_HARVESTING',
    coordinates: [77.2192, 28.6166],
    description: 'Deep percolation borehole to recharge local unconfined aquifer during monsoon peak.',
    estimatedCostINR: 420000,
    capacityOrUnits: '1.2M Liters/season capture',
    projectedBenefit: 'Reduces surface pooling by 35% in transit block',
    status: 'PROPOSED'
  },

  // Seelampur (ZONE-DL-002)
  {
    id: 'SITE-SLM-01',
    neighborhoodId: 'ZONE-DL-002',
    name: 'Seelampur Textile Market Cool Roof Initiative',
    type: 'COOL_ROOFS',
    coordinates: [77.2758, 28.6655],
    description: 'Reflective SRI coating on 380 industrial tin warehouse roofs in alleyways.',
    estimatedCostINR: 1250000,
    capacityOrUnits: '380 rooftops (14,000 sqm)',
    projectedBenefit: '-5.2°C surface heat emission reduction',
    status: 'APPROVED'
  },
  {
    id: 'SITE-SLM-02',
    neighborhoodId: 'ZONE-DL-002',
    name: 'Chowk 4 Community Water ATM & Hydration Post',
    type: 'WATER_KIOSKS',
    coordinates: [77.2766, 28.6648],
    description: 'High-volume chilled electrolyte hydration kiosk with dual tap dispenser.',
    estimatedCostINR: 580000,
    capacityOrUnits: '6,500 L/day capacity',
    projectedBenefit: 'Immediate heatstroke triage & clean hydration',
    status: 'IN_PROGRESS'
  },
  {
    id: 'SITE-SLM-03',
    neighborhoodId: 'ZONE-DL-002',
    name: 'Seelampur Storm Drain Desiltation Channel',
    type: 'FLOOD_DRAINAGE',
    coordinates: [77.2748, 28.6660],
    description: 'Deep mechanized desilting & concrete grated cover installation.',
    estimatedCostINR: 880000,
    capacityOrUnits: '680m primary drain',
    projectedBenefit: 'Zero street flooding during 60mm/hr cloudburst',
    status: 'PROPOSED'
  },
  {
    id: 'SITE-SLM-04',
    neighborhoodId: 'ZONE-DL-002',
    name: 'School Perimeter Miyawaki Micro-Forest',
    type: 'TREE_CANOPY',
    coordinates: [77.2770, 28.6662],
    description: 'Multi-layer ultra-dense urban forest in primary school courtyard.',
    estimatedCostINR: 620000,
    capacityOrUnits: '850 native trees',
    projectedBenefit: '-3.1°C local ambient cooling within 100m radius',
    status: 'PROPOSED'
  },

  // Geeta Colony (ZONE-DL-003)
  {
    id: 'SITE-GTC-01',
    neighborhoodId: 'ZONE-DL-003',
    name: 'Geeta Colony Embankment Shade Corridor',
    type: 'TREE_CANOPY',
    coordinates: [77.2645, 28.6495],
    description: 'Shaded pedestrian boulevard with mature pilkhan and jamun trees.',
    estimatedCostINR: 710000,
    capacityOrUnits: '600 avenue trees',
    projectedBenefit: '+18% continuous walking shade coverage',
    status: 'APPROVED'
  },
  {
    id: 'SITE-GTC-02',
    neighborhoodId: 'ZONE-DL-003',
    name: 'Drain Outfall Backflow Prevention Sluice & Sump',
    type: 'FLOOD_DRAINAGE',
    coordinates: [77.2652, 28.6485],
    description: 'Automated flap-valve sluice gate preventing Yamuna backflow during high water stage.',
    estimatedCostINR: 1450000,
    capacityOrUnits: '2,500 m3/hr pumping capacity',
    projectedBenefit: 'Guards 18,000 residents from backflow sewage contamination',
    status: 'PROPOSED'
  },
  {
    id: 'SITE-GTC-03',
    neighborhoodId: 'ZONE-DL-003',
    name: 'Block 7 Community Rainwater Harvesting Well',
    type: 'RAINWATER_HARVESTING',
    coordinates: [77.2638, 28.6502],
    description: 'Interconnected modular filtration pits capturing runoff from 40 residential terraces.',
    estimatedCostINR: 520000,
    capacityOrUnits: '850,000 L/yr recharge',
    projectedBenefit: 'Reverses localized groundwater depletion',
    status: 'PROPOSED'
  }
];

// ─────────────────────────────────────────────────────────────
// Community Response Tasks (Workflow: OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED -> VERIFIED)
// ─────────────────────────────────────────────────────────────

export type TaskStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';

export interface CommunityTask {
  id: string;
  title: string;
  neighborhoodId: string;
  neighborhoodName: string;
  hazardType: 'URBAN_HEAT' | 'FLOOD_SURGE' | 'CANOPY_DEFICIT' | 'WATER_SCARCITY';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: TaskStatus;
  requiredSkills: string[];
  estimatedHours: number;
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  hoursLogged: number;
  evidenceNotes?: string;
  evidencePhotoUrl?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export const INITIAL_COMMUNITY_TASKS: CommunityTask[] = [
  {
    id: 'TASK-2026-001',
    title: 'Distribute 4,000L Chilled Electrolyte Water at Yamuna Pushta',
    neighborhoodId: 'ZONE-DL-001',
    neighborhoodName: 'Yamuna Riverfront Low-Lying Settlement',
    hazardType: 'URBAN_HEAT',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    requiredSkills: ['Water Distribution', 'Heatstroke First Aid'],
    estimatedHours: 4.0,
    assignedVolunteerId: 'VOL-TM-02',
    assignedVolunteerName: 'Shahdara Heat Respite Brigade (Dr. Priyanka Mehra)',
    hoursLogged: 2.5,
    evidenceNotes: 'Dispatched 2 mobile water bowsers to Pushta clusters 3 & 4. 1,200 individuals provided with ORS.',
    createdAt: '2026-10-17 07:30'
  },
  {
    id: 'TASK-2026-002',
    title: 'Deploy 500 Submersible Dewatering Sandbags at Culvert 8',
    neighborhoodId: 'ZONE-DL-004',
    neighborhoodName: 'Majnu Ka Tila Tibetan Colony & Flood Basin',
    hazardType: 'FLOOD_SURGE',
    priority: 'HIGH',
    status: 'OPEN',
    requiredSkills: ['Water Rescue', 'Sandbag Embankment'],
    estimatedHours: 5.0,
    hoursLogged: 0,
    createdAt: '2026-10-17 08:15'
  },
  {
    id: 'TASK-2026-003',
    title: 'Field Audit of 180 SRI High-Reflectance Coated Roofs',
    neighborhoodId: 'ZONE-DL-002',
    neighborhoodName: 'Seelampur High-Density Informal Sector',
    hazardType: 'URBAN_HEAT',
    priority: 'MEDIUM',
    status: 'VERIFIED',
    requiredSkills: ['Thermal Survey', 'Building Audit'],
    estimatedHours: 6.0,
    assignedVolunteerId: 'VOL-TM-01',
    assignedVolunteerName: 'Yamuna Flood Responders Alpha',
    hoursLogged: 6.0,
    evidenceNotes: 'Infrared pyrometer verified average surface temperature reduction of 5.8°C under 45°C ambient noon sun.',
    evidencePhotoUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400',
    verifiedBy: 'SEWA Field Quality Auditor R-14',
    verifiedAt: '2026-10-16 16:45',
    createdAt: '2026-10-16 08:00'
  },
  {
    id: 'TASK-2026-004',
    title: 'Hydration Clinic Triage & Elderly Vulnerability Check',
    neighborhoodId: 'ZONE-DL-003',
    neighborhoodName: 'Geeta Colony Transit & Marginal Colony',
    hazardType: 'URBAN_HEAT',
    priority: 'HIGH',
    status: 'ASSIGNED',
    requiredSkills: ['Emergency CPR', 'Door-to-Door Elderly Survey'],
    estimatedHours: 4.5,
    assignedVolunteerId: 'VOL-TM-02',
    assignedVolunteerName: 'Shahdara Heat Respite Brigade',
    hoursLogged: 0,
    evidenceNotes: 'Pre-deployment briefing completed. Field kits distributed.',
    createdAt: '2026-10-17 09:00'
  },
  {
    id: 'TASK-2026-005',
    title: 'Plant & Mulch 250 Native Neem Saplings in Shaded Alley',
    neighborhoodId: 'ZONE-DL-005',
    neighborhoodName: 'Kashmere Gate Inter-State Transit Lowlands',
    hazardType: 'CANOPY_DEFICIT',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    requiredSkills: ['Tree Planting', 'Drip Irrigation Setup'],
    estimatedHours: 5.5,
    assignedVolunteerId: 'VOL-TM-03',
    assignedVolunteerName: 'Green Canopy Youth Initiative',
    hoursLogged: 5.5,
    evidenceNotes: 'All 250 saplings staked with organic bamboo support and geotagged in registry.',
    evidencePhotoUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400',
    createdAt: '2026-10-15 10:00'
  }
];

// ─────────────────────────────────────────────────────────────
// NGO & Community Organization Coordination
// ─────────────────────────────────────────────────────────────

export interface NgoPartner {
  id: string;
  name: string;
  acronym: string;
  leadContact: string;
  phone: string;
  activeVolunteers: number;
  assignedWards: string[];
  specialization: string;
  standbyAssets: string[];
}

export const NGO_PARTNERS: NgoPartner[] = [
  {
    id: 'NGO-01',
    name: 'Indian Red Cross Society (Delhi Disaster Relief Branch)',
    acronym: 'IRCS',
    leadContact: 'Dr. V. K. Malhotra',
    phone: '+91-11-2371-6441',
    activeVolunteers: 140,
    assignedWards: ['Yamuna Floodplain (Ward 24)', 'Majnu Ka Tila (Ward 12)'],
    specialization: 'Emergency Medical Evacuation, Inflatable Boats & Water Purification',
    standbyAssets: ['4 Inflatable Zodiacs', '8 Water Filtration Units', '2 Mobile Medical Vans']
  },
  {
    id: 'NGO-02',
    name: 'Self-Employed Women’s Association (SEWA Bharat)',
    acronym: 'SEWA',
    leadContact: 'Rehana Begum',
    phone: '+91-11-4100-3344',
    activeVolunteers: 95,
    assignedWards: ['Seelampur (Ward 41)', 'Geeta Colony (Ward 57)'],
    specialization: 'Cool Roof Deployment, Heat Respite Kiosks & Women’s Safety',
    standbyAssets: ['120 Misting Backpacks', '3,000 ORS Packs', 'SRI Cool Roof Paint Stocks']
  },
  {
    id: 'NGO-03',
    name: 'Goonj Disaster Relief & Social Mobilization',
    acronym: 'GOONJ',
    leadContact: 'Anshu Gupta / Meenakshi Sharma',
    phone: '+91-11-2697-2351',
    activeVolunteers: 82,
    assignedWards: ['Kashmere Gate (Ward 18)', 'Central Secretariat (Ward 01)'],
    specialization: 'Essential Dry Rations, Potable Water Supply & Clothing Linens',
    standbyAssets: ['3 Heavy Distribution Trucks', '10,000 Emergency Relief Family Packs']
  },
  {
    id: 'NGO-04',
    name: 'Delhi Youth Corps for Climate Action',
    acronym: 'DYCA',
    leadContact: 'Kavita Sundaram',
    phone: '+91-98711-22334',
    activeVolunteers: 110,
    assignedWards: ['Yamuna Floodplain', 'Seelampur', 'Geeta Colony'],
    specialization: 'Urban Afforestation, Drain Desilting & Youth Mobilization',
    standbyAssets: ['15 Drip Irrigation Hitch Kits', '500 Planting Augers', 'Water Tankers']
  }
];

// ─────────────────────────────────────────────────────────────
// Location History Audit Trail
// ─────────────────────────────────────────────────────────────

export interface LocationHistoryEvent {
  id: string;
  neighborhoodId: string;
  date: string;
  eventType: 'HEATWAVE_PEAK' | 'FLOOD_INUNDATION' | 'RELIEF_OPERATION' | 'INTERVENTION_COMPLETED';
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'RESOLVED';
  summary: string;
  recordedMetric: string;
  leadAgency: string;
}

export const LOCATION_HISTORY_RECORDS: LocationHistoryEvent[] = [
  {
    id: 'EVT-01',
    neighborhoodId: 'ZONE-DL-001',
    date: '2024-05-29',
    eventType: 'HEATWAVE_PEAK',
    title: 'Historic North Delhi Thermal Spike',
    severity: 'CRITICAL',
    summary: 'Surface temperature spiked to 49.2°C at Mungeshpur automatic weather station. Widespread heat cramps and power brownouts recorded.',
    recordedMetric: '49.2°C Ambient / 52.4°C Apparent Heat Index',
    leadAgency: 'India Meteorological Department (IMD)'
  },
  {
    id: 'EVT-02',
    neighborhoodId: 'ZONE-DL-001',
    date: '2023-07-13',
    eventType: 'FLOOD_INUNDATION',
    title: 'Yamuna River Highest Flood Stage Inundation',
    severity: 'CRITICAL',
    summary: 'Yamuna water level breached all-time 45-year record reaching 208.66m (danger mark: 205.33m). Pushta road inundated by 2.2m of silt floodwaters.',
    recordedMetric: '208.66m Yamuna River Stage (3.33m above Danger Level)',
    leadAgency: 'Central Water Commission (CWC)'
  },
  {
    id: 'EVT-03',
    neighborhoodId: 'ZONE-DL-001',
    date: '2026-08-10',
    eventType: 'INTERVENTION_COMPLETED',
    title: 'Elevated Bund Sandbag Barrier & Solar Water Kiosk Inauguration',
    severity: 'RESOLVED',
    summary: 'Completed 600m reinforced revetment barrier and installed 5,000L/day solar water purification ATM.',
    recordedMetric: '100% Drinking Water Access Restored to 2,800 families',
    leadAgency: 'Delhi Jal Board & WOW Resilience Team'
  },
  {
    id: 'EVT-04',
    neighborhoodId: 'ZONE-DL-002',
    date: '2025-06-12',
    eventType: 'HEATWAVE_PEAK',
    title: 'Seelampur Extreme Micro-Heat Island Event',
    severity: 'CRITICAL',
    summary: 'High zinc-roof density caused indoor temperatures to remain above 41°C past midnight. Thermal infrared drone survey identified 14 hotspot alleys.',
    recordedMetric: 'Nighttime Thermal Retention: +6.4°C vs Delhi Airport baseline',
    leadAgency: 'Delhi Disaster Management Authority (DDMA)'
  },
  {
    id: 'EVT-05',
    neighborhoodId: 'ZONE-DL-002',
    date: '2026-09-20',
    eventType: 'INTERVENTION_COMPLETED',
    title: 'Phase 1 SRI High-Albedo Cool Roof Coating of 850 Rooftops',
    severity: 'RESOLVED',
    summary: 'Applied high solar-reflectance elastomeric coating on 850 informal tin households in Block B & C.',
    recordedMetric: 'Drop of 4.8°C in peak daytime room temperature verified',
    leadAgency: 'Mahila Housing Trust & SEWA'
  }
];

// ─────────────────────────────────────────────────────────────
// Community Response Plans
// ─────────────────────────────────────────────────────────────

export interface CommunityResponsePlan {
  id: string;
  planReference: string;
  neighborhoodId: string;
  neighborhoodName: string;
  primaryHazard: string;
  riskSeverity: string;
  objectives: string[];
  requiredSupplies: { item: string; quantity: number; unit: string }[];
  assignedUnits: string[];
  evacuationRouteSafe: boolean;
  evacuationRouteDetails: string;
  generatedAt: string;
  approvedBy: string;
  status: 'DRAFT' | 'APPROVED' | 'DISPATCHED' | 'STANDBY';
}

export const INITIAL_RESPONSE_PLANS: CommunityResponsePlan[] = [
  {
    id: 'CRP-001',
    planReference: 'CRP-DEL-2026-044',
    neighborhoodId: 'ZONE-DL-001',
    neighborhoodName: 'Yamuna Riverfront Low-Lying Settlement',
    primaryHazard: 'FLOOD_SURGE & SEVERE HEAT',
    riskSeverity: 'CRITICAL',
    objectives: [
      'Pre-position 2 inflatable rescue boats at Pushta Ramp 2 for immediate rapid water extraction',
      'Deploy 10,000 Liters chilled potable drinking water via mobile bowsers to elevated relief tents',
      'Establish 2 shaded medical triage stations with ORS rehydration and thermal thermometers',
      'Safeguard high-risk children and elderly residents to Civil Lines Government Shelter'
    ],
    requiredSupplies: [
      { item: 'Chilled Potable Water', quantity: 10000, unit: 'Liters' },
      { item: 'Oral Rehydration Salts (ORS)', quantity: 2000, unit: 'Packets' },
      { item: 'Inflatable Lifejackets', quantity: 80, unit: 'Vests' },
      { item: 'Mobile Misting Fans with Generators', quantity: 6, unit: 'Units' }
    ],
    assignedUnits: [
      'NDRF Auxiliary Taskforce (Inspector Rajesh Rawat)',
      'SEWA Community Health Volunteer Corps (Dr. Priyanka Mehra)',
      'Delhi Civil Defence Quick Response Unit 4'
    ],
    evacuationRouteSafe: true,
    evacuationRouteDetails: 'Primary Route: Pushta Road Northbound → Majnu Ka Tila Flyover (Clear & Dry at 206.5m stage). CAUTION: Ring Road low underpass flooded; divert via Boulevard Road.',
    generatedAt: '2026-10-17 06:45',
    approvedBy: 'Command Center Incident Commander',
    status: 'DISPATCHED'
  }
];

