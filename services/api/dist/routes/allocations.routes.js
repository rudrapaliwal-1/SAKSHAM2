"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocationsRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db/db.js");
const inMemoryStore_js_1 = require("../db/inMemoryStore.js");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.allocationsRouter = router;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
let isDbAvailable = true;
async function tryDb(dbFn, fallbackFn) {
    if (!isDbAvailable && process.env.NODE_ENV !== 'production') {
        return fallbackFn();
    }
    try {
        return await dbFn();
    }
    catch (err) {
        console.warn('[DB NOTICE - Allocations]: Falling back to in-memory allocation store.');
        isDbAvailable = false;
        return fallbackFn();
    }
}
const allocationCreateSchema = zod_1.z.object({
    demandId: zod_1.z.string().min(1, 'Demand ID is required'),
    resourceId: zod_1.z.string().min(1, 'Resource ID is required'),
    quantity: zod_1.z.number().positive('Quantity must be greater than 0'),
    vehicleId: zod_1.z.string().optional(),
});
const allocationRejectSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1, 'Rejection reason is required'),
});
// Helper to generate custom allocation ID
async function generateAllocationId() {
    const count = await db_js_1.prisma.allocation.count();
    return `ALL-2026-${String(count + 1).padStart(3, '0')}`;
}
// GET /api/allocations
router.get('/', asyncHandler(async (req, res) => {
    const { status, demandId, resourceId, search, limit = '50', offset = '0' } = req.query;
    const result = await tryDb(async () => {
        const where = {};
        if (status)
            where.status = status;
        if (demandId)
            where.demandId = demandId;
        if (resourceId)
            where.resourceId = resourceId;
        if (search) {
            where.OR = [{ allocationId: { contains: search, mode: 'insensitive' } }];
        }
        const [allocations, total] = await Promise.all([
            db_js_1.prisma.allocation.findMany({
                where,
                take: parseInt(limit),
                skip: parseInt(offset),
                orderBy: { createdAt: 'desc' },
                include: {
                    demand: { include: { incident: true } },
                    resource: true,
                    vehicle: true,
                    approvedBy: { select: { name: true, role: true } },
                },
            }),
            db_js_1.prisma.allocation.count({ where }),
        ]);
        return { data: allocations, meta: { total, limit: parseInt(limit), offset: parseInt(offset) } };
    }, () => {
        let list = inMemoryStore_js_1.inMemoryStore.getAllocations();
        if (status)
            list = list.filter(a => a.status === status);
        if (demandId)
            list = list.filter(a => a.demandId === demandId);
        if (resourceId)
            list = list.filter(a => a.resourceId === resourceId);
        return { data: list, meta: { total: list.length, limit: parseInt(limit), offset: 0 } };
    });
    res.json(result);
}));
// GET /api/allocations/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const allocation = await db_js_1.prisma.allocation.findUnique({
            where: isUuid ? { id } : { allocationId: id },
            include: {
                demand: { include: { incident: true } },
                resource: true,
                vehicle: true,
                approvedBy: { select: { name: true, role: true } },
            },
        });
        return allocation ? { data: allocation } : null;
    }, () => {
        const alloc = inMemoryStore_js_1.inMemoryStore.getAllocationById(id);
        return alloc ? { data: alloc } : null;
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Allocation ${id} not found.` } });
    }
    res.json(result);
}));
// POST /api/allocations (Create recommendation allocation)
router.post('/', asyncHandler(async (req, res) => {
    const { demandId, resourceId, quantity, vehicleId } = allocationCreateSchema.parse(req.body);
    const officerEmail = req.headers['x-officer-email'];
    let officerId = null;
    const result = await tryDb(async () => {
        if (officerEmail) {
            const officer = await db_js_1.prisma.officer.findUnique({ where: { email: officerEmail } });
            if (officer)
                officerId = officer.id;
        }
        return await db_js_1.prisma.$transaction(async (tx) => {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId);
            const resource = await tx.resource.findUnique({ where: isUuid ? { id: resourceId } : { resourceId } });
            if (!resource)
                throw new Error('Resource not found.');
            const isDemUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(demandId);
            const demand = await tx.demandRequest.findUnique({ where: isDemUuid ? { id: demandId } : { requestId: demandId } });
            if (!demand)
                throw new Error('Demand request not found.');
            const allocationId = await generateAllocationId();
            const allocation = await tx.allocation.create({
                data: {
                    allocationId,
                    demandId: demand.id,
                    resourceId: resource.id,
                    vehicleId,
                    status: client_1.AllocationStatus.RECOMMENDED,
                    approvedById: officerId,
                },
            });
            await tx.resource.update({
                where: { id: resource.id },
                data: { reservedQuantity: { increment: quantity } },
            });
            await tx.demandRequest.update({
                where: { id: demand.id },
                data: { status: client_1.DemandStatus.MATCHED },
            });
            return allocation;
        });
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.createAllocation({
            demandId,
            resourceId,
            quantity,
            vehicleId,
        });
    });
    res.status(201).json({ data: result });
}));
// POST /api/allocations/:id/approve
router.post('/:id/approve', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const findQuery = isUuid ? { id } : { allocationId: id };
        return await db_js_1.prisma.$transaction(async (tx) => {
            const allocation = await tx.allocation.findUnique({
                where: findQuery,
                include: { demand: true, resource: true },
            });
            if (!allocation)
                throw new Error('Allocation record not found.');
            const updated = await tx.allocation.update({
                where: { id: allocation.id },
                data: {
                    status: client_1.AllocationStatus.APPROVED,
                    approvedAt: new Date(),
                },
            });
            await tx.demandRequest.update({
                where: { id: allocation.demandId },
                data: { status: client_1.DemandStatus.ALLOCATED },
            });
            return updated;
        });
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.approveAllocation(id, 'Command Center Supervisor');
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Allocation ${id} not found.` } });
    }
    res.json({ data: result, message: `Allocation ${id} approved.` });
}));
// POST /api/allocations/:id/reject
router.post('/:id/reject', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = allocationRejectSchema.parse(req.body);
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const findQuery = isUuid ? { id } : { allocationId: id };
        return await db_js_1.prisma.$transaction(async (tx) => {
            const allocation = await tx.allocation.findUnique({
                where: findQuery,
                include: { demand: true, resource: true },
            });
            if (!allocation)
                throw new Error('Allocation record not found.');
            const updated = await tx.allocation.update({
                where: { id: allocation.id },
                data: { status: client_1.AllocationStatus.REJECTED },
            });
            await tx.demandRequest.update({
                where: { id: allocation.demandId },
                data: { status: client_1.DemandStatus.PENDING },
            });
            return updated;
        });
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.rejectAllocation(id, reason);
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Allocation ${id} not found.` } });
    }
    res.json({ data: result, message: `Allocation ${id} rejected.` });
}));
