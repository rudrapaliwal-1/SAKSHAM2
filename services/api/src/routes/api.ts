import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/db.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { z } from 'zod';
import { Severity, IncidentStatus, DemandPriority, DemandStatus, ResourceStatus, VehicleStatus, ShelterStatus } from '@prisma/client';

const router = Router();

// Helper to wrap async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

// Check if database is reachable; if not, fall back to inMemoryStore
let isDbAvailable = true;
async function tryDb(dbFn: () => Promise<any>, fallbackFn: () => any): Promise<any> {
  if (!isDbAvailable && process.env.NODE_ENV !== 'production') {
    return fallbackFn();
  }
  try {
    return await dbFn();
  } catch (err: any) {
    console.warn('[DB NOTICE]: Database unreachable, serving from deterministic in-memory store.');
    isDbAvailable = false;
    return fallbackFn();
  }
}

/* ==========================================
   INCIDENT ROUTING & SCHEMAS
   ========================================== */

const incidentCreateSchema = z.object({
  type: z.string().min(1, 'Incident type is required'),
  title: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  location: z.string().min(1, 'Location is required'),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  region: z.string().optional(),
  severity: z.nativeEnum(Severity),
  status: z.nativeEnum(IncidentStatus).optional(),
  assignedTeam: z.string().optional(),
  reporterName: z.string().optional(),
  reporterContact: z.string().optional(),
  affectedPeople: z.number().int().nonnegative().optional(),
  peopleAffected: z.number().int().nonnegative().optional(),
  displacedPeople: z.number().int().nonnegative().optional(),
  displacedCount: z.number().int().nonnegative().optional(),
  casualtiesCount: z.number().int().nonnegative().optional(),
  requiredResources: z.array(z.object({
    itemNeeded: z.string(),
    quantity: z.number(),
    unit: z.string(),
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
  })).optional(),
});

const incidentUpdateSchema = incidentCreateSchema.partial();

const incidentStatusSchema = z.object({
  status: z.nativeEnum(IncidentStatus),
});

const incidentPrioritySchema = z.object({
  severity: z.nativeEnum(Severity),
  officerName: z.string().optional(),
});

// GET /api/incidents
router.get('/incidents', asyncHandler(async (req, res) => {
  const { status, severity, search, region, limit = '50', offset = '0' } = req.query;

  const result = await tryDb(
    async () => {
      const where: any = {};
      if (status) where.status = status as IncidentStatus;
      if (severity) where.severity = severity as Severity;
      if (region) where.region = region as string;
      if (search) {
        where.OR = [
          { incidentId: { contains: search as string, mode: 'insensitive' } },
          { title: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
          { location: { contains: search as string, mode: 'insensitive' } },
        ];
      }
      const [incidents, total] = await Promise.all([
        prisma.incident.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { reportedAt: 'desc' },
          include: { demands: true },
        }),
        prisma.incident.count({ where }),
      ]);
      return { data: incidents, meta: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } };
    },
    () => {
      const list = inMemoryStore.getIncidents({
        status: status as string,
        severity: severity as string,
        search: search as string,
      });
      return { data: list, meta: { total: list.length, limit: parseInt(limit as string), offset: 0 } };
    }
  );

  res.json(result);
}));

// GET /api/incidents/:id
router.get('/incidents/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const incident = await prisma.incident.findUnique({
        where: isUuid ? { id } : { incidentId: id },
        include: {
          demands: true,
          timelines: { orderBy: { timestamp: 'desc' } },
        },
      });
      if (!incident) return null;
      return { data: incident };
    },
    () => {
      const inc = inMemoryStore.getIncidentById(id);
      return inc ? { data: inc } : null;
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
  }
  res.json(result);
}));

