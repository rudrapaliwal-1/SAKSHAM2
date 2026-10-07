export interface ResponderItem {
  id: string;
  name: string;
  role: 'INCIDENT_COMMANDER' | 'LOGISTICS_OFFICER' | 'PARAMEDIC' | 'BOATMASTER' | 'PILOT' | 'FIELD_RESCUER';
  agency: string;
  contactRadio: string;
  contactPhone: string;
  status: 'ON_DUTY' | 'ON_MISSION' | 'STANDBY' | 'OFF_DUTY';
  assignedUnit?: string;
  assignedMissionId?: string;
  coordinates: { lat: number; lng: number };
  locationName: string;
}

export const mockResponders: ResponderItem[] = [
  {
    id: 'RSP-001',
    name: 'Havildar Rajesh Tanwar',
    role: 'LOGISTICS_OFFICER',
    agency: 'NDRF Battalion 8',
    contactRadio: 'NDRF-CH-4',
    contactPhone: '+91-98710-11223',
    status: 'ON_MISSION',
    assignedUnit: 'VEH-TRK-101',
    assignedMissionId: 'DSP-DEL-041',
    coordinates: { lat: 28.6500, lng: 77.1800 },
    locationName: 'Outer Ring Road Convoy'
  },
  {
    id: 'RSP-002',
    name: 'Dr. Neha Verma',
    role: 'PARAMEDIC',
    agency: 'Delhi Emergency Medical Services',
    contactRadio: 'EMS-ALPHA-1',
    contactPhone: '+91-98103-99882',
    status: 'ON_MISSION',
    assignedUnit: 'VEH-AMB-204',
    assignedMissionId: 'DSP-DEL-042',
    coordinates: { lat: 28.5672, lng: 77.2100 },
    locationName: 'AIIMS Safdarjung Ambulance Depot'
  },
  {
    id: 'RSP-003',
    name: 'Sgt. Rakesh Kumar',
    role: 'BOATMASTER',
    agency: 'NDRF Water Rescue Wing',
    contactRadio: 'NDRF-MARINE-2',
    contactPhone: '+91-98110-33441',
    status: 'ON_MISSION',
    assignedUnit: 'VEH-BOT-302',
    assignedMissionId: 'DSP-DEL-043',
    coordinates: { lat: 28.6580, lng: 77.2550 },
    locationName: 'Geeta Colony Ghat'
  },
  {
    id: 'RSP-004',
    name: 'Cmdt. R. K. Meena',
    role: 'INCIDENT_COMMANDER',
    agency: 'Central NDRF Command',
    contactRadio: 'NDRF-COMMAND-1',
    contactPhone: '+91-98101-55440',
    status: 'ON_DUTY',
    assignedUnit: 'HQ-COMMAND',
    coordinates: { lat: 28.5720, lng: 77.0680 },
    locationName: 'Dwarka Sector 8 HQ'
  },
  {
    id: 'RSP-005',
    name: 'Sanjay Mehta',
    role: 'PILOT',
    agency: 'Delhi Police Drone Recon Squad',
    contactRadio: 'DRONE-RECON-7',
    contactPhone: '+91-98991-22334',
    status: 'STANDBY',
    assignedUnit: 'VEH-DRN-401',
    coordinates: { lat: 28.6304, lng: 77.2177 },
    locationName: 'Connaught Place Recon Base'
  }
];
