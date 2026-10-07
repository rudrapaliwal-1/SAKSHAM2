"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const db_js_1 = require("../db/db.js");
const inMemoryStore_js_1 = require("../db/inMemoryStore.js");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
exports.apiRouter = router;
// Helper to wrap async route handlers
const asyncHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
// Check if database is reachable; if not, fall back to inMemoryStore
let isDbAvailable = true;
async function tryDb(dbFn, fallbackFn) {
    if (!isDbAvailable && process.env.NODE_ENV !== 'production') {
        return fallbackFn();
    }
    try {
        return await dbFn();
    }
    catch (err) {
        console.warn('[DB NOTICE]: Database unreachable, serving from deterministic in-memory store.');
        isDbAvailable = false;
        return fallbackFn();
    }
}
/* ==========================================
   INCIDENT ROUTING & SCHEMAS
   ========================================== */
const incidentCreateSchema = zod_1.z.object({
    type: zod_1.z.string().min(1, 'Incident type is required'),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().min(1, 'Description is required'),
    location: zod_1.z.string().min(1, 'Location is required'),
    coordinates: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }).optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    region: zod_1.z.string().optional(),
    severity: zod_1.z.nativeEnum(client_1.Severity),
    status: zod_1.z.nativeEnum(client_1.IncidentStatus).optional(),
    assignedTeam: zod_1.z.string().optional(),
    reporterName: zod_1.z.string().optional(),
    reporterContact: zod_1.z.string().optional(),
    affectedPeople: zod_1.z.number().int().nonnegative().optional(),
    peopleAffected: zod_1.z.number().int().nonnegative().optional(),
    displacedPeople: zod_1.z.number().int().nonnegative().optional(),
    displacedCount: zod_1.z.number().int().nonnegative().optional(),
    casualtiesCount: zod_1.z.number().int().nonnegative().optional(),
    requiredResources: zod_1.z.array(zod_1.z.object({
        itemNeeded: zod_1.z.string(),
        quantity: zod_1.z.number(),
        unit: zod_1.z.string(),
        priority: zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
    })).optional(),
});
const incidentUpdateSchema = incidentCreateSchema.partial();
const incidentStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.IncidentStatus),
});
const incidentPrioritySchema = zod_1.z.object({
    severity: zod_1.z.nativeEnum(client_1.Severity),
    officerName: zod_1.z.string().optional(),
});
// GET /api/incidents
router.get('/incidents', asyncHandler(async (req, res) => {
    const { status, severity, search, region, limit = '50', offset = '0' } = req.query;
    const result = await tryDb(async () => {
        const where = {};
        if (status)
            where.status = status;
        if (severity)
            where.severity = severity;
        if (region)
            where.region = region;
        if (search) {
            where.OR = [
                { incidentId: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [incidents, total] = await Promise.all([
            db_js_1.prisma.incident.findMany({
                where,
                take: parseInt(limit),
                skip: parseInt(offset),
                orderBy: { reportedAt: 'desc' },
                include: { demands: true },
            }),
            db_js_1.prisma.incident.count({ where }),
        ]);
        return { data: incidents, meta: { total, limit: parseInt(limit), offset: parseInt(offset) } };
    }, () => {
        const list = inMemoryStore_js_1.inMemoryStore.getIncidents({
            status: status,
            severity: severity,
            search: search,
        });
        return { data: list, meta: { total: list.length, limit: parseInt(limit), offset: 0 } };
    });
    res.json(result);
}));
// GET /api/incidents/:id
router.get('/incidents/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const incident = await db_js_1.prisma.incident.findUnique({
            where: isUuid ? { id } : { incidentId: id },
            include: {
                demands: true,
                timelines: { orderBy: { timestamp: 'desc' } },
            },
        });
        if (!incident)
            return null;
        return { data: incident };
    }, () => {
        const inc = inMemoryStore_js_1.inMemoryStore.getIncidentById(id);
        return inc ? { data: inc } : null;
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
    }
    res.json(result);
}));
// POST /api/incidents
router.post('/incidents', asyncHandler(async (req, res) => {
    const body = incidentCreateSchema.parse(req.body);
    const result = await tryDb(async () => {
        const count = await db_js_1.prisma.incident.count();
        const indexStr = String(count + 1).padStart(3, '0');
        const incidentId = `INC-2026-${indexStr}`;
        const incident = await db_js_1.prisma.incident.create({
            data: {
                type: body.type,
                title: body.title || `${body.type} at ${body.location}`,
                description: body.description,
                location: body.location,
                latitude: body.latitude || body.coordinates?.lat || 28.6139,
                longitude: body.longitude || body.coordinates?.lng || 77.2090,
                region: body.region || 'Delhi NCR',
                severity: body.severity,
                status: body.status || client_1.IncidentStatus.REPORTED,
                affectedPeople: body.affectedPeople || body.peopleAffected || 0,
                displacedPeople: body.displacedPeople || body.displacedCount || 0,
                incidentId,
            },
        });
        await db_js_1.prisma.incidentTimeline.create({
            data: {
                incidentId: incident.id,
                eventType: 'REPORTED',
                message: `Incident reported: ${incident.title} at ${incident.location}`,
            },
        });
        return incident;
    }, () => {
        const inc = inMemoryStore_js_1.inMemoryStore.createIncident({
            type: body.type,
            severity: body.severity,
            location: body.location,
            coordinates: body.coordinates || { lat: body.latitude || 28.6139, lng: body.longitude || 77.2090 },
            status: body.status || 'REPORTED',
            assignedTeam: body.assignedTeam || 'Unassigned',
            description: body.description,
            reporterName: body.reporterName || 'Field Caller',
            reporterContact: body.reporterContact || '+91-98000-00000',
            casualtiesCount: body.casualtiesCount || 0,
            displacedCount: body.displacedCount || body.displacedPeople || 0,
            peopleAffected: body.peopleAffected || body.affectedPeople || 0,
            requiredResources: body.requiredResources,
        });
        return inc;
    });
    res.status(201).json({ data: result });
}));
// PATCH /api/incidents/:id/status (Workflow Status Transition)
router.patch('/incidents/:id/status', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = incidentStatusSchema.parse(req.body);
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const findQuery = isUuid ? { id } : { incidentId: id };
        const existing = await db_js_1.prisma.incident.findUnique({ where: findQuery });
        if (!existing)
            return null;
        const updated = await db_js_1.prisma.incident.update({
            where: { id: existing.id },
            data: { status },
        });
        await db_js_1.prisma.incidentTimeline.create({
            data: {
                incidentId: existing.id,
                eventType: 'STATUS_UPDATE',
                message: `Incident status updated from ${existing.status} to ${status}`,
            },
        });
        return updated;
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.updateIncidentStatus(id, status);
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
    }
    res.json({ data: result });
}));
// PATCH /api/incidents/:id/priority (Workflow Priority Assignment)
router.patch('/incidents/:id/priority', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { severity } = incidentPrioritySchema.parse(req.body);
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const findQuery = isUuid ? { id } : { incidentId: id };
        const existing = await db_js_1.prisma.incident.findUnique({ where: findQuery });
        if (!existing)
            return null;
        const updated = await db_js_1.prisma.incident.update({
            where: { id: existing.id },
            data: { severity },
        });
        await db_js_1.prisma.incidentTimeline.create({
            data: {
                incidentId: existing.id,
                eventType: 'PRIORITY_UPDATE',
                message: `Incident severity escalated to ${severity}`,
            },
        });
        return updated;
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.updateIncidentPriority(id, severity);
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
    }
    res.json({ data: result });
}));
// POST /api/incidents/:id/verify (Workflow Verification)
router.post('/incidents/:id/verify', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const findQuery = isUuid ? { id } : { incidentId: id };
        const existing = await db_js_1.prisma.incident.findUnique({ where: findQuery });
        if (!existing)
            return null;
        const updated = await db_js_1.prisma.incident.update({
            where: { id: existing.id },
            data: { status: client_1.IncidentStatus.VERIFIED },
        });
        await db_js_1.prisma.incidentTimeline.create({
            data: {
                incidentId: existing.id,
                eventType: 'VERIFIED',
                message: `Incident verified by Field Commander.`,
            },
        });
        return updated;
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.updateIncidentStatus(id, 'VERIFIED');
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
    }
    res.json({ data: result, message: `Incident ${id} successfully verified.` });
}));
/* ==========================================
   DEMANDS / REQUESTS ROUTING & SCHEMAS
   ========================================== */
