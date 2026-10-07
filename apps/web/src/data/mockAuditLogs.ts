export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  result: string;
  type: 'VERIFY' | 'PRIORITIZE' | 'MATCH' | 'DISPATCH' | 'DELIVERY' | 'RESOLVE' | 'SYSTEM';
}

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'LOG-011',
    timestamp: '2026-10-07T13:45:00.000Z',
    actor: 'Duty Commander S. Prasad',
    action: 'REQUEST_RESOLVED',
    target: 'DEM-2026-104 (Inflatable Rescue Boats)',
    result: 'Lifecycle Closed · 4/4 Boats Handed Over · Receiver Confirmed (POD-2026-081)',
    type: 'RESOLVE'
  },
  {
    id: 'LOG-010',
    timestamp: '2026-10-07T13:42:00.000Z',
    actor: 'Havildar Rajesh Kumar (Field Unit)',
    action: 'DELIVERY_COMPLETED',
    target: 'DEL-2026-081 (Yamuna Khadar Lowlands)',
    result: 'Delivered 4 Units · Physical Verification Signed by Camp Officer R. K. Meena',
    type: 'DELIVERY'
  },
  {
    id: 'LOG-009',
    timestamp: '2026-10-07T13:28:00.000Z',
    actor: 'GIS Engine / Autonomous Router',
    action: 'ROUTE_UPDATED',
    target: 'DSP-DEL-041 (VEH-TRK-101)',
    result: 'Rerouted via Inner Ring Road (+18 min ETA) due to Punjabi Bagh Underpass Inundation',
    type: 'DISPATCH'
  },
  {
    id: 'LOG-008',
    timestamp: '2026-10-07T13:20:00.000Z',
    actor: 'Driver Satinder Pal (VEH-TRK-101)',
    action: 'MISSION_STARTED',
    target: 'DSP-DEL-041 (AIIMS Stockpile -> Yamuna Khadar)',
    result: 'Convoy Departed · Telemetry Active (Speed: 42 km/h, Fuel: 92%)',
    type: 'DISPATCH'
  },
  {
    id: 'LOG-007',
    timestamp: '2026-10-07T13:15:00.000Z',
    actor: 'Logistics Coord. Vikram Seth',
    action: 'MISSION_CREATED',
    target: 'DSP-DEL-041 (Manifest: 80 Trauma Kits)',
    result: 'Assigned Vehicle VEH-TRK-101 · Route Planned via Elevated Corridor (12.4 km)',
    type: 'DISPATCH'
  },
  {
    id: 'LOG-006',
    timestamp: '2026-10-07T13:10:00.000Z',
    actor: 'Incident Commander Rajesh Sharma',
    action: 'RESPONDER_ASSIGNED',
    target: 'RSP-DEL-001 (NDRF 8th Bn Rescue Unit Alpha)',
    result: 'Attached to Incident INC-2026-101 (Kashmiri Gate Flood Relief Sector)',
    type: 'DISPATCH'
  },
  {
    id: 'LOG-005',
    timestamp: '2026-10-07T13:05:00.000Z',
    actor: 'Stock Controller Ananya Roy',
    action: 'RESOURCE_ALLOCATED',
    target: 'RES-NCR-002 (AIIMS Trauma Centre)',
    result: 'Reserved 80 Trauma Kits for DEM-2026-102 · Depleted Stock: 85 -> 5 Kits Remaining',
    type: 'MATCH'
  },
  {
    id: 'LOG-004',
    timestamp: '2026-10-07T13:00:00.000Z',
    actor: 'SAKSHAM Matching Engine (OR-Tools)',
    action: 'RESOURCE_RECOMMENDED',
    target: 'DEM-2026-102 (Trauma Kits, 85 requested)',
    result: 'Rank 1 Match: RES-NCR-002 (Score 94.2/100, Dist: 4.8 km, Stock: 85 Kits, ETA: 12 min)',
    type: 'MATCH'
  },
  {
    id: 'LOG-003',
    timestamp: '2026-10-07T12:50:00.000Z',
    actor: 'Senior Response Commander A. K. Verma',
    action: 'PRIORITY_CHANGED',
    target: 'DEM-2026-101 (Kashmiri Gate Water Supply)',
    result: 'Priority Escalated: HIGH -> CRITICAL (Score 96.4/100 · 1,200 Displaced)',
    type: 'PRIORITIZE'
  },
  {
    id: 'LOG-002',
    timestamp: '2026-10-07T12:45:00.000Z',
    actor: 'Duty Officer Meenakshi Rao',
    action: 'REQUEST_VERIFIED',
    target: 'DEM-2026-101 (Drinking Water Shortage)',
    result: 'Field Telemetry & Distress Call Verified · Authenticated by Local Ward Officer',
    type: 'VERIFY'
  },
  {
    id: 'LOG-001',
    timestamp: '2026-10-07T12:30:00.000Z',
    actor: 'Civilian Field SOS / Automated Intake',
    action: 'REQUEST_CREATED',
    target: 'DEM-2026-101 (500 Pouch Units Drinking Water)',
    result: 'Ingested via Emergency Civilian SOS Portal · Geocoded to 28.6672° N, 77.2285° E',
    type: 'SYSTEM'
  }
];
