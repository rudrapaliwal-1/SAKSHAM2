import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { DemandPriorityEngine } from '../modules/decision/priorityEngine.js';
import { DecisionMatchingEngine } from '../modules/decision/matchingEngine.js';
import { ResourceAllocationEngine } from '../modules/decision/allocationEngine.js';
import { DemandRequest, Resource, Incident } from '../types/contracts.js';

describe('SAKSHAM Transparent Decision-Support Engine', () => {
  beforeEach(() => {
    inMemoryStore.reset();
  });

  /* ──────────────────────────────────────────────────────────────────────────
     1. DEMAND PRIORITY ASSESSMENT ENGINE TESTS
     ────────────────────────────────────────────────────────────────────────── */
  describe('Demand Priority Assessment', () => {
    it('evaluates critical medical demand in flooded area with latency to CRITICAL priority', () => {
      const pastTime = new Date(Date.now() - 120 * 60000).toISOString(); // 2 hours ago
      const demand: DemandRequest = {
        id: 'DEM-TEST-001',
        incidentId: 'INC-2026-101',
        zoneName: 'Yamuna Floodplain Relief Cluster',
        coordinates: { lat: 28.6692, lng: 77.2315 },
        itemNeeded: 'Advanced Trauma Triage Kits',
        category: 'MEDICAL',
        quantity: 100,
        unit: 'Kits',
        priority: 'CRITICAL',
        affectedCount: 1500,
        status: 'PENDING',
        requestedAt: pastTime,
      };

      const incident: Incident = {
        id: 'INC-2026-101',
        type: 'FLOOD',
        severity: 'CRITICAL',
        location: 'Yamuna Riverbank & Kashmiri Gate Ghats',
        coordinates: { lat: 28.6692, lng: 77.2315 },
        time: pastTime,
        status: 'UNDER_RESPONSE',
        assignedTeam: 'NDRF Unit 8',
        description: 'Breach of Yamuna river embankment',
        reporterName: 'Officer Verma',
        reporterContact: '+91-98110-44210',
        peopleAffected: 2500,
      };

      const evaluation = DemandPriorityEngine.evaluate({ demand, incident });

      expect(evaluation.priorityScore).toBeGreaterThanOrEqual(80);
      expect(evaluation.priorityLevel).toBe('CRITICAL');
      expect(evaluation.breakdown.incidentSeverityScore).toBe(25);
      expect(evaluation.breakdown.affectedPopulationScore).toBeGreaterThanOrEqual(20);
      expect(evaluation.breakdown.resourceCriticalityScore).toBe(20);
      expect(evaluation.breakdown.waitingTimeScore).toBeGreaterThanOrEqual(12);
      expect(evaluation.breakdown.vulnerabilityScore).toBe(15);
      expect(evaluation.reasoning.length).toBeGreaterThanOrEqual(5);
    });

    it('evaluates routine low-urgency demand to LOW priority with transparent breakdown', () => {
      const now = new Date().toISOString();
      const demand: DemandRequest = {
        id: 'DEM-TEST-002',
        zoneName: 'Central Admin Complex',
        coordinates: { lat: 28.6139, lng: 77.2090 },
        itemNeeded: 'Office Stationery & Log Sheets',
        category: 'OTHER',
        quantity: 20,
        unit: 'Packs',
        priority: 'LOW',
        affectedCount: 15,
        status: 'PENDING',
        requestedAt: now,
      };

      const evaluation = DemandPriorityEngine.evaluate({ demand });

      expect(evaluation.priorityScore).toBeLessThan(45);
      expect(evaluation.priorityLevel).toBe('LOW');
      expect(evaluation.breakdown.resourceCriticalityScore).toBeLessThanOrEqual(10);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     2. RESOURCE-DEMAND MATCHING ENGINE TESTS
     ────────────────────────────────────────────────────────────────────────── */
  describe('Resource-Demand Decision Matching', () => {
    const baseDemand: DemandRequest = {
      id: 'DEM-2026-102',
      incidentId: 'INC-2026-102',
      zoneName: 'Okhla Phase II Structural Collapse Site',
      coordinates: { lat: 28.5355, lng: 77.2732 },
      itemNeeded: 'Advanced Trauma Triage Kits',
      category: 'MEDICAL',
      quantity: 80,
      unit: 'Kits',
      priority: 'CRITICAL',
      affectedCount: 120,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };

    it('generates high score, transit ETA, and explainable sentence for optimal depot', () => {
      const resource: Resource = {
        id: 'RES-NCR-003',
        name: 'Advanced Trauma Triage Kits',
        category: 'MEDICAL',
        quantity: 140,
        unit: 'Kits',
        locationName: 'AIIMS Disaster Stockpile & Emergency Center',
        coordinates: { lat: 28.5672, lng: 77.2100 },
        status: 'AVAILABLE',
        lastUpdated: new Date().toISOString(),
        contactPerson: 'Dr. Vivek Bhattacharya',
        contactNumber: '+91-98100-99881',
      };

      const match = DecisionMatchingEngine.evaluateResourceMatch(baseDemand, resource);

      expect(match.matchScore).toBeGreaterThanOrEqual(85);
      expect(match.qualityLabel).toBe('EXCELLENT');
      expect(match.recommendedQuantity).toBe(80);
      expect(match.distanceKm).toBeGreaterThan(0);
      expect(match.estimatedDeliveryTime).toMatch(/~\d+ mins/);
      expect(match.reasoning).toContain('Recommended Resource RES-NCR-003 because it satisfies the requested medical category');
      expect(match.reasoning).toContain('sufficient stock');
      expect(match.reasoning).toContain('CRITICAL');
    });

    it('strictly assigns 0 score and INCOMPATIBLE label to mismatched resource category', () => {
      const foodResource: Resource = {
        id: 'RES-NCR-002',
        name: 'Emergency Dry Rations',
        category: 'FOOD',
        quantity: 5000,
        unit: 'Packets',
        locationName: 'FCI Storage Hub',
        coordinates: { lat: 28.5380, lng: 77.2710 },
        status: 'AVAILABLE',
        lastUpdated: new Date().toISOString(),
        contactPerson: 'Manager Gupta',
        contactNumber: '+91-98711-44332',
      };

      const match = DecisionMatchingEngine.evaluateResourceMatch(baseDemand, foodResource);

      expect(match.matchScore).toBe(0);
      expect(match.qualityLabel).toBe('INCOMPATIBLE');
      expect(match.breakdown.compatibility).toBe(0);
      expect(match.reasoning).toContain('is incompatible with requested MEDICAL demand');
    });

    it('assigns 0 score to DEPLETED or RESERVED resource', () => {
      const depletedResource: Resource = {
        id: 'RES-NCR-DEPLETED',
        name: 'Advanced Trauma Triage Kits',
        category: 'MEDICAL',
        quantity: 0,
        unit: 'Kits',
        locationName: 'Sub-Station Depot',
        coordinates: { lat: 28.5355, lng: 77.2732 },
        status: 'DEPLETED',
        lastUpdated: new Date().toISOString(),
        contactPerson: 'Officer',
        contactNumber: '+91-98711-00000',
      };

      const match = DecisionMatchingEngine.evaluateResourceMatch(baseDemand, depletedResource);

      expect(match.matchScore).toBe(0);
      expect(match.breakdown.availability).toBe(0);
      expect(match.qualityLabel).toBe('POOR');
    });

    it('ranks multiple candidate resources and selects best match based on score & proximity', () => {
      const candidateA: Resource = {
        id: 'RES-A',
        name: 'Trauma Kits A',
        category: 'MEDICAL',
        quantity: 100,
        unit: 'Kits',
        locationName: 'Near Depot (5 km)',
        coordinates: { lat: 28.5400, lng: 77.2700 }, // ~0.6 km
        status: 'AVAILABLE',
        lastUpdated: new Date().toISOString(),
        contactPerson: 'P1',
        contactNumber: '+91-98000-11111',
      };

      const candidateB: Resource = {
        id: 'RES-B',
        name: 'Trauma Kits B',
        category: 'MEDICAL',
        quantity: 100,
        unit: 'Kits',
        locationName: 'Far Depot (35 km)',
        coordinates: { lat: 28.8000, lng: 77.1000 }, // ~35 km
        status: 'AVAILABLE',
        lastUpdated: new Date().toISOString(),
        contactPerson: 'P2',
        contactNumber: '+91-98000-22222',
      };

      const ranking = DecisionMatchingEngine.rankCandidates(baseDemand, [candidateB, candidateA]);

      expect(ranking.bestMatch).toBeDefined();
      expect(ranking.bestMatch?.recommendedResource.id).toBe('RES-A');
      expect(ranking.bestMatch?.matchScore).toBeGreaterThan(ranking.recommendations[1].matchScore);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3. RESOURCE ALLOCATION SAFETY & EXECUTION TESTS
     ────────────────────────────────────────────────────────────────────────── */
  describe('Resource Allocation Safety & Invariants', () => {
    it('prevents over-allocation when requested quantity exceeds available stock', () => {
      const demand = inMemoryStore.getDemandById('DEM-2026-102')!;
      const resource = inMemoryStore.getResourceById('RES-NCR-003')!;

      // Resource RES-NCR-003 has 140 total, attempt to allocate 500
      const validation = ResourceAllocationEngine.validate(demand, resource, 500);

      expect(validation.isValid).toBe(false);
      expect(validation.errorCode).toBe('OVER_ALLOCATION');
      expect(validation.errorMessage).toContain('Over-allocation blocked');

      const execResult = ResourceAllocationEngine.executeAllocation({
        demandId: demand.id,
        resourceId: resource.id,
        quantity: 500,
      });

      expect(execResult.success).toBe(false);
      expect(execResult.error).toContain('Over-allocation blocked');
    });

    it('prevents negative inventory or non-positive quantity allocation', () => {
      const demand = inMemoryStore.getDemandById('DEM-2026-102')!;
      const resource = inMemoryStore.getResourceById('RES-NCR-003')!;

      const validationZero = ResourceAllocationEngine.validate(demand, resource, 0);
      expect(validationZero.isValid).toBe(false);
      expect(validationZero.errorCode).toBe('INVALID_QUANTITY');

      const validationNeg = ResourceAllocationEngine.validate(demand, resource, -50);
      expect(validationNeg.isValid).toBe(false);
      expect(validationNeg.errorCode).toBe('INVALID_QUANTITY');
    });

    it('prevents allocating from depleted or unavailable resource', () => {
      const demand = inMemoryStore.getDemandById('DEM-2026-102')!;
      const depletedRes: Resource = {
        id: 'RES-EMPTY',
        name: 'Empty Depot',
        category: 'MEDICAL',
        quantity: 0,
        unit: 'Kits',
        locationName: 'Depot Zero',
        coordinates: { lat: 28.5355, lng: 77.2732 },
        status: 'DEPLETED',
        lastUpdated: new Date().toISOString(),
        contactPerson: 'C',
        contactNumber: '+91-98000-00000',
      };

      const validation = ResourceAllocationEngine.validate(demand, depletedRes, 10);
      expect(validation.isValid).toBe(false);
      expect(validation.errorCode).toBe('RESOURCE_UNAVAILABLE');
    });

    it('prevents allocation of incompatible resource category', () => {
      const demand = inMemoryStore.getDemandById('DEM-2026-102')!; // Medical demand
      const foodRes = inMemoryStore.getResourceById('RES-NCR-002')!; // Food resource

      const validation = ResourceAllocationEngine.validate(demand, foodRes, 50);
      expect(validation.isValid).toBe(false);
      expect(validation.errorCode).toBe('INCOMPATIBLE_RESOURCE');
    });

    it('successfully executes safe allocation and updates remaining stock deterministically', () => {
      const demand = inMemoryStore.getDemandById('DEM-2026-102')!;
      const resource = inMemoryStore.getResourceById('RES-NCR-003')!;
      const initialStock = resource.quantity;

      const result = ResourceAllocationEngine.executeAllocation({
        demandId: demand.id,
        resourceId: resource.id,
        quantity: 80,
        vehicleId: 'VEH-AMB-204',
        approvedBy: 'Dr. Vivek Bhattacharya',
      });

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan?.allocatedQuantity).toBe(80);
      expect(result.plan?.remainingDepotStock).toBe(initialStock - 80);
      expect(result.plan?.reasoning).toContain('Allocated 80 Kits');

      // Check demand transitioned to ALLOCATED
      const updatedDem = inMemoryStore.getDemandById(demand.id);
      expect(updatedDem?.status).toBe('ALLOCATED');

      // Check remaining stock on resource record
      const updatedRes = inMemoryStore.getResourceById(resource.id);
      expect(updatedRes?.quantity).toBe(initialStock - 80);
    });
  });
});
