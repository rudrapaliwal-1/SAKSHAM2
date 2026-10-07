"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const inMemoryStore_js_1 = require("../db/inMemoryStore.js");
const priorityEngine_js_1 = require("../modules/decision/priorityEngine.js");
const matchingEngine_js_1 = require("../modules/decision/matchingEngine.js");
const allocationEngine_js_1 = require("../modules/decision/allocationEngine.js");
(0, vitest_1.describe)('SAKSHAM Transparent Decision-Support Engine', () => {
    (0, vitest_1.beforeEach)(() => {
        inMemoryStore_js_1.inMemoryStore.reset();
    });
    /* ──────────────────────────────────────────────────────────────────────────
       1. DEMAND PRIORITY ASSESSMENT ENGINE TESTS
       ────────────────────────────────────────────────────────────────────────── */
    (0, vitest_1.describe)('Demand Priority Assessment', () => {
        (0, vitest_1.it)('evaluates critical medical demand in flooded area with latency to CRITICAL priority', () => {
            const pastTime = new Date(Date.now() - 120 * 60000).toISOString(); // 2 hours ago
            const demand = {
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
            const incident = {
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
            const evaluation = priorityEngine_js_1.DemandPriorityEngine.evaluate({ demand, incident });
            (0, vitest_1.expect)(evaluation.priorityScore).toBeGreaterThanOrEqual(80);
            (0, vitest_1.expect)(evaluation.priorityLevel).toBe('CRITICAL');
            (0, vitest_1.expect)(evaluation.breakdown.incidentSeverityScore).toBe(25);
            (0, vitest_1.expect)(evaluation.breakdown.affectedPopulationScore).toBeGreaterThanOrEqual(20);
            (0, vitest_1.expect)(evaluation.breakdown.resourceCriticalityScore).toBe(20);
            (0, vitest_1.expect)(evaluation.breakdown.waitingTimeScore).toBeGreaterThanOrEqual(12);
            (0, vitest_1.expect)(evaluation.breakdown.vulnerabilityScore).toBe(15);
            (0, vitest_1.expect)(evaluation.reasoning.length).toBeGreaterThanOrEqual(5);
        });
        (0, vitest_1.it)('evaluates routine low-urgency demand to LOW priority with transparent breakdown', () => {
            const now = new Date().toISOString();
            const demand = {
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
            const evaluation = priorityEngine_js_1.DemandPriorityEngine.evaluate({ demand });
            (0, vitest_1.expect)(evaluation.priorityScore).toBeLessThan(45);
            (0, vitest_1.expect)(evaluation.priorityLevel).toBe('LOW');
            (0, vitest_1.expect)(evaluation.breakdown.resourceCriticalityScore).toBeLessThanOrEqual(10);
        });
    });
    /* ──────────────────────────────────────────────────────────────────────────
       2. RESOURCE-DEMAND MATCHING ENGINE TESTS
       ────────────────────────────────────────────────────────────────────────── */
    (0, vitest_1.describe)('Resource-Demand Decision Matching', () => {
        const baseDemand = {
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
        (0, vitest_1.it)('generates high score, transit ETA, and explainable sentence for optimal depot', () => {
            const resource = {
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
            const match = matchingEngine_js_1.DecisionMatchingEngine.evaluateResourceMatch(baseDemand, resource);
            (0, vitest_1.expect)(match.matchScore).toBeGreaterThanOrEqual(85);
            (0, vitest_1.expect)(match.qualityLabel).toBe('EXCELLENT');
            (0, vitest_1.expect)(match.recommendedQuantity).toBe(80);
            (0, vitest_1.expect)(match.distanceKm).toBeGreaterThan(0);
            (0, vitest_1.expect)(match.estimatedDeliveryTime).toMatch(/~\d+ mins/);
            (0, vitest_1.expect)(match.reasoning).toContain('Recommended Resource RES-NCR-003 because it satisfies the requested medical category');
            (0, vitest_1.expect)(match.reasoning).toContain('sufficient stock');
            (0, vitest_1.expect)(match.reasoning).toContain('CRITICAL');
        });
        (0, vitest_1.it)('strictly assigns 0 score and INCOMPATIBLE label to mismatched resource category', () => {
            const foodResource = {
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
            const match = matchingEngine_js_1.DecisionMatchingEngine.evaluateResourceMatch(baseDemand, foodResource);
            (0, vitest_1.expect)(match.matchScore).toBe(0);
            (0, vitest_1.expect)(match.qualityLabel).toBe('INCOMPATIBLE');
            (0, vitest_1.expect)(match.breakdown.compatibility).toBe(0);
            (0, vitest_1.expect)(match.reasoning).toContain('is incompatible with requested MEDICAL demand');
        });
        (0, vitest_1.it)('assigns 0 score to DEPLETED or RESERVED resource', () => {
            const depletedResource = {
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
            const match = matchingEngine_js_1.DecisionMatchingEngine.evaluateResourceMatch(baseDemand, depletedResource);
            (0, vitest_1.expect)(match.matchScore).toBe(0);
            (0, vitest_1.expect)(match.breakdown.availability).toBe(0);
            (0, vitest_1.expect)(match.qualityLabel).toBe('POOR');
        });
        (0, vitest_1.it)('ranks multiple candidate resources and selects best match based on score & proximity', () => {
            const candidateA = {
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
            const candidateB = {
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
            const ranking = matchingEngine_js_1.DecisionMatchingEngine.rankCandidates(baseDemand, [candidateB, candidateA]);
            (0, vitest_1.expect)(ranking.bestMatch).toBeDefined();
            (0, vitest_1.expect)(ranking.bestMatch?.recommendedResource.id).toBe('RES-A');
            (0, vitest_1.expect)(ranking.bestMatch?.matchScore).toBeGreaterThan(ranking.recommendations[1].matchScore);
        });
    });
    /* ──────────────────────────────────────────────────────────────────────────
       3. RESOURCE ALLOCATION SAFETY & EXECUTION TESTS
       ────────────────────────────────────────────────────────────────────────── */
    (0, vitest_1.describe)('Resource Allocation Safety & Invariants', () => {
        (0, vitest_1.it)('prevents over-allocation when requested quantity exceeds available stock', () => {
            const demand = inMemoryStore_js_1.inMemoryStore.getDemandById('DEM-2026-102');
            const resource = inMemoryStore_js_1.inMemoryStore.getResourceById('RES-NCR-003');
            // Resource RES-NCR-003 has 140 total, attempt to allocate 500
            const validation = allocationEngine_js_1.ResourceAllocationEngine.validate(demand, resource, 500);
            (0, vitest_1.expect)(validation.isValid).toBe(false);
            (0, vitest_1.expect)(validation.errorCode).toBe('OVER_ALLOCATION');
            (0, vitest_1.expect)(validation.errorMessage).toContain('Over-allocation blocked');
            const execResult = allocationEngine_js_1.ResourceAllocationEngine.executeAllocation({
                demandId: demand.id,
                resourceId: resource.id,
                quantity: 500,
            });
            (0, vitest_1.expect)(execResult.success).toBe(false);
            (0, vitest_1.expect)(execResult.error).toContain('Over-allocation blocked');
        });
        (0, vitest_1.it)('prevents negative inventory or non-positive quantity allocation', () => {
            const demand = inMemoryStore_js_1.inMemoryStore.getDemandById('DEM-2026-102');
            const resource = inMemoryStore_js_1.inMemoryStore.getResourceById('RES-NCR-003');
            const validationZero = allocationEngine_js_1.ResourceAllocationEngine.validate(demand, resource, 0);
            (0, vitest_1.expect)(validationZero.isValid).toBe(false);
            (0, vitest_1.expect)(validationZero.errorCode).toBe('INVALID_QUANTITY');
            const validationNeg = allocationEngine_js_1.ResourceAllocationEngine.validate(demand, resource, -50);
            (0, vitest_1.expect)(validationNeg.isValid).toBe(false);
            (0, vitest_1.expect)(validationNeg.errorCode).toBe('INVALID_QUANTITY');
        });
        (0, vitest_1.it)('prevents allocating from depleted or unavailable resource', () => {
            const demand = inMemoryStore_js_1.inMemoryStore.getDemandById('DEM-2026-102');
            const depletedRes = {
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
            const validation = allocationEngine_js_1.ResourceAllocationEngine.validate(demand, depletedRes, 10);
            (0, vitest_1.expect)(validation.isValid).toBe(false);
            (0, vitest_1.expect)(validation.errorCode).toBe('RESOURCE_UNAVAILABLE');
        });
        (0, vitest_1.it)('prevents allocation of incompatible resource category', () => {
            const demand = inMemoryStore_js_1.inMemoryStore.getDemandById('DEM-2026-102'); // Medical demand
            const foodRes = inMemoryStore_js_1.inMemoryStore.getResourceById('RES-NCR-002'); // Food resource
            const validation = allocationEngine_js_1.ResourceAllocationEngine.validate(demand, foodRes, 50);
            (0, vitest_1.expect)(validation.isValid).toBe(false);
            (0, vitest_1.expect)(validation.errorCode).toBe('INCOMPATIBLE_RESOURCE');
        });
        (0, vitest_1.it)('successfully executes safe allocation and updates remaining stock deterministically', () => {
            const demand = inMemoryStore_js_1.inMemoryStore.getDemandById('DEM-2026-102');
            const resource = inMemoryStore_js_1.inMemoryStore.getResourceById('RES-NCR-003');
            const initialStock = resource.quantity;
            const result = allocationEngine_js_1.ResourceAllocationEngine.executeAllocation({
                demandId: demand.id,
                resourceId: resource.id,
                quantity: 80,
                vehicleId: 'VEH-AMB-204',
                approvedBy: 'Dr. Vivek Bhattacharya',
            });
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.plan).toBeDefined();
            (0, vitest_1.expect)(result.plan?.allocatedQuantity).toBe(80);
            (0, vitest_1.expect)(result.plan?.remainingDepotStock).toBe(initialStock - 80);
            (0, vitest_1.expect)(result.plan?.reasoning).toContain('Allocated 80 Kits');
            // Check demand transitioned to ALLOCATED
            const updatedDem = inMemoryStore_js_1.inMemoryStore.getDemandById(demand.id);
            (0, vitest_1.expect)(updatedDem?.status).toBe('ALLOCATED');
            // Check remaining stock on resource record
            const updatedRes = inMemoryStore_js_1.inMemoryStore.getResourceById(resource.id);
            (0, vitest_1.expect)(updatedRes?.quantity).toBe(initialStock - 80);
        });
    });
});
