"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const inMemoryStore_js_1 = require("../db/inMemoryStore.js");
const matching_service_js_1 = require("../modules/matching/matching.service.js");
(0, vitest_1.describe)('SAKSHAM P0 End-to-End Operational Workflow & Domain Verification', () => {
    (0, vitest_1.beforeEach)(() => {
        inMemoryStore_js_1.inMemoryStore.reset();
    });
    (0, vitest_1.it)('1. should register a new Incident with validation and timeline logging', () => {
        const inc = inMemoryStore_js_1.inMemoryStore.createIncident({
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
        (0, vitest_1.expect)(inc.id).toMatch(/^INC-2026-\d+/);
        (0, vitest_1.expect)(inc.status).toBe('REPORTED');
        (0, vitest_1.expect)(inc.timeline?.length).toBeGreaterThan(0);
        const fetched = inMemoryStore_js_1.inMemoryStore.getIncidentById(inc.id);
        (0, vitest_1.expect)(fetched).toBeDefined();
        (0, vitest_1.expect)(fetched?.location).toBe('Yamuna River Ghat, North Delhi');
    });
    (0, vitest_1.it)('2. should verify and escalate priority of an Incident (Verification & Priority)', () => {
        const inc = inMemoryStore_js_1.inMemoryStore.createIncident({
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
        const verified = inMemoryStore_js_1.inMemoryStore.updateIncidentStatus(inc.id, 'VERIFIED');
        (0, vitest_1.expect)(verified?.status).toBe('VERIFIED');
        // Priority Escalation step
        const prioritized = inMemoryStore_js_1.inMemoryStore.updateIncidentPriority(inc.id, 'CRITICAL');
        (0, vitest_1.expect)(prioritized?.severity).toBe('CRITICAL');
        (0, vitest_1.expect)(prioritized?.status).toBe('PRIORITIZED');
    });
    (0, vitest_1.it)('3. should create DemandRequests tied to the incident', () => {
        const demand = inMemoryStore_js_1.inMemoryStore.createDemand({
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
        (0, vitest_1.expect)(demand.id).toMatch(/^DEM-2026-\d+/);
        (0, vitest_1.expect)(demand.status).toBe('PENDING');
        const list = inMemoryStore_js_1.inMemoryStore.getDemands({ status: 'PENDING' });
        (0, vitest_1.expect)(list.some(d => d.id === demand.id)).toBe(true);
    });
    (0, vitest_1.it)('4. should match and score resources for demand request (Matching Engine)', async () => {
        // Check matching recommendations calculation
        const recs = await matching_service_js_1.MatchingService.getRecommendations('DEM-2026-101');
        (0, vitest_1.expect)(recs).toBeDefined();
        (0, vitest_1.expect)(recs.demandId).toBe('DEM-2026-101');
        (0, vitest_1.expect)(recs.matches?.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(recs.matches?.[0].score).toBeGreaterThan(0);
        (0, vitest_1.expect)(recs.matches?.[0].breakdown).toBeDefined();
    });
    (0, vitest_1.it)('5. should execute Allocation, reserving resource stock and updating demand status', () => {
        const initialRes = inMemoryStore_js_1.inMemoryStore.getResourceById('RES-NCR-001');
        const initialQty = initialRes?.quantity || 0;
        const alloc = inMemoryStore_js_1.inMemoryStore.createAllocation({
            demandId: 'DEM-2026-101',
            resourceId: 'RES-NCR-001',
            quantity: 500,
            vehicleId: 'VEH-TRK-101',
        });
        (0, vitest_1.expect)(alloc.id).toMatch(/^ALLOC-2026-\d+/);
        (0, vitest_1.expect)(alloc.status).toBe('APPROVED');
        const updatedRes = inMemoryStore_js_1.inMemoryStore.getResourceById('RES-NCR-001');
        (0, vitest_1.expect)(updatedRes?.quantity).toBe(initialQty - 500);
        const updatedDem = inMemoryStore_js_1.inMemoryStore.getDemandById('DEM-2026-101');
        (0, vitest_1.expect)(updatedDem?.status).toBe('ALLOCATED');
    });
    (0, vitest_1.it)('6. should dispatch Mission, update Vehicle status, and calculate route path', () => {
        const mission = inMemoryStore_js_1.inMemoryStore.createMission({
            requestId: 'DEM-2026-101',
            vehicleId: 'VEH-TRK-101',
            operatorName: 'Havildar Rajesh Tanwar',
        });
        (0, vitest_1.expect)(mission.id).toMatch(/^DSP-DEL-\d+/);
        (0, vitest_1.expect)(mission.status).toBe('EN_ROUTE');
        const veh = inMemoryStore_js_1.inMemoryStore.getVehicleById('VEH-TRK-101');
        (0, vitest_1.expect)(veh?.status).toBe('EN_ROUTE');
        // Route calculation
        const route = inMemoryStore_js_1.inMemoryStore.calculateRoute({ lat: 28.5720, lng: 77.0680 }, { lat: 28.6692, lng: 77.2315 });
        (0, vitest_1.expect)(route.distanceKm).toBeGreaterThan(0);
        (0, vitest_1.expect)(route.estimatedMinutes).toBeGreaterThan(0);
        (0, vitest_1.expect)(route.waypoints.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('7. should reconcile delivery, mark Mission DELIVERED, Demand FULFILLED, and release Vehicle', () => {
        const mission = inMemoryStore_js_1.inMemoryStore.createMission({
            requestId: 'DEM-2026-103',
            vehicleId: 'VEH-AMB-204',
            operatorName: 'Dr. Neha Verma',
        });
        const reconciled = inMemoryStore_js_1.inMemoryStore.verifyDelivery(mission.id, 'Inspector R. Verma');
        (0, vitest_1.expect)(reconciled).toBeDefined();
        (0, vitest_1.expect)(reconciled?.mission.status).toBe('DELIVERED');
        const dem = inMemoryStore_js_1.inMemoryStore.getDemandById('DEM-2026-103');
        (0, vitest_1.expect)(dem?.status).toBe('FULFILLED');
        const veh = inMemoryStore_js_1.inMemoryStore.getVehicleById('VEH-AMB-204');
        (0, vitest_1.expect)(veh?.status).toBe('AVAILABLE');
    });
    (0, vitest_1.it)('8. should resolve Incident and log immutable AuditEvent ledger', () => {
        const resolved = inMemoryStore_js_1.inMemoryStore.updateIncidentStatus('INC-2026-101', 'RESOLVED');
        (0, vitest_1.expect)(resolved?.status).toBe('RESOLVED');
        const auditTrail = inMemoryStore_js_1.inMemoryStore.getAuditEvents();
        (0, vitest_1.expect)(auditTrail.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(auditTrail[0].id).toMatch(/^LOG-/);
    });
    (0, vitest_1.it)('9. should manage Responders, Shelters, and Alerts domain entities', () => {
        // Responder management
        const rsp = inMemoryStore_js_1.inMemoryStore.createResponder({
            name: 'Dr. Alok Verma',
            role: 'PARAMEDIC',
            agency: 'Delhi Triage Unit',
            contactRadio: 'TRIAGE-01',
            contactPhone: '+91-98711-00001',
            status: 'ON_DUTY',
        });
        (0, vitest_1.expect)(rsp.id).toMatch(/^RSP-/);
        // Shelter management
        const shl = inMemoryStore_js_1.inMemoryStore.createShelter({
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
        (0, vitest_1.expect)(shl.id).toMatch(/^SHL-DEL-/);
        const updatedShl = inMemoryStore_js_1.inMemoryStore.updateShelterOccupancy(shl.id, 500);
        (0, vitest_1.expect)(updatedShl?.status).toBe('FULL');
        // Alert management
        const alert = inMemoryStore_js_1.inMemoryStore.createAlert({
            title: 'SUPPLY LOW AT SECTOR 10',
            message: 'Potable water stock under 10%',
            severity: 'HIGH',
            category: 'RESOURCE',
        });
        (0, vitest_1.expect)(alert.id).toMatch(/^ALT-/);
        const resolvedAlert = inMemoryStore_js_1.inMemoryStore.resolveAlert(alert.id);
        (0, vitest_1.expect)(resolvedAlert?.resolved).toBe(true);
    });
});
