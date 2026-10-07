import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/db.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { z } from 'zod';
import { DemandStatus, AllocationStatus, ResourceStatus } from '@prisma/client';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

let isDbAvailable = true;
async function tryDb(dbFn: () => Promise<any>, fallbackFn: () => any): Promise<any> {
  if (!isDbAvailable && process.env.NODE_ENV !== 'production') {
    return fallbackFn();
  }
  try {
    return await dbFn();
  } catch (err: any) {
    console.warn('[DB NOTICE - Allocations]: Falling back to in-memory allocation store.');
    isDbAvailable = false;
    return fallbackFn();
  }
}

const allocationCreateSchema = z.object({
  demandId: z.string().min(1, 'Demand ID is required'),
  resourceId: z.string().min(1, 'Resource ID is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  vehicleId: z.string().optional(),
});

const allocationRejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

// Helper to generate custom allocation ID
async function generateAllocationId(): Promise<string> {
  const count = await prisma.allocation.count();
  return `ALL-2026-${String(count + 1).padStart(3, '0')}`;
}

// GET /api/allocations
router.get('/', asyncHandler(async (req, res) => {
  const { status, demandId, resourceId, search, limit = '50', offset = '0' } = req.query;

  const result = await tryDb(
    async () => {
      const where: any = {};
      if (status) where.status = status as AllocationStatus;
      if (demandId) where.demandId = demandId as string;
      if (resourceId) where.resourceId = resourceId as string;
      if (search) {
        where.OR = [{ allocationId: { contains: search as string, mode: 'insensitive' } }];
      }

      const [allocations, total] = await Promise.all([
        prisma.allocation.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { createdAt: 'desc' },
          include: {
            demand: { include: { incident: true } },
            resource: true,
            vehicle: true,
            approvedBy: { select: { name: true, role: true } },
          },
        }),
        prisma.allocation.count({ where }),
      ]);
      return { data: allocations, meta: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } };
    },
    () => {
      let list = inMemoryStore.getAllocations();
      if (status) list = list.filter(a => a.status === status);
      if (demandId) list = list.filter(a => a.demandId === demandId);
      if (resourceId) list = list.filter(a => a.resourceId === resourceId);
      return { data: list, meta: { total: list.length, limit: parseInt(limit as string), offset: 0 } };
    }
  );

  res.json(result);
}));

// GET /api/allocations/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const allocation = await prisma.allocation.findUnique({
        where: isUuid ? { id } : { allocationId: id },
        include: {
          demand: { include: { incident: true } },
          resource: true,
          vehicle: true,
          approvedBy: { select: { name: true, role: true } },
        },
      });
      return allocation ? { data: allocation } : null;
    },
    () => {
      const alloc = inMemoryStore.getAllocationById(id);
      return alloc ? { data: alloc } : null;
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Allocation ${id} not found.` } });
  }
  res.json(result);
}));

// POST /api/allocations (Create recommendation allocation)
router.post('/', asyncHandler(async (req, res) => {
  const { demandId, resourceId, quantity, vehicleId } = allocationCreateSchema.parse(req.body);

  const officerEmail = req.headers['x-officer-email'] as string;
  let officerId: string | null = null;

  const result = await tryDb(
    async () => {
      if (officerEmail) {
        const officer = await prisma.officer.findUnique({ where: { email: officerEmail } });
        if (officer) officerId = officer.id;
      }

      return await prisma.$transaction(async (tx) => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId);
        const resource = await tx.resource.findUnique({ where: isUuid ? { id: resourceId } : { resourceId } });
        if (!resource) throw new Error('Resource not found.');

        const isDemUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(demandId);
        const demand = await tx.demandRequest.findUnique({ where: isDemUuid ? { id: demandId } : { requestId: demandId } });
        if (!demand) throw new Error('Demand request not found.');

        const allocationId = await generateAllocationId();
        const allocation = await tx.allocation.create({
          data: {
            allocationId,
            demandId: demand.id,
            resourceId: resource.id,
            vehicleId,
            status: AllocationStatus.RECOMMENDED,
            approvedById: officerId,
          },
        });

        await tx.resource.update({
          where: { id: resource.id },
          data: { reservedQuantity: { increment: quantity } },
        });

        await tx.demandRequest.update({
          where: { id: demand.id },
          data: { status: DemandStatus.MATCHED },
        });

        return allocation;
      });
    },
    () => {
      return inMemoryStore.createAllocation({
        demandId,
        resourceId,
        quantity,
        vehicleId,
      });
    }
  );

  res.status(201).json({ data: result });
}));

// POST /api/allocations/:id/approve
router.post('/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const findQuery = isUuid ? { id } : { allocationId: id };

      return await prisma.$transaction(async (tx) => {
        const allocation = await tx.allocation.findUnique({
          where: findQuery,
          include: { demand: true, resource: true },
        });
        if (!allocation) throw new Error('Allocation record not found.');

        const updated = await tx.allocation.update({
          where: { id: allocation.id },
          data: {
            status: AllocationStatus.APPROVED,
            approvedAt: new Date(),
          },
        });

        await tx.demandRequest.update({
          where: { id: allocation.demandId },
          data: { status: DemandStatus.ALLOCATED },
        });

        return updated;
      });
    },
    () => {
      return inMemoryStore.approveAllocation(id, 'Command Center Supervisor');
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Allocation ${id} not found.` } });
  }
  res.json({ data: result, message: `Allocation ${id} approved.` });
}));

// POST /api/allocations/:id/reject
router.post('/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = allocationRejectSchema.parse(req.body);

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const findQuery = isUuid ? { id } : { allocationId: id };

      return await prisma.$transaction(async (tx) => {
        const allocation = await tx.allocation.findUnique({
          where: findQuery,
          include: { demand: true, resource: true },
        });
        if (!allocation) throw new Error('Allocation record not found.');

        const updated = await tx.allocation.update({
          where: { id: allocation.id },
          data: { status: AllocationStatus.REJECTED },
        });

        await tx.demandRequest.update({
          where: { id: allocation.demandId },
          data: { status: DemandStatus.PENDING },
        });

        return updated;
      });
    },
    () => {
      return inMemoryStore.rejectAllocation(id, reason);
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Allocation ${id} not found.` } });
  }
  res.json({ data: result, message: `Allocation ${id} rejected.` });
}));

export { router as allocationsRouter };