const demandCreateSchema = zod_1.z.object({
    incidentId: zod_1.z.string().optional(),
    zoneName: zod_1.z.string().optional(),
    affectedZone: zod_1.z.string().optional(),
    itemNeeded: zod_1.z.string().optional(),
    requestedType: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    quantity: zod_1.z.number().positive('Quantity must be greater than 0'),
    unit: zod_1.z.string().min(1, 'Unit is required'),
    priority: zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    affectedPeople: zod_1.z.number().int().nonnegative().optional(),
    affectedCount: zod_1.z.number().int().nonnegative().optional(),
    coordinates: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }).optional(),
});
const demandStatusSchema = zod_1.z.object({
    status: zod_1.z.string(),
    resourceId: zod_1.z.string().optional(),
});
// GET /api/demands and /api/requests
const getDemandsHandler = asyncHandler(async (req, res) => {
    const { status, priority, incidentId, limit = '50', offset = '0' } = req.query;
    const result = await tryDb(async () => {
        const where = {};
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (incidentId)
            where.incidentId = incidentId;
        const [demands, total] = await Promise.all([
            db_js_1.prisma.demandRequest.findMany({
                where,
                take: parseInt(limit),
                skip: parseInt(offset),
                orderBy: { createdAt: 'desc' },
                include: {
                    incident: { select: { incidentId: true, title: true } },
                },
            }),
            db_js_1.prisma.demandRequest.count({ where }),
        ]);
        return { data: demands, meta: { total, limit: parseInt(limit), offset: parseInt(offset) } };
    }, () => {
        const list = inMemoryStore_js_1.inMemoryStore.getDemands({
            status: status,
            priority: priority,
            incidentId: incidentId,
        });
        return { data: list, meta: { total: list.length, limit: parseInt(limit), offset: 0 } };
    });
    res.json(result);
});
router.get('/demands', getDemandsHandler);
router.get('/requests', getDemandsHandler);
// GET /api/demands/:id
router.get('/demands/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const demand = await db_js_1.prisma.demandRequest.findUnique({
            where: isUuid ? { id } : { requestId: id },
            include: {
                incident: true,
                allocations: { include: { resource: true, vehicle: true } },
            },
        });
        return demand ? { data: demand } : null;
    }, () => {
        const d = inMemoryStore_js_1.inMemoryStore.getDemandById(id);
        return d ? { data: d } : null;
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Demand request ${id} not found.` } });
    }
    res.json(result);
}));
// POST /api/demands
router.post('/demands', asyncHandler(async (req, res) => {
    const body = demandCreateSchema.parse(req.body);
    const result = await tryDb(async () => {
        const count = await db_js_1.prisma.demandRequest.count();
        const indexStr = String(count + 101);
        const requestId = `REQ-DEL-${indexStr}`;
        const demand = await db_js_1.prisma.demandRequest.create({
            data: {
                requestId,
                incidentId: body.incidentId || '00000000-0000-0000-0000-000000000000',
                affectedZone: body.zoneName || body.affectedZone || 'Delhi Metro Area',
                requestedType: body.itemNeeded || body.requestedType || 'Relief Supplies',
                description: body.description || `${body.quantity} ${body.unit} required urgently.`,
                quantity: body.quantity,
                unit: body.unit,
                priority: body.priority,
                status: client_1.DemandStatus.PENDING,
                affectedPeople: body.affectedPeople || body.affectedCount || 0,
            },
        });
        return demand;
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.createDemand({
            incidentId: body.incidentId,
            zoneName: body.zoneName || body.affectedZone || 'Delhi Metro Area',
            coordinates: body.coordinates || { lat: 28.6139, lng: 77.2090 },
            itemNeeded: body.itemNeeded || body.requestedType || 'Relief Supplies',
            category: body.category || 'GENERAL',
            quantity: body.quantity,
            unit: body.unit,
            priority: body.priority,
            affectedCount: body.affectedCount || body.affectedPeople || 100,
            status: 'PENDING',
        });
    });
    res.status(201).json({ data: result });
}));
// PATCH /api/demands/:id/status
router.patch('/demands/:id/status', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, resourceId } = demandStatusSchema.parse(req.body);
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const findQuery = isUuid ? { id } : { requestId: id };
        const existing = await db_js_1.prisma.demandRequest.findUnique({ where: findQuery });
        if (!existing)
            return null;
        const updated = await db_js_1.prisma.demandRequest.update({
            where: { id: existing.id },
            data: { status: status },
        });
        return updated;
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.updateDemandStatus(id, status, resourceId);
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Demand request ${id} not found.` } });
    }
    res.json({ data: result });
}));
/* ==========================================
   RESOURCES ROUTING & SCHEMAS
   ========================================== */
const resourceCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Material name is required'),
    category: zod_1.z.enum(['WATER', 'FOOD', 'MEDICAL', 'SHELTER_SUPPLIES', 'CLOTHING', 'RESCUE_EQUIPMENT', 'VEHICLES', 'OTHER']),
    quantity: zod_1.z.number().positive('Quantity must be greater than 0'),
    unit: zod_1.z.string().min(1, 'Unit is required'),
    locationName: zod_1.z.string().min(1, 'Location name is required'),
    coordinates: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }).optional(),
    contactPerson: zod_1.z.string().optional(),
    contactNumber: zod_1.z.string().optional(),
});
// GET /api/resources
router.get('/resources', asyncHandler(async (req, res) => {
    const { category, status, search, limit = '50', offset = '0' } = req.query;
    const result = await tryDb(async () => {
        const where = {};
        if (category)
            where.category = category;
        if (status)
            where.status = status;
        if (search) {
            where.OR = [
                { resourceId: { contains: search, mode: 'insensitive' } },
                { materialName: { contains: search, mode: 'insensitive' } },
                { storageDepot: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [resources, total] = await Promise.all([
            db_js_1.prisma.resource.findMany({
                where,
                take: parseInt(limit),
                skip: parseInt(offset),
                orderBy: { materialName: 'asc' },
            }),
            db_js_1.prisma.resource.count({ where }),
        ]);
        return { data: resources, meta: { total, limit: parseInt(limit), offset: parseInt(offset) } };
    }, () => {
        const list = inMemoryStore_js_1.inMemoryStore.getResources({
            category: category,
            status: status,
        });
        return { data: list, meta: { total: list.length, limit: parseInt(limit), offset: 0 } };
    });
    res.json(result);
}));
// GET /api/resources/:id
router.get('/resources/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const resource = await db_js_1.prisma.resource.findUnique({
            where: isUuid ? { id } : { resourceId: id },
            include: { movements: true, allocations: true },
        });
        return resource ? { data: resource } : null;
    }, () => {
        const r = inMemoryStore_js_1.inMemoryStore.getResourceById(id);
        return r ? { data: r } : null;
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Resource ${id} not found.` } });
    }
    res.json(result);
}));
// POST /api/resources
router.post('/resources', asyncHandler(async (req, res) => {
    const body = resourceCreateSchema.parse(req.body);
    const result = await tryDb(async () => {
        const count = await db_js_1.prisma.resource.count();
        const resourceId = `RES-NCR-${String(count + 1).padStart(3, '0')}`;
        const resource = await db_js_1.prisma.resource.create({
            data: {
                resourceId,
                category: body.category,
                materialName: body.name,
                description: `${body.name} at ${body.locationName}`,
                availableQuantity: body.quantity,
                unit: body.unit,
                storageDepot: body.locationName,
                location: body.locationName,
                pointOfContact: body.contactPerson || 'Depot Manager',
                latitude: body.coordinates?.lat || 28.6139,
                longitude: body.coordinates?.lng || 77.2090,
                status: client_1.ResourceStatus.AVAILABLE,
            },
        });
        return resource;
    }, () => {
        return inMemoryStore_js_1.inMemoryStore.createResource({
            name: body.name,
            category: body.category,
            quantity: body.quantity,
            allocatedQuantity: 0,
            unit: body.unit,
            locationName: body.locationName,
            coordinates: body.coordinates || { lat: 28.6139, lng: 77.2090 },
            status: 'AVAILABLE',
            contactPerson: body.contactPerson || 'Depot In-Charge',
            contactNumber: body.contactNumber || '+91-98000-11111',
        });
    });
    res.status(201).json({ data: result });
}));
/* ==========================================
   RESPONDERS & PERSONNEL ROUTING
   ========================================== */
const responderCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    role: zod_1.z.enum(['INCIDENT_COMMANDER', 'LOGISTICS_OFFICER', 'PARAMEDIC', 'BOATMASTER', 'PILOT', 'FIELD_RESCUER']),
    agency: zod_1.z.string().min(1, 'Agency is required'),
    contactRadio: zod_1.z.string().min(1, 'Radio frequency is required'),
    contactPhone: zod_1.z.string().min(1, 'Phone number is required'),
    status: zod_1.z.enum(['ON_DUTY', 'ON_MISSION', 'STANDBY', 'OFF_DUTY']).default('ON_DUTY'),
    assignedUnit: zod_1.z.string().optional(),
});
// GET /api/responders
router.get('/responders', asyncHandler(async (req, res) => {
    const { status, role } = req.query;
    const list = inMemoryStore_js_1.inMemoryStore.getResponders({
        status: status,
        role: role,
    });
    res.json({ data: list, meta: { total: list.length } });
}));
// GET /api/responders/:id
router.get('/responders/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rsp = inMemoryStore_js_1.inMemoryStore.getResponderById(id);
    if (!rsp)
        return res.status(404).json({ error: { message: `Responder ${id} not found.` } });
    res.json({ data: rsp });
}));
// POST /api/responders
router.post('/responders', asyncHandler(async (req, res) => {
    const body = responderCreateSchema.parse(req.body);
    const rsp = inMemoryStore_js_1.inMemoryStore.createResponder(body);
    res.status(201).json({ data: rsp });
}));
// PATCH /api/responders/:id/status
router.patch('/responders/:id/status', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = zod_1.z.object({ status: zod_1.z.enum(['ON_DUTY', 'ON_MISSION', 'STANDBY', 'OFF_DUTY']) }).parse(req.body);
    const rsp = inMemoryStore_js_1.inMemoryStore.updateResponderStatus(id, status);
    if (!rsp)
        return res.status(404).json({ error: { message: `Responder ${id} not found.` } });
    res.json({ data: rsp });
}));
/* ==========================================
   VEHICLES ROUTING & SCHEMAS
   ========================================== */
const vehicleCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    type: zod_1.z.enum(['TRUCK', 'AMBULANCE', 'HELICOPTER', 'RESCUE_BOAT', 'DRONE', 'SUV']),
    capacity: zod_1.z.string().min(1, 'Capacity is required'),
    status: zod_1.z.nativeEnum(client_1.VehicleStatus).default(client_1.VehicleStatus.AVAILABLE),
    location: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }).optional(),
    driverName: zod_1.z.string().min(1, 'Driver name is required'),
    driverContact: zod_1.z.string().min(1, 'Driver contact is required'),
    teamName: zod_1.z.string().optional(),
});
// GET /api/vehicles
router.get('/vehicles', asyncHandler(async (req, res) => {
    const { status, type } = req.query;
    const result = await tryDb(async () => {
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        const [vehicles, total] = await Promise.all([
            db_js_1.prisma.vehicle.findMany({ where, orderBy: { vehicleId: 'asc' } }),
            db_js_1.prisma.vehicle.count({ where }),
        ]);
        return { data: vehicles, meta: { total } };
    }, () => {
        const list = inMemoryStore_js_1.inMemoryStore.getVehicles({
            status: status,
            type: type,
        });
        return { data: list, meta: { total: list.length } };
    });
    res.json(result);
}));
// GET /api/vehicles/:id
router.get('/vehicles/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await tryDb(async () => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const vehicle = await db_js_1.prisma.vehicle.findUnique({
            where: isUuid ? { id } : { vehicleId: id },
            include: { locations: true, dispatches: true },
        });
        return vehicle ? { data: vehicle } : null;
    }, () => {
        const v = inMemoryStore_js_1.inMemoryStore.getVehicleById(id);
        return v ? { data: v } : null;
    });
    if (!result) {
        return res.status(404).json({ error: { message: `Vehicle ${id} not found.` } });
    }
    res.json(result);
}));
// POST /api/vehicles
router.post('/vehicles', asyncHandler(async (req, res) => {
    const body = vehicleCreateSchema.parse(req.body);
    const veh = inMemoryStore_js_1.inMemoryStore.createVehicle({
        ...body,
        location: body.location || { lat: 28.6139, lng: 77.2090 },
    });
    res.status(201).json({ data: veh });
}));
// PATCH /api/vehicles/:id/status
router.patch('/api/vehicles/:id/status', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = zod_1.z.object({ status: zod_1.z.string() }).parse(req.body);
    const veh = inMemoryStore_js_1.inMemoryStore.updateVehicleStatus(id, status);
    if (!veh)
        return res.status(404).json({ error: { message: `Vehicle ${id} not found.` } });
    res.json({ data: veh });
}));
// PATCH /api/vehicles/:id/location
router.patch('/vehicles/:id/location', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { coordinates, speedKmh } = zod_1.z.object({
        coordinates: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }),
        speedKmh: zod_1.z.number().optional(),
    }).parse(req.body);
    const veh = inMemoryStore_js_1.inMemoryStore.updateVehicleLocation(id, coordinates, speedKmh);
    if (!veh)
        return res.status(404).json({ error: { message: `Vehicle ${id} not found.` } });
    res.json({ data: veh });
}));
/* ==========================================
   MISSIONS & DISPATCH ROUTING
   ========================================== */
const missionCreateSchema = zod_1.z.object({
    requestId: zod_1.z.string().min(1, 'Demand request ID is required'),
    vehicleId: zod_1.z.string().min(1, 'Vehicle ID is required'),
    operatorName: zod_1.z.string().optional(),
});
const missionStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PLANNED', 'AWAITING_DISPATCH', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'DELIVERING', 'DELIVERED', 'CANCELLED', 'FAILED']),
});
// GET /api/missions
router.get('/missions', asyncHandler(async (req, res) => {
    const { status, vehicleId, requestId } = req.query;
    const list = inMemoryStore_js_1.inMemoryStore.getMissions({
        status: status,
        vehicleId: vehicleId,
        requestId: requestId,
    });
    res.json({ data: list, meta: { total: list.length } });
}));
// GET /api/missions/:id
router.get('/missions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const mis = inMemoryStore_js_1.inMemoryStore.getMissionById(id);
    if (!mis)
        return res.status(404).json({ error: { message: `Mission ${id} not found.` } });
    res.json({ data: mis });
}));
// POST /api/missions (Dispatch Workflow)
router.post('/missions', asyncHandler(async (req, res) => {
    const body = missionCreateSchema.parse(req.body);
    const mis = inMemoryStore_js_1.inMemoryStore.createMission(body);
    res.status(201).json({ data: mis });
}));
// PATCH /api/missions/:id/status (Workflow Mission Telemetry Update)
router.patch('/missions/:id/status', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = missionStatusSchema.parse(req.body);
    const mis = inMemoryStore_js_1.inMemoryStore.updateMissionStatus(id, status);
    if (!mis)
        return res.status(404).json({ error: { message: `Mission ${id} not found.` } });
    res.json({ data: mis });
}));
// POST /api/missions/:id/deliver & /api/deliveries/:id/verify (Workflow Delivery Reconciliation)
const verifyDeliveryHandler = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { verifierName } = zod_1.z.object({ verifierName: zod_1.z.string().optional() }).parse(req.body);
    const result = inMemoryStore_js_1.inMemoryStore.verifyDelivery(id, verifierName);
    if (!result)
        return res.status(404).json({ error: { message: `Mission or Delivery ${id} not found.` } });
    res.json({ data: result, message: `Delivery for mission ${id} successfully verified and reconciled.` });
});
router.post('/missions/:id/deliver', verifyDeliveryHandler);
router.post('/deliveries/:id/verify', verifyDeliveryHandler);
// GET /api/deliveries
router.get('/deliveries', asyncHandler(async (req, res) => {
    const missions = inMemoryStore_js_1.inMemoryStore.getMissions();
    const deliveries = missions.map(m => ({
        id: `DEL-${m.id.replace('DSP-DEL-', '2026-0')}`,
        missionId: m.id,
        requestId: m.requestId,
        vehicleId: m.vehicleId,
        destination: m.destinationName,
        cargo: `${m.quantity} ${m.unit} ${m.resourceType}`,
        status: m.status === 'DELIVERED' ? 'VERIFIED' : m.status === 'EN_ROUTE' ? 'IN_TRANSIT' : 'PENDING',
        operatorName: m.operatorName,
        etaMinutes: m.etaMinutes,
    }));
    res.json({ data: deliveries, meta: { total: deliveries.length } });
}));
/* ==========================================
   ROUTES & NAVIGATION ROUTING
   ========================================== */
// GET /api/routes
router.get('/routes', asyncHandler(async (req, res) => {
    const list = inMemoryStore_js_1.inMemoryStore.getRoutes();
    res.json({ data: list, meta: { total: list.length } });
}));
// GET /api/routes/:id
router.get('/routes/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rte = inMemoryStore_js_1.inMemoryStore.getRouteById(id);
    if (!rte)
        return res.status(404).json({ error: { message: `Route ${id} not found.` } });
    res.json({ data: rte });
}));
// POST /api/routes/calculate
router.post('/routes/calculate', asyncHandler(async (req, res) => {
    const { origin, destination } = zod_1.z.object({
        origin: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }),
        destination: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }),
    }).parse(req.body);
    const route = inMemoryStore_js_1.inMemoryStore.calculateRoute(origin, destination);
    res.json({ data: route });
}));
/* ==========================================
   SHELTERS ROUTING & SCHEMAS
   ========================================== */
const shelterCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Shelter name is required'),
    locationName: zod_1.z.string().min(1, 'Location name is required'),
    coordinates: zod_1.z.object({ lat: zod_1.z.number(), lng: zod_1.z.number() }).optional(),
    capacityTotal: zod_1.z.number().int().positive(),
    capacityOccupied: zod_1.z.number().int().nonnegative().default(0),
    status: zod_1.z.enum(['OPEN', 'FULL', 'CLOSED']).default('OPEN'),
    contactPerson: zod_1.z.string().optional(),
    contactNumber: zod_1.z.string().optional(),
    resourcesAvailable: zod_1.z.array(zod_1.z.string()).optional(),
});
// GET /api/shelters
router.get('/shelters', asyncHandler(async (req, res) => {
    const list = inMemoryStore_js_1.inMemoryStore.getShelters();
    res.json({ data: list, meta: { total: list.length } });
}));
// GET /api/shelters/:id
router.get('/shelters/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const shl = inMemoryStore_js_1.inMemoryStore.getShelterById(id);
    if (!shl)
        return res.status(404).json({ error: { message: `Shelter ${id} not found.` } });
    res.json({ data: shl });
}));
// POST /api/shelters
router.post('/shelters', asyncHandler(async (req, res) => {
    const body = shelterCreateSchema.parse(req.body);
    const shl = inMemoryStore_js_1.inMemoryStore.createShelter({
        name: body.name,
        locationName: body.locationName,
        coordinates: body.coordinates || { lat: 28.6139, lng: 77.2090 },
        capacityTotal: body.capacityTotal,
        capacityOccupied: body.capacityOccupied,
        status: body.status,
        contactPerson: body.contactPerson || 'Camp Officer',
        contactNumber: body.contactNumber || '+91-98000-22222',
        resourcesAvailable: body.resourcesAvailable || ['Safe Water', 'Emergency Meals'],
    });
    res.status(201).json({ data: shl });
}));
// PATCH /api/shelters/:id/occupancy
router.patch('/shelters/:id/occupancy', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { occupiedCount } = zod_1.z.object({ occupiedCount: zod_1.z.number().int().nonnegative() }).parse(req.body);
    const shl = inMemoryStore_js_1.inMemoryStore.updateShelterOccupancy(id, occupiedCount);
    if (!shl)
        return res.status(404).json({ error: { message: `Shelter ${id} not found.` } });
    res.json({ data: shl });
}));
/* ==========================================
   ALERTS ROUTING & SCHEMAS
   ========================================== */
const alertCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    message: zod_1.z.string().min(1, 'Message is required'),
    severity: zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    category: zod_1.z.enum(['DEMAND', 'RESOURCE', 'SHELTER', 'MISSION', 'INCIDENT', 'SYSTEM']),
    actionPath: zod_1.z.string().optional(),
});
// GET /api/alerts
router.get('/alerts', asyncHandler(async (req, res) => {
    const list = inMemoryStore_js_1.inMemoryStore.getAlerts();
    res.json({ data: list, meta: { total: list.length } });
}));
// POST /api/alerts
router.post('/alerts', asyncHandler(async (req, res) => {
    const body = alertCreateSchema.parse(req.body);
    const alt = inMemoryStore_js_1.inMemoryStore.createAlert(body);
    res.status(201).json({ data: alt });
}));
// PATCH /api/alerts/:id/resolve
router.patch('/alerts/:id/resolve', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const alt = inMemoryStore_js_1.inMemoryStore.resolveAlert(id);
    if (!alt)
        return res.status(404).json({ error: { message: `Alert ${id} not found.` } });
    res.json({ data: alt });
}));
/* ==========================================
   AUDIT LOGS & EVENTS ROUTING
   ========================================== */
const auditCreateSchema = zod_1.z.object({
    actor: zod_1.z.string().min(1, 'Actor is required'),
    action: zod_1.z.string().min(1, 'Action is required'),
    target: zod_1.z.string().min(1, 'Target is required'),
    result: zod_1.z.string().min(1, 'Result is required'),
    type: zod_1.z.enum(['VERIFY', 'PRIORITIZE', 'MATCH', 'ALLOCATE', 'DISPATCH', 'DELIVERY', 'RESOLVE', 'SYSTEM', 'AUTH']),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
const getAuditHandler = asyncHandler(async (req, res) => {
    const list = inMemoryStore_js_1.inMemoryStore.getAuditEvents();
    res.json({ data: list, meta: { total: list.length } });
});
router.get('/audit-events', getAuditHandler);
router.get('/audit-logs', getAuditHandler);
router.post('/audit-events', asyncHandler(async (req, res) => {
    const body = auditCreateSchema.parse(req.body);
    const ev = inMemoryStore_js_1.inMemoryStore.logAuditEvent(body);
    res.status(201).json({ data: ev });
}));
/* ==========================================
   DEMO RESET ENDPOINT
   ========================================== */
router.post('/demo/reset', asyncHandler(async (req, res) => {
    inMemoryStore_js_1.inMemoryStore.reset();
    res.json({
        status: 'success',
        message: 'Operational demo state reset successfully to baseline Delhi NCR scenarios.',
    });
}));