// POST /api/incidents
router.post('/incidents', asyncHandler(async (req, res) => {
  const body = incidentCreateSchema.parse(req.body);

  const result = await tryDb(
    async () => {
      const count = await prisma.incident.count();
      const indexStr = String(count + 1).padStart(3, '0');
      const incidentId = `INC-2026-${indexStr}`;

      const incident = await prisma.incident.create({
        data: {
          type: body.type,
          title: body.title || `${body.type} at ${body.location}`,
          description: body.description,
          location: body.location,
          latitude: body.latitude || body.coordinates?.lat || 28.6139,
          longitude: body.longitude || body.coordinates?.lng || 77.2090,
          region: body.region || 'Delhi NCR',
          severity: body.severity,
          status: body.status || IncidentStatus.REPORTED,
          affectedPeople: body.affectedPeople || body.peopleAffected || 0,
          displacedPeople: body.displacedPeople || body.displacedCount || 0,
          incidentId,
        },
      });

      await prisma.incidentTimeline.create({
        data: {
          incidentId: incident.id,
          eventType: 'REPORTED',
          message: `Incident reported: ${incident.title} at ${incident.location}`,
        },
      });

      return incident;
    },
    () => {
      const inc = inMemoryStore.createIncident({
        type: body.type as any,
        severity: body.severity as any,
        location: body.location,
        coordinates: body.coordinates || { lat: body.latitude || 28.6139, lng: body.longitude || 77.2090 },
        status: (body.status as any) || 'REPORTED',
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
    }
  );

  res.status(201).json({ data: result });
}));

// PATCH /api/incidents/:id/status (Workflow Status Transition)
router.patch('/incidents/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = incidentStatusSchema.parse(req.body);

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const findQuery = isUuid ? { id } : { incidentId: id };
      const existing = await prisma.incident.findUnique({ where: findQuery });
      if (!existing) return null;

      const updated = await prisma.incident.update({
        where: { id: existing.id },
        data: { status },
      });

      await prisma.incidentTimeline.create({
        data: {
          incidentId: existing.id,
          eventType: 'STATUS_UPDATE',
          message: `Incident status updated from ${existing.status} to ${status}`,
        },
      });
      return updated;
    },
    () => {
      return inMemoryStore.updateIncidentStatus(id, status as any);
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
  }
  res.json({ data: result });
}));

// PATCH /api/incidents/:id/priority (Workflow Priority Assignment)
router.patch('/incidents/:id/priority', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { severity } = incidentPrioritySchema.parse(req.body);

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const findQuery = isUuid ? { id } : { incidentId: id };
      const existing = await prisma.incident.findUnique({ where: findQuery });
      if (!existing) return null;

      const updated = await prisma.incident.update({
        where: { id: existing.id },
        data: { severity },
      });

      await prisma.incidentTimeline.create({
        data: {
          incidentId: existing.id,
          eventType: 'PRIORITY_UPDATE',
          message: `Incident severity escalated to ${severity}`,
        },
      });
      return updated;
    },
    () => {
      return inMemoryStore.updateIncidentPriority(id, severity as any);
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
  }
  res.json({ data: result });
}));

// POST /api/incidents/:id/verify (Workflow Verification)
router.post('/incidents/:id/verify', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const findQuery = isUuid ? { id } : { incidentId: id };
      const existing = await prisma.incident.findUnique({ where: findQuery });
      if (!existing) return null;

      const updated = await prisma.incident.update({
        where: { id: existing.id },
        data: { status: IncidentStatus.VERIFIED },
      });

      await prisma.incidentTimeline.create({
        data: {
          incidentId: existing.id,
          eventType: 'VERIFIED',
          message: `Incident verified by Field Commander.`,
        },
      });
      return updated;
    },
    () => {
      return inMemoryStore.updateIncidentStatus(id, 'VERIFIED');
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Incident ${id} not found.` } });
  }
  res.json({ data: result, message: `Incident ${id} successfully verified.` });
}));

/* ==========================================
   DEMANDS / REQUESTS ROUTING & SCHEMAS
   ========================================== */

const demandCreateSchema = z.object({
  incidentId: z.string().optional(),
  zoneName: z.string().optional(),
  affectedZone: z.string().optional(),
  itemNeeded: z.string().optional(),
  requestedType: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  affectedPeople: z.number().int().nonnegative().optional(),
  affectedCount: z.number().int().nonnegative().optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

const demandStatusSchema = z.object({
  status: z.string(),
  resourceId: z.string().optional(),
});

// GET /api/demands and /api/requests
const getDemandsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { status, priority, incidentId, limit = '50', offset = '0' } = req.query;

  const result = await tryDb(
    async () => {
      const where: any = {};
      if (status) where.status = status as DemandStatus;
      if (priority) where.priority = priority as DemandPriority;
      if (incidentId) where.incidentId = incidentId as string;

      const [demands, total] = await Promise.all([
        prisma.demandRequest.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { createdAt: 'desc' },
          include: {
            incident: { select: { incidentId: true, title: true } },
          },
        }),
        prisma.demandRequest.count({ where }),
      ]);
      return { data: demands, meta: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } };
    },
    () => {
      const list = inMemoryStore.getDemands({
        status: status as string,
        priority: priority as string,
        incidentId: incidentId as string,
      });
      return { data: list, meta: { total: list.length, limit: parseInt(limit as string), offset: 0 } };
    }
  );

  res.json(result);
});

router.get('/demands', getDemandsHandler);
router.get('/requests', getDemandsHandler);

// GET /api/demands/:id
router.get('/demands/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const demand = await prisma.demandRequest.findUnique({
        where: isUuid ? { id } : { requestId: id },
        include: {
          incident: true,
          allocations: { include: { resource: true, vehicle: true } },
        },
      });
      return demand ? { data: demand } : null;
    },
    () => {
      const d = inMemoryStore.getDemandById(id);
      return d ? { data: d } : null;
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Demand request ${id} not found.` } });
  }
  res.json(result);
}));

