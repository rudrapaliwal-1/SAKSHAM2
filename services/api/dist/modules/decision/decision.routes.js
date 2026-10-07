"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decisionRouter = void 0;
const express_1 = require("express");
const inMemoryStore_js_1 = require("../../db/inMemoryStore.js");
const priorityEngine_js_1 = require("./priorityEngine.js");
const matchingEngine_js_1 = require("./matchingEngine.js");
const allocationEngine_js_1 = require("./allocationEngine.js");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.decisionRouter = router;
// ── 1. Demand Priority Assessment Endpoints ─────────────────────────────────
// GET /api/decision/priority/:demandId
router.get('/priority/:demandId', (req, res) => {
    const { demandId } = req.params;
    const demand = inMemoryStore_js_1.inMemoryStore.getDemandById(demandId);
    if (!demand) {
        return res.status(404).json({ error: { message: `Demand request ${demandId} not found.` } });
    }
    const incident = demand.incidentId ? inMemoryStore_js_1.inMemoryStore.getIncidentById(demand.incidentId) : undefined;
    const evaluation = priorityEngine_js_1.DemandPriorityEngine.evaluate({ demand, incident });
    res.json({ data: evaluation });
});
// POST /api/decision/priority/evaluate
router.post('/priority/evaluate', (req, res) => {
    const demandSchema = zod_1.z.object({
        id: zod_1.z.string().default('DEM-CUSTOM'),
        incidentId: zod_1.z.string().optional(),
        zoneName: zod_1.z.string().default('Incident Site'),
        coordinates: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }).default({ lat: 28.6139, lng: 77.2090 }),
        itemNeeded: zod_1.z.string().min(1),
        category: zod_1.z.string().min(1),
        quantity: zod_1.z.number().positive(),
        unit: zod_1.z.string().min(1),
        priority: zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
        affectedCount: zod_1.z.number().int().nonnegative().default(100),
        status: zod_1.z.string().default('PENDING'),
        requestedAt: zod_1.z.string().optional(),
    });
    const parsed = demandSchema.parse(req.body);
    const incident = parsed.incidentId ? inMemoryStore_js_1.inMemoryStore.getIncidentById(parsed.incidentId) : undefined;
    const evaluation = priorityEngine_js_1.DemandPriorityEngine.evaluate({
        demand: parsed,
        incident,
    });
    res.json({ data: evaluation });
});
// ── 2. Resource-Demand Matching Endpoints ───────────────────────────────────
// GET /api/decision/matching/:demandId
router.get('/matching/:demandId', (req, res) => {
    const { demandId } = req.params;
    const demand = inMemoryStore_js_1.inMemoryStore.getDemandById(demandId);
    if (!demand) {
        return res.status(404).json({ error: { message: `Demand request ${demandId} not found.` } });
    }
    const resources = inMemoryStore_js_1.inMemoryStore.getResources();
    const result = matchingEngine_js_1.DecisionMatchingEngine.rankCandidates(demand, resources);
    res.json({
        data: {
            demandId: demand.id,
            demandItem: demand.itemNeeded,
            demandCategory: demand.category,
            demandQuantity: demand.quantity,
            demandUnit: demand.unit,
            priority: demand.priority,
            bestMatch: result.bestMatch,
            recommendations: result.recommendations,
            totalCandidatesEvaluated: resources.length,
        },
    });
});
// ── 3. Resource Allocation Decision Endpoints ───────────────────────────────
const allocationExecutionSchema = zod_1.z.object({
    demandId: zod_1.z.string().min(1, 'Demand ID is required'),
    resourceId: zod_1.z.string().min(1, 'Resource ID is required'),
    quantity: zod_1.z.number().positive('Quantity must be greater than 0'),
    vehicleId: zod_1.z.string().optional(),
    approvedBy: zod_1.z.string().optional(),
});
// POST /api/decision/validate-allocation
router.post('/validate-allocation', (req, res) => {
    const { demandId, resourceId, quantity } = allocationExecutionSchema.parse(req.body);
    const demand = inMemoryStore_js_1.inMemoryStore.getDemandById(demandId);
    const resource = inMemoryStore_js_1.inMemoryStore.getResourceById(resourceId);
    if (!demand)
        return res.status(404).json({ error: { message: `Demand request ${demandId} not found.` } });
    if (!resource)
        return res.status(404).json({ error: { message: `Resource ${resourceId} not found.` } });
    const validation = allocationEngine_js_1.ResourceAllocationEngine.validate(demand, resource, quantity);
    res.json({ data: validation });
});
// POST /api/decision/allocate
router.post('/allocate', (req, res) => {
    const body = allocationExecutionSchema.parse(req.body);
    const result = allocationEngine_js_1.ResourceAllocationEngine.executeAllocation(body);
    if (!result.success) {
        return res.status(400).json({
            error: {
                code: 'ALLOCATION_REJECTED',
                message: result.error || 'Allocation could not be completed.',
            },
        });
    }
    res.status(201).json({
        data: {
            plan: result.plan,
            allocation: result.allocation,
        },
        message: 'Resource allocated successfully.',
    });
});
