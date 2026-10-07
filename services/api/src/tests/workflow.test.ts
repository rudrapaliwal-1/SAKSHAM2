import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { MatchingService } from '../modules/matching/matching.service.js';

describe('SAKSHAM P0 End-to-End Operational Workflow & Domain Verification', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  it('1. should register a new Incident with validation and timeline logging', () => {
    const inc = inMemoryStore.createIncident({
      type: 'FLOOD',
      severity: 'HIGH',
      location: 'Yamuna River Ghat, North Delhi',
      coordinates: { lat: 28.6692, lng: 77.2315 },
      status: 'REPORTED',
      assignedTeam: 'NDRF Unit 4',
      description: 'Severe embankment breach affecting riverbank slum cluster',
      reporterName: 'Inspector R. Verma',
      reporterContact: '+91-98110-44210',
      displacedCount: 450,
      peopleAffected: 1200,
    });

    expect(inc.id).toMatch(/^INC-2026-\d+/);
    expect(inc.status).toBe('REPORTED');
    expect(inc.timeline?.length).toBeGreaterThan(0);

    const fetched = inMemoryStore.getIncidentById(inc.id);
    expect(fetched).toBeDefined();
    expect(fetched?.location).toBe('Yamuna River Ghat, North Delhi');
  });

  it('2. should verify and escalate priority of an Incident (Verification & Priority)', () => {
    const inc = inMemoryStore.createIncident({
      type: 'STRUCTURAL_COLLAPSE',
      severity: 'MEDIUM',
      location: 'Okhla Phase 2',
      coordinates: { lat: 28.5355, lng: 77.2732 },
      status: 'REPORTED',
      assignedTeam: 'Unassigned',
      description: 'Building crack and partial roof fall',
      reporterName: 'S. Negi',
      reporterContact: '+91-98711-20988',
    });

    // Verification step
    const verified = inMemoryStore.updateIncidentStatus(inc.id, 'VERIFIED');
    expect(verified?.status).toBe('VERIFIED');

    // Priority Escalation step
    const prioritized = inMemoryStore.updateIncidentPriority(inc.id, 'CRITICAL');
    expect(prioritized?.severity).toBe('CRITICAL');
    expect(prioritized?.status).toBe('PRIORITIZED');
  });

  it('3. should create DemandRequests tied to the incident', () => {
    const demand = inMemoryStore.createDemand({
      incidentId: 'INC-2026-101',
      zoneName: 'Kashmiri Gate Relief Camp',
      coordinates: { lat: 28.6692, lng: 77.2315 },
      itemNeeded: 'Drinking Water (15L Cans)',
      category: 'WATER',
      quantity: 500,
      unit: 'Liters',
      priority: 'CRITICAL',
      affectedCount: 200,
      status: 'PENDING',
    });

    expect(demand.id).toMatch(/^DEM-2026-\d+/);
    expect(demand.status).toBe('PENDING');

    const list = inMemoryStore.getDemands({ status: 'PENDING' });
    expect(list.some(d => d.id === demand.id)).toBe(true);
  });

  it('4. should match and score resources for demand request (Matching Engine)', async () => {
    // Check matching recommendations calculation
    const recs = await MatchingService.getRecommendations('DEM-2026-101');
    expect(recs).toBeDefined();
    expect(recs.demandId).toBe('DEM-2026-101');
    expect(recs.matches?.length).toBeGreaterThan(0);
    expect(recs.matches?.[0].score).toBeGreaterThan(0);
    expect(recs.matches?.[0].breakdown).toBeDefined();
  });

  it('5. should execute Allocation, reserving resource stock and updating demand status', () => {
    const initialRes = inMemoryStore.getResourceById('RES-NCR-001');
    const initialQty = initialRes?.quantity || 0;

    const alloc = inMemoryStore.createAllocation({
      demandId: 'DEM-2026-101',
      resourceId: 'RES-NCR-001',
      quantity: 500,
      vehicleId: 'VEH-TRK-101',
    });

    expect(alloc.id).toMatch(/^ALLOC-2026-\d+/);
    expect(alloc.status).toBe('APPROVED');

    const updatedRes = inMemoryStore.getResourceById('RES-NCR-001');
    expect(updatedRes?.quantity).toBe(initialQty - 500);

    const updatedDem = inMemoryStore.getDemandById('DEM-2026-101');
    expect(updatedDem?.status).toBe('ALLOCATED');
  });

  it('6. should dispatch Mission, update Vehicle status, and calculate route path', () => {
    const mission = inMemoryStore.createMission({
      requestId: 'DEM-2026-101',
      vehicleId: 'VEH-TRK-101',
      operatorName: 'Havildar Rajesh Tanwar',
    });

    expect(mission.id).toMatch(/^DSP-DEL-\d+/);
    expect(mission.status).toBe('EN_ROUTE');

    const veh = inMemoryStore.getVehicleById('VEH-TRK-101');
    expect(veh?.status).toBe('EN_ROUTE');

    // Route calculation
    const route = inMemoryStore.calculateRoute(
      { lat: 28.5720, lng: 77.0680 },
      { lat: 28.6692, lng: 77.2315 }
    );
    expect(route.distanceKm).toBeGreaterThan(0);
    expect(route.estimatedMinutes).toBeGreaterThan(0);
    expect(route.waypoints.length).toBeGreaterThan(0);
  });

  it('7. should reconcile delivery, mark Mission DELIVERED, Demand FULFILLED, and release Vehicle', () => {
    const mission = inMemoryStore.createMission({
      requestId: 'DEM-2026-103',
      vehicleId: 'VEH-AMB-204',
      operatorName: 'Dr. Neha Verma',
    });

    const reconciled = inMemoryStore.verifyDelivery(mission.id, 'Inspector R. Verma');
    expect(reconciled).toBeDefined();
    expect(reconciled?.mission.status).toBe('DELIVERED');

    const dem = inMemoryStore.getDemandById('DEM-2026-103');
    expect(dem?.status).toBe('FULFILLED');

    const veh = inMemoryStore.getVehicleById('VEH-AMB-204');
    expect(veh?.status).toBe('AVAILABLE');
  });

  it('8. should resolve Incident and log immutable AuditEvent ledger', () => {
    const resolved = inMemoryStore.updateIncidentStatus('INC-2026-101', 'RESOLVED');
    expect(resolved?.status).toBe('RESOLVED');

    const auditTrail = inMemoryStore.getAuditEvents();
    expect(auditTrail.length).toBeGreaterThan(0);
    expect(auditTrail[0].id).toMatch(/^LOG-/);
  });

  it('9. should manage Responders, Shelters, and Alerts domain entities', () => {
    // Responder management
    const rsp = inMemoryStore.createResponder({
      name: 'Dr. Alok Verma',
      role: 'PARAMEDIC',
      agency: 'Delhi Triage Unit',
      contactRadio: 'TRIAGE-01',
      contactPhone: '+91-98711-00001',
      status: 'ON_DUTY',
    });
    expect(rsp.id).toMatch(/^RSP-/);

    // Shelter management
    const shl = inMemoryStore.createShelter({
      name: 'Rohini Sector 10 Relief Hub',
      locationName: 'Rohini Sports Ground',
      coordinates: { lat: 28.7100, lng: 77.1200 },
      capacityTotal: 500,
      capacityOccupied: 120,
      status: 'OPEN',
      contactPerson: 'Manager Rao',
      contactNumber: '+91-98110-12345',
      resourcesAvailable: ['Safe Water', 'Medical Triage'],
    });
    expect(shl.id).toMatch(/^SHL-DEL-/);

    const updatedShl = inMemoryStore.updateShelterOccupancy(shl.id, 500);
    expect(updatedShl?.status).toBe('FULL');

    // Alert management
    const alert = inMemoryStore.createAlert({
      title: 'SUPPLY LOW AT SECTOR 10',
      message: 'Potable water stock under 10%',
      severity: 'HIGH',
      category: 'RESOURCE',
    });
    expect(alert.id).toMatch(/^ALT-/);

    const resolvedAlert = inMemoryStore.resolveAlert(alert.id);
    expect(resolvedAlert?.resolved).toBe(true);
  });
});