// POST /api/demands
router.post('/demands', asyncHandler(async (req, res) => {
  const body = demandCreateSchema.parse(req.body);

  const result = await tryDb(
    async () => {
      const count = await prisma.demandRequest.count();
      const indexStr = String(count + 101);
      const requestId = `REQ-DEL-${indexStr}`;

      const demand = await prisma.demandRequest.create({
        data: {
          requestId,
          incidentId: body.incidentId || '00000000-0000-0000-0000-000000000000',
          affectedZone: body.zoneName || body.affectedZone || 'Delhi Metro Area',
          requestedType: body.itemNeeded || body.requestedType || 'Relief Supplies',
          description: body.description || `${body.quantity} ${body.unit} required urgently.`,
          quantity: body.quantity,
          unit: body.unit,
          priority: body.priority as DemandPriority,
          status: DemandStatus.PENDING,
          affectedPeople: body.affectedPeople || body.affectedCount || 0,
        },
      });
      return demand;
    },
    () => {
      return inMemoryStore.createDemand({
        incidentId: body.incidentId,
        zoneName: body.zoneName || body.affectedZone || 'Delhi Metro Area',
        coordinates: body.coordinates || { lat: 28.6139, lng: 77.2090 },
        itemNeeded: body.itemNeeded || body.requestedType || 'Relief Supplies',
        category: body.category || 'GENERAL',
        quantity: body.quantity,
        unit: body.unit,
        priority: body.priority as any,
        affectedCount: body.affectedCount || body.affectedPeople || 100,
        status: 'PENDING',
      });
    }
  );

  res.status(201).json({ data: result });
}));

// PATCH /api/demands/:id/status
router.patch('/demands/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resourceId } = demandStatusSchema.parse(req.body);

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const findQuery = isUuid ? { id } : { requestId: id };
      const existing = await prisma.demandRequest.findUnique({ where: findQuery });
      if (!existing) return null;

      const updated = await prisma.demandRequest.update({
        where: { id: existing.id },
        data: { status: status as DemandStatus },
      });
      return updated;
    },
    () => {
      return inMemoryStore.updateDemandStatus(id, status as any, resourceId);
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Demand request ${id} not found.` } });
  }
  res.json({ data: result });
}));

/* ==========================================
   RESOURCES ROUTING & SCHEMAS
   ========================================== */

const resourceCreateSchema = z.object({
  name: z.string().min(1, 'Material name is required'),
  category: z.enum(['WATER', 'FOOD', 'MEDICAL', 'SHELTER_SUPPLIES', 'CLOTHING', 'RESCUE_EQUIPMENT', 'VEHICLES', 'OTHER']),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  locationName: z.string().min(1, 'Location name is required'),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
});

// GET /api/resources
router.get('/resources', asyncHandler(async (req, res) => {
  const { category, status, search, limit = '50', offset = '0' } = req.query;

  const result = await tryDb(
    async () => {
      const where: any = {};
      if (category) where.category = category as string;
      if (status) where.status = status as ResourceStatus;
      if (search) {
        where.OR = [
          { resourceId: { contains: search as string, mode: 'insensitive' } },
          { materialName: { contains: search as string, mode: 'insensitive' } },
          { storageDepot: { contains: search as string, mode: 'insensitive' } },
        ];
      }
      const [resources, total] = await Promise.all([
        prisma.resource.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { materialName: 'asc' },
        }),
        prisma.resource.count({ where }),
      ]);
      return { data: resources, meta: { total, limit: parseInt(limit as string), offset: parseInt(offset as string) } };
    },
    () => {
      const list = inMemoryStore.getResources({
        category: category as string,
        status: status as string,
      });
      return { data: list, meta: { total: list.length, limit: parseInt(limit as string), offset: 0 } };
    }
  );

  res.json(result);
}));

// GET /api/resources/:id
router.get('/resources/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const resource = await prisma.resource.findUnique({
        where: isUuid ? { id } : { resourceId: id },
        include: { movements: true, allocations: true },
      });
      return resource ? { data: resource } : null;
    },
    () => {
      const r = inMemoryStore.getResourceById(id);
      return r ? { data: r } : null;
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Resource ${id} not found.` } });
  }
  res.json(result);
}));

