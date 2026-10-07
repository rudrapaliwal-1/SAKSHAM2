import { Router, Request, Response } from 'express';
import { inMemoryStore } from '../../db/inMemoryStore.js';
import { DemandPriorityEngine } from './priorityEngine.js';
import { DecisionMatchingEngine } from './matchingEngine.js';
import { ResourceAllocationEngine } from './allocationEngine.js';
import { z } from 'zod';

const router = Router();

// ── 1. Demand Priority Assessment Endpoints ─────────────────────────────────

// GET /api/decision/priority/:demandId
router.get('/priority/:demandId', (req: Request, res: Response) => {
  const { demandId } = req.params;
  const demand = inMemoryStore.getDemandById(demandId);
  if (!demand) {
    return res.status(404).json({ error: { message: `Demand request ${demandId} not found.` } });
  }

  const incident = demand.incidentId ? inMemoryStore.getIncidentById(demand.incidentId) : undefined;
  const evaluation = DemandPriorityEngine.evaluate({ demand, incident });

  res.json({ data: evaluation });
});

// POST /api/decision/priority/evaluate
router.post('/priority/evaluate', (req: Request, res: Response) => {
  const demandSchema = z.object({
    id: z.string().default('DEM-CUSTOM'),
    incidentId: z.string().optional(),
    zoneName: z.string().default('Incident Site'),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).default({ lat: 28.6139, lng: 77.2090 }),
    itemNeeded: z.string().min(1),
    category: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
    affectedCount: z.number().int().nonnegative().default(100),
    status: z.string().default('PENDING'),
    requestedAt: z.string().optional(),
  });

  const parsed = demandSchema.parse(req.body);
  const incident = parsed.incidentId ? inMemoryStore.getIncidentById(parsed.incidentId) : undefined;

  const evaluation = DemandPriorityEngine.evaluate({
    demand: parsed as any,
    incident,
  });

  res.json({ data: evaluation });
});

// ── 2. Resource-Demand Matching Endpoints ───────────────────────────────────

// GET /api/decision/matching/:demandId
router.get('/matching/:demandId', (req: Request, res: Response) => {
  const { demandId } = req.params;
  const demand = inMemoryStore.getDemandById(demandId);
  if (!demand) {
    return res.status(404).json({ error: { message: `Demand request ${demandId} not found.` } });
  }

  const resources = inMemoryStore.getResources();
  const result = DecisionMatchingEngine.rankCandidates(demand, resources);

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

const allocationExecutionSchema = z.object({
  demandId: z.string().min(1, 'Demand ID is required'),
  resourceId: z.string().min(1, 'Resource ID is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  vehicleId: z.string().optional(),
  approvedBy: z.string().optional(),
});

// POST /api/decision/validate-allocation
router.post('/validate-allocation', (req: Request, res: Response) => {
  const { demandId, resourceId, quantity } = allocationExecutionSchema.parse(req.body);
  const demand = inMemoryStore.getDemandById(demandId);
  const resource = inMemoryStore.getResourceById(resourceId);

  if (!demand) return res.status(404).json({ error: { message: `Demand request ${demandId} not found.` } });
  if (!resource) return res.status(404).json({ error: { message: `Resource ${resourceId} not found.` } });

  const validation = ResourceAllocationEngine.validate(demand, resource, quantity);
  res.json({ data: validation });
});

// POST /api/decision/allocate
router.post('/allocate', (req: Request, res: Response) => {
  const body = allocationExecutionSchema.parse(req.body);
  const result = ResourceAllocationEngine.executeAllocation(body);

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

export { router as decisionRouter };