// POST /api/resources
router.post('/resources', asyncHandler(async (req, res) => {
  const body = resourceCreateSchema.parse(req.body);

  const result = await tryDb(
    async () => {
      const count = await prisma.resource.count();
      const resourceId = `RES-NCR-${String(count + 1).padStart(3, '0')}`;
      const resource = await prisma.resource.create({
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
          status: ResourceStatus.AVAILABLE,
        },
      });
      return resource;
    },
    () => {
      return inMemoryStore.createResource({
        name: body.name,
        category: body.category as any,
        quantity: body.quantity,
        allocatedQuantity: 0,
        unit: body.unit,
        locationName: body.locationName,
        coordinates: body.coordinates || { lat: 28.6139, lng: 77.2090 },
        status: 'AVAILABLE',
        contactPerson: body.contactPerson || 'Depot In-Charge',
        contactNumber: body.contactNumber || '+91-98000-11111',
      });
    }
  );

  res.status(201).json({ data: result });
}));

/* ==========================================
   RESPONDERS & PERSONNEL ROUTING
   ========================================== */

const responderCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['INCIDENT_COMMANDER', 'LOGISTICS_OFFICER', 'PARAMEDIC', 'BOATMASTER', 'PILOT', 'FIELD_RESCUER']),
  agency: z.string().min(1, 'Agency is required'),
  contactRadio: z.string().min(1, 'Radio frequency is required'),
  contactPhone: z.string().min(1, 'Phone number is required'),
  status: z.enum(['ON_DUTY', 'ON_MISSION', 'STANDBY', 'OFF_DUTY']).default('ON_DUTY'),
  assignedUnit: z.string().optional(),
});

// GET /api/responders
router.get('/responders', asyncHandler(async (req, res) => {
  const { status, role } = req.query;
  const list = inMemoryStore.getResponders({
    status: status as string,
    role: role as string,
  });
  res.json({ data: list, meta: { total: list.length } });
}));

// GET /api/responders/:id
router.get('/responders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rsp = inMemoryStore.getResponderById(id);
  if (!rsp) return res.status(404).json({ error: { message: `Responder ${id} not found.` } });
  res.json({ data: rsp });
}));

// POST /api/responders
router.post('/responders', asyncHandler(async (req, res) => {
  const body = responderCreateSchema.parse(req.body);
  const rsp = inMemoryStore.createResponder(body as any);
  res.status(201).json({ data: rsp });
}));

// PATCH /api/responders/:id/status
router.patch('/responders/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = z.object({ status: z.enum(['ON_DUTY', 'ON_MISSION', 'STANDBY', 'OFF_DUTY']) }).parse(req.body);
  const rsp = inMemoryStore.updateResponderStatus(id, status);
  if (!rsp) return res.status(404).json({ error: { message: `Responder ${id} not found.` } });
  res.json({ data: rsp });
}));

/* ==========================================
   VEHICLES ROUTING & SCHEMAS
   ========================================== */

const vehicleCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['TRUCK', 'AMBULANCE', 'HELICOPTER', 'RESCUE_BOAT', 'DRONE', 'SUV']),
  capacity: z.string().min(1, 'Capacity is required'),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.AVAILABLE),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  driverName: z.string().min(1, 'Driver name is required'),
  driverContact: z.string().min(1, 'Driver contact is required'),
  teamName: z.string().optional(),
});

// GET /api/vehicles
router.get('/vehicles', asyncHandler(async (req, res) => {
  const { status, type } = req.query;

  const result = await tryDb(
    async () => {
      const where: any = {};
      if (status) where.status = status as VehicleStatus;
      if (type) where.type = type as string;
      const [vehicles, total] = await Promise.all([
        prisma.vehicle.findMany({ where, orderBy: { vehicleId: 'asc' } }),
        prisma.vehicle.count({ where }),
      ]);
      return { data: vehicles, meta: { total } };
    },
    () => {
      const list = inMemoryStore.getVehicles({
        status: status as string,
        type: type as string,
      });
      return { data: list, meta: { total: list.length } };
    }
  );

  res.json(result);
}));

// GET /api/vehicles/:id
router.get('/vehicles/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await tryDb(
    async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const vehicle = await prisma.vehicle.findUnique({
        where: isUuid ? { id } : { vehicleId: id },
        include: { locations: true, dispatches: true },
      });
      return vehicle ? { data: vehicle } : null;
    },
    () => {
      const v = inMemoryStore.getVehicleById(id);
      return v ? { data: v } : null;
    }
  );

  if (!result) {
    return res.status(404).json({ error: { message: `Vehicle ${id} not found.` } });
  }
  res.json(result);
}));

// POST /api/vehicles
router.post('/vehicles', asyncHandler(async (req, res) => {
  const body = vehicleCreateSchema.parse(req.body);
  const veh = inMemoryStore.createVehicle({
    ...body,
    location: body.location || { lat: 28.6139, lng: 77.2090 },
  } as any);
  res.status(201).json({ data: veh });
}));

// PATCH /api/vehicles/:id/status
router.patch('/api/vehicles/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = z.object({ status: z.string() }).parse(req.body);
  const veh = inMemoryStore.updateVehicleStatus(id, status as any);
  if (!veh) return res.status(404).json({ error: { message: `Vehicle ${id} not found.` } });
  res.json({ data: veh });
}));

// PATCH /api/vehicles/:id/location
router.patch('/vehicles/:id/location', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { coordinates, speedKmh } = z.object({
    coordinates: z.object({ lat: z.number(), lng: z.number() }),
    speedKmh: z.number().optional(),
  }).parse(req.body);

  const veh = inMemoryStore.updateVehicleLocation(id, coordinates, speedKmh);
  if (!veh) return res.status(404).json({ error: { message: `Vehicle ${id} not found.` } });
  res.json({ data: veh });
}));

/* ==========================================
   MISSIONS & DISPATCH ROUTING
   ========================================== */

const missionCreateSchema = z.object({
  requestId: z.string().min(1, 'Demand request ID is required'),
  vehicleId: z.string().min(1, 'Vehicle ID is required'),
  operatorName: z.string().optional(),
});

const missionStatusSchema = z.object({
  status: z.enum(['PLANNED', 'AWAITING_DISPATCH', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'DELIVERING', 'DELIVERED', 'CANCELLED', 'FAILED']),
});

// GET /api/missions
router.get('/missions', asyncHandler(async (req, res) => {
  const { status, vehicleId, requestId } = req.query;
  const list = inMemoryStore.getMissions({
    status: status as string,
    vehicleId: vehicleId as string,
    requestId: requestId as string,
  });
  res.json({ data: list, meta: { total: list.length } });
}));

// GET /api/missions/:id
router.get('/missions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mis = inMemoryStore.getMissionById(id);
  if (!mis) return res.status(404).json({ error: { message: `Mission ${id} not found.` } });
  res.json({ data: mis });
}));

// POST /api/missions (Dispatch Workflow)
router.post('/missions', asyncHandler(async (req, res) => {
  const body = missionCreateSchema.parse(req.body);
  const mis = inMemoryStore.createMission(body);
  res.status(201).json({ data: mis });
}));

// PATCH /api/missions/:id/status (Workflow Mission Telemetry Update)
router.patch('/missions/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = missionStatusSchema.parse(req.body);
  const mis = inMemoryStore.updateMissionStatus(id, status as any);
  if (!mis) return res.status(404).json({ error: { message: `Mission ${id} not found.` } });
  res.json({ data: mis });
}));

// POST /api/missions/:id/deliver & /api/deliveries/:id/verify (Workflow Delivery Reconciliation)
const verifyDeliveryHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { verifierName } = z.object({ verifierName: z.string().optional() }).parse(req.body);
  const result = inMemoryStore.verifyDelivery(id, verifierName);
  if (!result) return res.status(404).json({ error: { message: `Mission or Delivery ${id} not found.` } });
  res.json({ data: result, message: `Delivery for mission ${id} successfully verified and reconciled.` });
});

router.post('/missions/:id/deliver', verifyDeliveryHandler);
router.post('/deliveries/:id/verify', verifyDeliveryHandler);

// GET /api/deliveries
router.get('/deliveries', asyncHandler(async (req, res) => {
  const missions = inMemoryStore.getMissions();
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
  const list = inMemoryStore.getRoutes();
  res.json({ data: list, meta: { total: list.length } });
}));

// GET /api/routes/:id
router.get('/routes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rte = inMemoryStore.getRouteById(id);
  if (!rte) return res.status(404).json({ error: { message: `Route ${id} not found.` } });
  res.json({ data: rte });
}));

// POST /api/routes/calculate
router.post('/routes/calculate', asyncHandler(async (req, res) => {
  const { origin, destination } = z.object({
    origin: z.object({ lat: z.number(), lng: z.number() }),
    destination: z.object({ lat: z.number(), lng: z.number() }),
  }).parse(req.body);

  const route = inMemoryStore.calculateRoute(origin, destination);
  res.json({ data: route });
}));

/* ==========================================
   SHELTERS ROUTING & SCHEMAS
   ========================================== */

const shelterCreateSchema = z.object({
  name: z.string().min(1, 'Shelter name is required'),
  locationName: z.string().min(1, 'Location name is required'),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  capacityTotal: z.number().int().positive(),
  capacityOccupied: z.number().int().nonnegative().default(0),
  status: z.enum(['OPEN', 'FULL', 'CLOSED']).default('OPEN'),
  contactPerson: z.string().optional(),
  contactNumber: z.string().optional(),
  resourcesAvailable: z.array(z.string()).optional(),
});

// GET /api/shelters
router.get('/shelters', asyncHandler(async (req, res) => {
  const list = inMemoryStore.getShelters();
  res.json({ data: list, meta: { total: list.length } });
}));

// GET /api/shelters/:id
router.get('/shelters/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shl = inMemoryStore.getShelterById(id);
  if (!shl) return res.status(404).json({ error: { message: `Shelter ${id} not found.` } });
  res.json({ data: shl });
}));

// POST /api/shelters
router.post('/shelters', asyncHandler(async (req, res) => {
  const body = shelterCreateSchema.parse(req.body);
  const shl = inMemoryStore.createShelter({
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
  const { occupiedCount } = z.object({ occupiedCount: z.number().int().nonnegative() }).parse(req.body);
  const shl = inMemoryStore.updateShelterOccupancy(id, occupiedCount);
  if (!shl) return res.status(404).json({ error: { message: `Shelter ${id} not found.` } });
  res.json({ data: shl });
}));

/* ==========================================
   ALERTS ROUTING & SCHEMAS
   ========================================== */

const alertCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.enum(['DEMAND', 'RESOURCE', 'SHELTER', 'MISSION', 'INCIDENT', 'SYSTEM']),
  actionPath: z.string().optional(),
});

// GET /api/alerts
router.get('/alerts', asyncHandler(async (req, res) => {
  const list = inMemoryStore.getAlerts();
  res.json({ data: list, meta: { total: list.length } });
}));

// POST /api/alerts
router.post('/alerts', asyncHandler(async (req, res) => {
  const body = alertCreateSchema.parse(req.body);
  const alt = inMemoryStore.createAlert(body);
  res.status(201).json({ data: alt });
}));

// PATCH /api/alerts/:id/resolve
router.patch('/alerts/:id/resolve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const alt = inMemoryStore.resolveAlert(id);
  if (!alt) return res.status(404).json({ error: { message: `Alert ${id} not found.` } });
  res.json({ data: alt });
}));

/* ==========================================
   AUDIT LOGS & EVENTS ROUTING
   ========================================== */

const auditCreateSchema = z.object({
  actor: z.string().min(1, 'Actor is required'),
  action: z.string().min(1, 'Action is required'),
  target: z.string().min(1, 'Target is required'),
  result: z.string().min(1, 'Result is required'),
  type: z.enum(['VERIFY', 'PRIORITIZE', 'MATCH', 'ALLOCATE', 'DISPATCH', 'DELIVERY', 'RESOLVE', 'SYSTEM', 'AUTH']),
  metadata: z.record(z.any()).optional(),
});

const getAuditHandler = asyncHandler(async (req: Request, res: Response) => {
  const list = inMemoryStore.getAuditEvents();
  res.json({ data: list, meta: { total: list.length } });
});

router.get('/audit-events', getAuditHandler);
router.get('/audit-logs', getAuditHandler);

router.post('/audit-events', asyncHandler(async (req, res) => {
  const body = auditCreateSchema.parse(req.body);
  const ev = inMemoryStore.logAuditEvent(body);
  res.status(201).json({ data: ev });
}));

/* ==========================================
   DEMO RESET ENDPOINT
   ========================================== */

router.post('/demo/reset', asyncHandler(async (req, res) => {
  inMemoryStore.reset();
  res.json({
    status: 'success',
    message: 'Operational demo state reset successfully to baseline Delhi NCR scenarios.',
  });
}));

export { router as apiRouter };
