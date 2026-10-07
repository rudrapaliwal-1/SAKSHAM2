"use strict";
/**
 * SAKSHAM In-Memory Deterministic Operational Store
 * ──────────────────────────────────────────────────
 * Provides full deterministic data store for all 11 core domain entities:
 * Incident, DemandRequest, Resource, ResourceAllocation, Responder,
 * Vehicle, Mission, Location, Route, Alert, AuditEvent.
 *
 * Automatically seeds realistic Delhi NCR scenarios and logs audit events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.inMemoryStore = void 0;
function createInitialState() {
    const now = Date.now();
    const incidents = [
        {
            id: 'INC-2026-101',
            type: 'FLOOD',
            severity: 'CRITICAL',
            location: 'Yamuna Riverbank & Kashmiri Gate Ghats, North Delhi',
            coordinates: { lat: 28.6692, lng: 77.2315 },
            time: new Date(now - 45 * 60000).toISOString(),
            status: 'UNDER_RESPONSE',
            assignedTeam: 'NDRF Unit 8 (Battalion 4)',
            description: 'Yamuna water level crossed danger mark (208.66m). Embankment overflow submerged slums and transport hub.',
            reporterName: 'Inspector Rajesh Verma (Delhi Police)',
            reporterContact: '+91-98110-44210',
            casualtiesCount: 0,
            displacedCount: 1450,
            reportedAt: new Date(now - 45 * 60000).toISOString(),
            updatedAt: new Date(now - 10 * 60000).toISOString(),
            source: 'NORTH COMMAND DESK',
            peopleAffected: 3200,
            requiredResources: [
                { itemNeeded: 'Drinking Water (15L Cans)', quantity: 5000, unit: 'Liters', priority: 'CRITICAL' },
                { itemNeeded: 'Motorized Inflatable Rescue Boats', quantity: 4, unit: 'Boats', priority: 'CRITICAL' },
                { itemNeeded: 'Emergency Dry Rations', quantity: 2000, unit: 'Packets', priority: 'HIGH' }
            ],
            timeline: [
                { time: '18:15', title: 'INCIDENT REPORTED', description: 'Civilian & police calls confirmed breach of Yamuna embankment.', actor: 'System SOS' },
                { time: '18:25', title: 'INCIDENT VERIFIED', description: 'Reconnaissance confirmed flooding in Kashmiri Gate Ring Road pocket.', actor: 'Insp. R. Verma' },
                { time: '18:32', title: 'PRIORITY ASSIGNED', description: 'Severity escalated to CRITICAL due to rapid water ingress.', actor: 'Duty Commander' },
                { time: '18:45', title: 'UNITS DISPATCHED', description: 'Logistics vehicle VEH-BOT-302 and rescue team dispatched from Geeta Colony.', actor: 'Logistics Desk' }
            ]
        },
        {
            id: 'INC-2026-102',
            type: 'STRUCTURAL_COLLAPSE',
            severity: 'CRITICAL',
            location: 'Okhla Industrial Area Phase-II, South-East Delhi',
            coordinates: { lat: 28.5355, lng: 77.2732 },
            time: new Date(now - 75 * 60000).toISOString(),
            status: 'RESOURCE_MATCHED',
            assignedTeam: 'Delhi Fire Service & Disaster Response 3',
            description: '3-story industrial warehouse building collapsed during foundation reinforcement. Multiple workers trapped under concrete slabs.',
            reporterName: 'Supervisor Sunita Negi (Okhla Industrial Association)',
            reporterContact: '+91-98711-20988',
            casualtiesCount: 4,
            displacedCount: 80,
            reportedAt: new Date(now - 75 * 60000).toISOString(),
            updatedAt: new Date(now - 15 * 60000).toISOString(),
            source: 'DFS EMERGENCY DISPATCH',
            peopleAffected: 120,
            requiredResources: [
                { itemNeeded: 'Advanced Trauma Triage Kits', quantity: 80, unit: 'Kits', priority: 'CRITICAL' },
                { itemNeeded: 'Heavy Hydraulic Cutters & Spreaders', quantity: 6, unit: 'Sets', priority: 'CRITICAL' }
            ],
            timeline: [
                { time: '17:45', title: 'INCIDENT REPORTED', description: 'Emergency call received reporting structure collapse at Plot 44-B Okhla Phase II.', actor: 'DFS Dispatch' },
                { time: '17:52', title: 'INCIDENT VERIFIED', description: 'PCR van confirmed heavy debris with trapped personnel.', actor: 'Field PCR' },
                { time: '18:05', title: 'RESOURCE MATCHED', description: 'Matched trauma kits from AIIMS Disaster Depot.', actor: 'Matching Engine' }
            ]
        },
        {
            id: 'INC-2026-103',
            type: 'FLOOD',
            severity: 'HIGH',
            location: 'Mayur Vihar Extension & Yamuna Khadar, East Delhi',
            coordinates: { lat: 28.5910, lng: 77.2980 },
            time: new Date(now - 110 * 60000).toISOString(),
            status: 'PRIORITIZED',
            assignedTeam: 'Civil Defence Quick Reaction Force 2',
            description: 'Backflow in stormwater drain caused inundation of farm settlements. 300+ families evacuated.',
            reporterName: 'Ward Councillor Manoj Sharma',
            reporterContact: '+91-99580-33120',
            casualtiesCount: 0,
            displacedCount: 650,
            reportedAt: new Date(now - 110 * 60000).toISOString(),
            updatedAt: new Date(now - 30 * 60000).toISOString(),
            source: 'DISTRICT MAGISTRATE (EAST)',
            peopleAffected: 950,
            requiredResources: [
                { itemNeeded: 'Emergency Dry Rations', quantity: 1200, unit: 'Packets', priority: 'HIGH' }
            ],
            timeline: [
                { time: '17:10', title: 'INCIDENT REPORTED', description: 'Flood wardens reported water ingress in low-lying shelters.', actor: 'Ward Warden' },
                { time: '17:30', title: 'PRIORITY ASSIGNED', description: 'Assigned HIGH severity for ration mobilization.', actor: 'DM East' }
            ]
        }
    ];
    const demands = [
        {
            id: 'DEM-2026-101',
            incidentId: 'INC-2026-101',
            zoneName: 'Kashmiri Gate Flood Relief Area',
            coordinates: { lat: 28.6692, lng: 77.2315 },
            itemNeeded: 'Drinking Water (15L Cans)',
            category: 'WATER',
            quantity: 5000,
            unit: 'Liters',
            priority: 'CRITICAL',
            affectedCount: 1450,
            status: 'PENDING',
            requestedAt: new Date(now - 40 * 60000).toISOString()
        },
        {
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
            status: 'ALLOCATED',
            allocatedResourceId: 'RES-NCR-003',
            allocatedVehicleId: 'VEH-AMB-204',
            eta: '~14 mins',
            requestedAt: new Date(now - 70 * 60000).toISOString()
        },
        {
            id: 'DEM-2026-103',
            incidentId: 'INC-2026-103',
            zoneName: 'Mayur Vihar Extension Relief Camp',
            coordinates: { lat: 28.5910, lng: 77.2980 },
            itemNeeded: 'Emergency Dry Rations',
            category: 'FOOD',
            quantity: 1200,
            unit: 'Packets',
            priority: 'HIGH',
            affectedCount: 650,
            status: 'PENDING',
            requestedAt: new Date(now - 95 * 60000).toISOString()
        },
        {
            id: 'DEM-2026-104',
            incidentId: 'INC-2026-101',
            zoneName: 'Rohini Sector 15 Transit Shelter',
            coordinates: { lat: 28.7180, lng: 77.1290 },
            itemNeeded: 'Disaster Thermal Blankets',
            category: 'CLOTHING',
            quantity: 400,
            unit: 'Units',
            priority: 'HIGH',
            affectedCount: 420,
            status: 'DISPATCHED',
            allocatedResourceId: 'RES-NCR-004',
            allocatedVehicleId: 'VEH-TRK-101',
            eta: '~18 mins',
            requestedAt: new Date(now - 130 * 60000).toISOString()
        }
    ];
    const resources = [
        {
            id: 'RES-NCR-001',
            name: 'Drinking Water (15L Cans & Bottled Water)',
            category: 'WATER',
            quantity: 18000,
            allocatedQuantity: 5000,
            unit: 'Liters',
            locationName: 'Central NDRF Logistics Depot, Dwarka Sector 8',
            coordinates: { lat: 28.5720, lng: 77.0680 },
            status: 'AVAILABLE',
            lastUpdated: new Date(now - 25 * 60000).toISOString(),
            contactPerson: 'Cmdt. R. K. Meena',
            contactNumber: '+91-98101-55440'
        },
        {
            id: 'RES-NCR-002',
            name: 'Emergency Dry Rations (Ready to Eat Meals)',
            category: 'FOOD',
            quantity: 6500,
            allocatedQuantity: 1200,
            unit: 'Packets',
            locationName: 'Food Corporation of India Storage Hub, Okhla Phase II',
            coordinates: { lat: 28.5380, lng: 77.2710 },
            status: 'AVAILABLE',
            lastUpdated: new Date(now - 40 * 60000).toISOString(),
            contactPerson: 'S. K. Gupta (Depot Manager)',
            contactNumber: '+91-98711-44332'
        },
        {
            id: 'RES-NCR-003',
            name: 'Advanced Trauma Triage Kits',
            category: 'MEDICAL',
            quantity: 140,
            allocatedQuantity: 80,
            unit: 'Kits',
            locationName: 'AIIMS Disaster Stockpile & Emergency Center, Safdarjung',
            coordinates: { lat: 28.5672, lng: 77.2100 },
            status: 'AVAILABLE',
            lastUpdated: new Date(now - 15 * 60000).toISOString(),
            contactPerson: 'Dr. Vivek Bhattacharya',
            contactNumber: '+91-98100-99881'
        },
        {
            id: 'RES-NCR-004',
            name: 'Disaster Thermal Blankets',
            category: 'CLOTHING',
            quantity: 2400,
            allocatedQuantity: 400,
            unit: 'Units',
            locationName: 'Indian Red Cross National Logistics Depot, Golf Links',
            coordinates: { lat: 28.5980, lng: 77.2340 },
            status: 'AVAILABLE',
            lastUpdated: new Date(now - 50 * 60000).toISOString(),
            contactPerson: 'Pooja Anand (Logistics Officer)',
            contactNumber: '+91-99102-33211'
        },
        {
            id: 'RES-NCR-005',
            name: 'Motorized Inflatable Rescue Boats',
            category: 'RESCUE_EQUIPMENT',
            quantity: 8,
            allocatedQuantity: 4,
            unit: 'Boats',
            locationName: 'Yamuna Disaster Response Station, Geeta Colony',
            coordinates: { lat: 28.6490, lng: 77.2710 },
            status: 'AVAILABLE',
            lastUpdated: new Date(now - 30 * 60000).toISOString(),
            contactPerson: 'Sub-Insp. Mohan Lal',
            contactNumber: '+91-98110-88776'
        }
    ];
    const allocations = [
        {
            id: 'ALLOC-2026-001',
            demandId: 'DEM-2026-102',
            resourceId: 'RES-NCR-003',
            quantity: 80,
            vehicleId: 'VEH-AMB-204',
            matchScore: 94.2,
            status: 'APPROVED',
            reasoning: [
                'Full stock available at AIIMS Safdarjung Depot.',
                'Short distance: 6.8 km to Okhla collapse site.',
                'Priority alignment: Critical demand matched to emergency medical stock.'
            ],
            approvedBy: 'Dr. Vivek Bhattacharya',
            approvedAt: new Date(now - 60 * 60000).toISOString(),
            createdAt: new Date(now - 65 * 60000).toISOString()
        }
    ];
    const responders = [
        {
            id: 'RSP-001',
            name: 'Havildar Rajesh Tanwar',
            role: 'LOGISTICS_OFFICER',
            agency: 'NDRF Battalion 8',
            contactRadio: 'NDRF-CH-4',
            contactPhone: '+91-98710-11223',
            status: 'ON_MISSION',
            assignedUnit: 'VEH-TRK-101',
            assignedMissionId: 'DSP-DEL-041'
        },
        {
            id: 'RSP-002',
            name: 'Dr. Neha Verma',
            role: 'PARAMEDIC',
            agency: 'Delhi Emergency Medical Services',
            contactRadio: 'EMS-ALPHA-1',
            contactPhone: '+91-98103-99882',
            status: 'ON_MISSION',
            assignedUnit: 'VEH-AMB-204',
            assignedMissionId: 'DSP-DEL-042'
        },
        {
            id: 'RSP-003',
            name: 'Sgt. Rakesh Kumar',
            role: 'BOATMASTER',
            agency: 'NDRF Water Rescue Wing',
            contactRadio: 'NDRF-MARINE-2',
            contactPhone: '+91-98110-33441',
            status: 'ON_MISSION',
            assignedUnit: 'VEH-BOT-302',
            assignedMissionId: 'DSP-DEL-043'
        }
    ];
    const vehicles = [
        {
            id: 'VEH-TRK-101',
            name: 'Heavy Logistics Truck 101',
            type: 'TRUCK',
            capacity: '10 Tons (8,000 Units)',
            status: 'EN_ROUTE',
            location: { lat: 28.6500, lng: 77.1800 },
            destination: { lat: 28.7180, lng: 77.1290 },
            cargo: '400 Disaster Thermal Blankets',
            driverName: 'Havildar Rajesh Tanwar',
            driverContact: '+91-98710-11223',
            speedKmh: 48,
            incidentId: 'INC-2026-101',
            etaMinutes: 18,
            teamName: 'LOGISTICS-ALPHA'
        },
        {
            id: 'VEH-AMB-204',
            name: 'Advanced Life Support Ambulance 204',
            type: 'AMBULANCE',
            capacity: '4 Patients + Triage Kits',
            status: 'DISPATCHED',
            location: { lat: 28.5672, lng: 77.2100 },
            destination: { lat: 28.5355, lng: 77.2732 },
            cargo: '80 Advanced Trauma Triage Kits',
            driverName: 'Dr. Neha Verma',
            driverContact: '+91-98103-99882',
            speedKmh: 55,
            incidentId: 'INC-2026-102',
            etaMinutes: 14,
            teamName: 'MEDICAL-BRAVO'
        },
        {
            id: 'VEH-BOT-302',
            name: 'Motorized Flood Rescue Boat 302',
            type: 'RESCUE_BOAT',
            capacity: '12 Persons + 500 Kg Supplies',
            status: 'EN_ROUTE',
            location: { lat: 28.6580, lng: 77.2550 },
            destination: { lat: 28.6692, lng: 77.2315 },
            cargo: 'Search & Inundation Evacuation Gear',
            driverName: 'Sgt. Rakesh Kumar',
            driverContact: '+91-98110-33441',
            speedKmh: 28,
            incidentId: 'INC-2026-101',
            etaMinutes: 8,
            teamName: 'WATER-RESCUE-CHARLIE'
        },
        {
            id: 'VEH-DRN-401',
            name: 'Aerial Recon & Medical Drone 401',
            type: 'DRONE',
            capacity: '15 Kg Emergency Payload',
            status: 'AVAILABLE',
            location: { lat: 28.6304, lng: 77.2177 },
            driverName: 'Drone Pilot Sanjay Mehta',
            driverContact: '+91-98991-22334',
            speedKmh: 0,
            teamName: 'RECON-DELTA'
        }
    ];
    const missions = [
        {
            id: 'DSP-DEL-041',
            requestId: 'DEM-2026-104',
            vehicleId: 'VEH-TRK-101',
            status: 'EN_ROUTE',
            destinationName: 'Rohini Sector 15 Transit Shelter',
            resourceType: 'Disaster Thermal Blankets',
            quantity: 400,
            unit: 'Units',
            etaMinutes: 18,
            operatorName: 'Havildar Rajesh Tanwar',
            speedKmh: 48,
            distanceKm: 14.2,
            signalStrength: 94,
            fuelPct: 82,
            trafficLevel: 'MODERATE',
            routePath: ['Golf Links Depot', 'Ring Road Bypass', 'Outer Ring Road', 'Rohini Sec 15'],
            alertMessage: 'Alternate route active via Inner Ring Road.',
            timeline: [
                { time: '17:15', title: 'MISSION ASSIGNED', done: true },
                { time: '17:25', title: 'DEPOT PICKUP COMPLETED', done: true },
                { time: '17:35', title: 'DISPATCHED & EN ROUTE', done: true },
                { time: '17:53', title: 'ESTIMATED ARRIVAL', done: false }
            ]
        },
        {
            id: 'DSP-DEL-042',
            requestId: 'DEM-2026-102',
            vehicleId: 'VEH-AMB-204',
            status: 'DISPATCHED',
            destinationName: 'Okhla Phase II Structural Collapse Site',
            resourceType: 'Advanced Trauma Triage Kits',
            quantity: 80,
            unit: 'Kits',
            etaMinutes: 14,
            operatorName: 'Dr. Neha Verma',
            speedKmh: 55,
            distanceKm: 11.5,
            signalStrength: 98,
            fuelPct: 91,
            trafficLevel: 'LOW',
            routePath: ['AIIMS Safdarjung', 'Barapullah Corridor', 'Okhla Phase II'],
            timeline: [
                { time: '17:30', title: 'MISSION ASSIGNED', done: true },
                { time: '17:38', title: 'CARGO LOADED & VERIFIED', done: true },
                { time: '17:42', title: 'SIREN DISPATCH CONFIRMED', done: true },
                { time: '17:56', title: 'ESTIMATED ARRIVAL', done: false }
            ]
        }
    ];
    const routes = [
        {
            id: 'RTE-DEL-01',
            origin: { lat: 28.5980, lng: 77.2340 },
            destination: { lat: 28.7180, lng: 77.1290 },
            originName: 'Red Cross Golf Links Depot',
            destinationName: 'Rohini Sector 15 Shelter',
            distanceKm: 14.2,
            estimatedMinutes: 18,
            waypoints: [
                { name: 'Golf Links Hub', coordinates: { lat: 28.5980, lng: 77.2340 }, reached: true },
                { name: 'Ring Road Interchange', coordinates: { lat: 28.6500, lng: 77.1800 }, reached: true },
                { name: 'Rohini Sector 15 Drop Zone', coordinates: { lat: 28.7180, lng: 77.1290 }, reached: false }
            ],
            pathCoordinates: [
                { lat: 28.5980, lng: 77.2340 },
                { lat: 28.6250, lng: 77.2100 },
                { lat: 28.6500, lng: 77.1800 },
                { lat: 28.6900, lng: 77.1450 },
                { lat: 28.7180, lng: 77.1290 }
            ],
            trafficStatus: 'MODERATE'
        }
    ];
    const alerts = [
        {
            id: 'ALT-001',
            title: 'CRITICAL DEMAND UNFULFILLED',
            message: '5,000 Liters of Drinking Water required urgently at Kashmiri Gate Flood Relief Area.',
            severity: 'CRITICAL',
            timestamp: new Date(now - 40 * 60000).toISOString(),
            category: 'DEMAND',
            actionPath: '/operations/matching?requestId=DEM-2026-101'
        },
        {
            id: 'ALT-002',
            title: 'SHELTER CAPACITY NEAR THRESHOLD',
            message: 'Akshardham Mega Relief Center is at 90% occupancy (1,080/1,200 beds).',
            severity: 'HIGH',
            timestamp: new Date(now - 20 * 60000).toISOString(),
            category: 'SHELTER',
            actionPath: '/operations/shelters'
        }
    ];
    const auditEvents = [
        {
            id: 'LOG-001',
            timestamp: new Date(now - 5 * 60000).toISOString(),
            actor: 'Officer S. Prasad (Command Desk)',
            action: 'Verified Ground Delivery',
            target: 'DEL-2026-081 (400 Blankets)',
            result: 'Status -> VERIFIED · Demand DEM-2026-104 Fulfilled',
            type: 'DELIVERY'
        },
        {
            id: 'LOG-002',
            timestamp: new Date(now - 18 * 60000).toISOString(),
            actor: 'Logistics Coord. Vikram Seth',
            action: 'Dispatched Fleet Unit',
            target: 'VEH-TRK-101 -> Rohini Sector 15 Shelter',
            result: 'Mission DSP-DEL-041 En Route (ETA 18 min)',
            type: 'DISPATCH'
        },
        {
            id: 'LOG-003',
            timestamp: new Date(now - 32 * 60000).toISOString(),
            actor: 'Duty Officer Meenakshi Rao',
            action: 'Approved Allocation',
            target: 'DEM-2026-102 (Trauma Kits) -> RES-NCR-003',
            result: '80 Units Reserved from AIIMS Stockpile',
            type: 'MATCH'
        }
    ];
    const shelters = [
        {
            id: 'SHL-DEL-01',
            name: 'Akshardham Mega Relief Center',
            locationName: 'CWG Village Grounds, Mayur Vihar Phase 1',
            coordinates: { lat: 28.6120, lng: 77.2770 },
            capacityTotal: 1200,
            capacityOccupied: 1080,
            status: 'FULL',
            contactPerson: 'ADM Ritu Malhotra',
            contactNumber: '+91-98110-77112',
            resourcesAvailable: ['Safe Water', 'Medical Triage', 'Hot Meals', 'Child Care']
        },
        {
            id: 'SHL-DEL-02',
            name: 'Dwarka Indoor Disaster Transit Complex',
            locationName: 'Sector 10 DDA Sports Complex, Dwarka',
            coordinates: { lat: 28.5820, lng: 77.0580 },
            capacityTotal: 800,
            capacityOccupied: 320,
            status: 'OPEN',
            contactPerson: 'Capt. Sunil Nair',
            contactNumber: '+91-98711-66221',
            resourcesAvailable: ['Safe Water', 'Bedding', 'Sanitation', 'Solar Power Backup']
        }
    ];
    return {
        incidents,
        demands,
        resources,
        allocations,
        responders,
        vehicles,
        missions,
        routes,
        alerts,
        auditEvents,
        shelters
    };
}
class InMemoryStore {
    state;
    constructor() {
        this.state = createInitialState();
    }
    reset() {
        this.state = createInitialState();
    }
    getState() {
        return this.state;
    }
    // ── Incidents ─────────────────────────────────────────────────────────────
    getIncidents(params) {
        let list = [...this.state.incidents];
        if (params?.status)
            list = list.filter(i => i.status === params.status);
        if (params?.severity)
            list = list.filter(i => i.severity === params.severity);
        if (params?.search) {
            const q = params.search.toLowerCase();
            list = list.filter(i => i.id.toLowerCase().includes(q) ||
                i.location.toLowerCase().includes(q) ||
                i.description.toLowerCase().includes(q) ||
                i.type.toLowerCase().includes(q));
        }
        return list;
    }
    getIncidentById(id) {
        return this.state.incidents.find(i => i.id === id);
    }
    createIncident(data) {
        const id = `INC-2026-${Math.floor(Math.random() * 800) + 200}`;
        const now = new Date().toISOString();
        const newInc = {
            id,
            time: now,
            reportedAt: now,
            updatedAt: now,
            timeline: [
                {
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    title: 'INCIDENT REGISTERED',
                    description: `Logged via Central API intake: ${data.type} at ${data.location}.`,
                    actor: data.reporterName || 'API Client'
                }
            ],
            ...data
        };
        this.state.incidents.unshift(newInc);
        this.logAuditEvent({
            actor: data.reporterName || 'System Officer',
            action: 'Incident Created',
            target: `${id} (${data.type})`,
            result: `Severity: ${data.severity} at ${data.location}`,
            type: 'SYSTEM'
        });
        return newInc;
    }
    updateIncidentStatus(id, status) {
        const inc = this.getIncidentById(id);
        if (!inc)
            return undefined;
        inc.status = status;
        inc.updatedAt = new Date().toISOString();
        inc.timeline?.push({
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            title: 'STATUS UPDATE',
            description: `Incident status transitioned to ${status}.`,
            actor: 'Command Officer'
        });
        this.logAuditEvent({
            actor: 'Command Officer',
            action: 'Incident Status Transitioned',
            target: id,
            result: `Status -> ${status}`,
            type: status === 'VERIFIED' ? 'VERIFY' : status === 'RESOLVED' ? 'RESOLVE' : 'SYSTEM'
        });
        return inc;
    }
    updateIncidentPriority(id, severity) {
        const inc = this.getIncidentById(id);
        if (!inc)
            return undefined;
        inc.severity = severity;
        inc.status = 'PRIORITIZED';
        inc.updatedAt = new Date().toISOString();
        inc.timeline?.push({
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            title: 'PRIORITY ASSIGNED',
            description: `Incident severity escalated to ${severity}.`,
            actor: 'Response Director'
        });
        this.logAuditEvent({
            actor: 'Response Director',
            action: 'Priority Escalated',
            target: id,
            result: `Severity -> ${severity}`,
            type: 'PRIORITIZE'
        });
        return inc;
    }
    // ── Demands ───────────────────────────────────────────────────────────────
    getDemands(params) {
        let list = [...this.state.demands];
        if (params?.status)
            list = list.filter(d => d.status === params.status);
        if (params?.priority)
            list = list.filter(d => d.priority === params.priority);
        if (params?.incidentId)
            list = list.filter(d => d.incidentId === params.incidentId);
        return list;
    }
    getDemandById(id) {
        return this.state.demands.find(d => d.id === id);
    }
    createDemand(data) {
        const id = `DEM-2026-${Math.floor(Math.random() * 800) + 200}`;
        const newDem = {
            id,
            requestedAt: new Date().toISOString(),
            ...data
        };
        this.state.demands.unshift(newDem);
        this.logAuditEvent({
            actor: 'Relief Coordinator',
            action: 'Demand Request Registered',
            target: `${id} (${data.quantity} ${data.unit} ${data.itemNeeded})`,
            result: `Priority: ${data.priority} at ${data.zoneName}`,
            type: 'SYSTEM'
        });
        return newDem;
    }
    updateDemandStatus(id, status, resourceId) {
        const dem = this.getDemandById(id);
        if (!dem)
            return undefined;
        dem.status = status;
        if (resourceId)
            dem.allocatedResourceId = resourceId;
        return dem;
    }
    // ── Resources ─────────────────────────────────────────────────────────────
    getResources(params) {
        let list = [...this.state.resources];
        if (params?.category)
            list = list.filter(r => r.category === params.category);
        if (params?.status)
            list = list.filter(r => r.status === params.status);
        return list;
    }
    getResourceById(id) {
        return this.state.resources.find(r => r.id === id);
    }
    createResource(data) {
        const id = `RES-NCR-${Math.floor(Math.random() * 800) + 100}`;
        const newRes = {
            id,
            lastUpdated: new Date().toISOString(),
            ...data
        };
        this.state.resources.unshift(newRes);
        this.logAuditEvent({
            actor: 'Depot Administrator',
            action: 'Resource Depot Registered',
            target: `${id} (${data.quantity} ${data.unit} ${data.name})`,
            result: `Depot: ${data.locationName}`,
            type: 'SYSTEM'
        });
        return newRes;
    }
    // ── Allocations ───────────────────────────────────────────────────────────
    getAllocations() {
        return this.state.allocations;
    }
    createAllocation(data) {
        const allocId = `ALLOC-2026-${Math.floor(Math.random() * 900) + 100}`;
        const dem = this.getDemandById(data.demandId);
        const res = this.getResourceById(data.resourceId);
        if (res) {
            res.quantity = Math.max(0, res.quantity - data.quantity);
            res.allocatedQuantity = (res.allocatedQuantity ?? 0) + data.quantity;
            res.allocationId = allocId;
            res.lastUpdated = new Date().toISOString();
            if (res.quantity === 0)
                res.status = 'DEPLETED';
            else if (res.quantity < 200)
                res.status = 'LOW';
        }
        if (dem) {
            dem.status = 'ALLOCATED';
            dem.allocatedResourceId = data.resourceId;
            if (data.vehicleId)
                dem.allocatedVehicleId = data.vehicleId;
        }
        const newAlloc = {
            id: allocId,
            demandId: data.demandId,
            resourceId: data.resourceId,
            quantity: data.quantity,
            vehicleId: data.vehicleId,
            matchScore: 92.5,
            status: 'APPROVED',
            approvedBy: 'Duty Matching Officer',
            approvedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            reasoning: [
                `Reserved ${data.quantity} units from ${res?.locationName || 'depot'}.`,
                `Demand priority ${dem?.priority || 'HIGH'} successfully satisfied.`
            ]
        };
        this.state.allocations.unshift(newAlloc);
        this.logAuditEvent({
            actor: 'Matching Engine',
            action: 'Resource Allocation Approved',
            target: `${data.demandId} <- ${data.resourceId}`,
            result: `Allocated ${data.quantity} units · Ref: ${allocId}`,
            type: 'ALLOCATE'
        });
        return newAlloc;
    }
    getAllocationById(id) {
        return this.state.allocations.find(a => a.id === id);
    }
    approveAllocation(id, approvedBy = 'Operations Officer') {
        const alloc = this.getAllocationById(id);
        if (!alloc)
            return undefined;
        alloc.status = 'APPROVED';
        alloc.approvedBy = approvedBy;
        alloc.approvedAt = new Date().toISOString();
        alloc.updatedAt = new Date().toISOString();
        const dem = this.getDemandById(alloc.demandId);
        if (dem)
            dem.status = 'ALLOCATED';
        this.logAuditEvent({
            actor: approvedBy,
            action: 'Allocation Approved',
            target: alloc.id,
            result: `Demand ${alloc.demandId} status -> ALLOCATED`,
            type: 'ALLOCATE'
        });
        return alloc;
    }
    rejectAllocation(id, reason = 'Resource constrained') {
        const alloc = this.getAllocationById(id);
        if (!alloc)
            return undefined;
        alloc.status = 'REJECTED';
        alloc.updatedAt = new Date().toISOString();
        const res = this.getResourceById(alloc.resourceId);
        if (res) {
            res.quantity += alloc.quantity;
            res.allocatedQuantity = Math.max(0, (res.allocatedQuantity ?? 0) - alloc.quantity);
            res.status = 'AVAILABLE';
        }
        const dem = this.getDemandById(alloc.demandId);
        if (dem) {
            dem.status = 'PENDING';
            dem.allocatedResourceId = undefined;
        }
        this.logAuditEvent({
            actor: 'Operations Officer',
            action: 'Allocation Rejected',
            target: alloc.id,
            result: `Reason: ${reason} · Stock returned to ${alloc.resourceId}`,
            type: 'ALLOCATE'
        });
        return alloc;
    }
    // ── Responders & Personnel ────────────────────────────────────────────────
    getResponders(params) {
        let list = [...this.state.responders];
        if (params?.status)
            list = list.filter(r => r.status === params.status);
        if (params?.role)
            list = list.filter(r => r.role === params.role);
        return list;
    }
    getResponderById(id) {
        return this.state.responders.find(r => r.id === id);
    }
    createResponder(data) {
        const id = `RSP-${String(this.state.responders.length + 1).padStart(3, '0')}`;
        const newRsp = { id, ...data };
        this.state.responders.unshift(newRsp);
        this.logAuditEvent({
            actor: 'Personnel Coordinator',
            action: 'Responder Registered',
            target: `${id} (${data.name} - ${data.role})`,
            result: `Agency: ${data.agency} · Status: ${data.status}`,
            type: 'SYSTEM'
        });
        return newRsp;
    }
    updateResponderStatus(id, status) {
        const rsp = this.getResponderById(id);
        if (!rsp)
            return undefined;
        rsp.status = status;
        return rsp;
    }
    // ── Vehicles & Fleet ──────────────────────────────────────────────────────
    getVehicles(params) {
        let list = [...this.state.vehicles];
        if (params?.status)
            list = list.filter(v => v.status === params.status);
        if (params?.type)
            list = list.filter(v => v.type === params.type);
        return list;
    }
    getVehicleById(id) {
        return this.state.vehicles.find(v => v.id === id);
    }
    createVehicle(data) {
        const prefix = data.type === 'TRUCK' ? 'TRK' : data.type === 'AMBULANCE' ? 'AMB' : data.type === 'RESCUE_BOAT' ? 'BOT' : 'VEH';
        const id = `VEH-${prefix}-${Math.floor(Math.random() * 800) + 100}`;
        const newVeh = { id, ...data };
        this.state.vehicles.unshift(newVeh);
        this.logAuditEvent({
            actor: 'Fleet Manager',
            action: 'Vehicle Registered',
            target: `${id} (${data.name})`,
            result: `Type: ${data.type} · Capacity: ${data.capacity}`,
            type: 'SYSTEM'
        });
        return newVeh;
    }
    updateVehicleStatus(id, status) {
        const veh = this.getVehicleById(id);
        if (!veh)
            return undefined;
        veh.status = status;
        return veh;
    }
    updateVehicleLocation(id, coords, speedKmh) {
        const veh = this.getVehicleById(id);
        if (!veh)
            return undefined;
        veh.location = coords;
        if (speedKmh !== undefined)
            veh.speedKmh = speedKmh;
        return veh;
    }
    // ── Missions & Dispatch ───────────────────────────────────────────────────
    getMissions(params) {
        let list = [...this.state.missions];
        if (params?.status)
            list = list.filter(m => m.status === params.status);
        if (params?.vehicleId)
            list = list.filter(m => m.vehicleId === params.vehicleId);
        if (params?.requestId)
            list = list.filter(m => m.requestId === params.requestId);
        return list;
    }
    getMissionById(id) {
        return this.state.missions.find(m => m.id === id);
    }
    createMission(data) {
        const missionId = `DSP-DEL-${Math.floor(Math.random() * 800) + 100}`;
        const req = this.getDemandById(data.requestId);
        const veh = this.getVehicleById(data.vehicleId);
        const newMission = {
            id: missionId,
            requestId: data.requestId,
            vehicleId: data.vehicleId,
            status: 'EN_ROUTE',
            destinationName: req?.zoneName || 'Drop Zone',
            resourceType: req?.itemNeeded || 'Relief Cargo',
            quantity: req?.quantity || 100,
            unit: req?.unit || 'Units',
            etaMinutes: 16,
            operatorName: data.operatorName || veh?.driverName || 'Field Driver',
            speedKmh: 48,
            distanceKm: 12.0,
            signalStrength: 95,
            fuelPct: 88,
            trafficLevel: 'MODERATE',
            routePath: ['Central Supply Hub', 'Primary Arterial Corridor', req?.zoneName || 'Zone'],
            timeline: [
                { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), title: 'CONVOY DISPATCHED', done: true },
                { time: '~16 min', title: 'DESTINATION ARRIVAL', done: false }
            ]
        };
        this.state.missions.unshift(newMission);
        if (veh) {
            veh.status = 'EN_ROUTE';
            veh.cargo = `${req?.quantity} ${req?.unit} ${req?.itemNeeded}`;
            veh.destination = req?.coordinates;
        }
        if (req) {
            req.status = 'DISPATCHED';
            req.allocatedVehicleId = data.vehicleId;
        }
        this.logAuditEvent({
            actor: data.operatorName || 'Dispatch Commander',
            action: 'Mission Dispatched',
            target: `${missionId} (${data.vehicleId})`,
            result: `Destination: ${req?.zoneName || 'Zone'} · ETA 16 min`,
            type: 'DISPATCH'
        });
        return newMission;
    }
    updateMissionStatus(id, status) {
        const mis = this.getMissionById(id);
        if (!mis)
            return undefined;
        mis.status = status;
        const veh = this.getVehicleById(mis.vehicleId);
        if (veh) {
            if (status === 'ARRIVED')
                veh.status = 'ARRIVED';
            else if (status === 'DELIVERED')
                veh.status = 'AVAILABLE';
        }
        if (status === 'DELIVERED') {
            const dem = this.getDemandById(mis.requestId);
            if (dem)
                dem.status = 'FULFILLED';
        }
        mis.timeline.push({
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            title: `MISSION ${status}`,
            done: true
        });
        this.logAuditEvent({
            actor: mis.operatorName || 'Field Team',
            action: 'Mission Status Transition',
            target: `${mis.id} -> ${status}`,
            result: `Vehicle ${mis.vehicleId} updated`,
            type: 'DISPATCH'
        });
        return mis;
    }
    verifyDelivery(missionId, verifierName = 'Ground Triage Officer') {
        const mis = this.getMissionById(missionId);
        if (!mis)
            return undefined;
        mis.status = 'DELIVERED';
        const dem = this.getDemandById(mis.requestId);
        if (dem)
            dem.status = 'FULFILLED';
        const veh = this.getVehicleById(mis.vehicleId);
        if (veh)
            veh.status = 'AVAILABLE';
        this.logAuditEvent({
            actor: verifierName,
            action: 'Verified Ground Delivery',
            target: `${mis.id} (${mis.quantity} ${mis.unit} ${mis.resourceType})`,
            result: `Demand ${mis.requestId} FULFILLED · Vehicle ${mis.vehicleId} Released`,
            type: 'DELIVERY'
        });
        return { mission: mis, demand: dem };
    }
    // ── Routes & Navigation ───────────────────────────────────────────────────
    getRoutes() {
        return this.state.routes;
    }
    getRouteById(id) {
        return this.state.routes.find(r => r.id === id);
    }
    createRoute(data) {
        const id = `RTE-DEL-${String(this.state.routes.length + 1).padStart(2, '0')}`;
        const newRoute = { id, ...data };
        this.state.routes.push(newRoute);
        return newRoute;
    }
    calculateRoute(origin, destination) {
        const id = `RTE-NAV-${Date.now().toString(36).toUpperCase()}`;
        const dLat = destination.lat - origin.lat;
        const dLng = destination.lng - origin.lng;
        const distKm = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 111 * 10) / 10;
        const estMin = Math.max(5, Math.round((distKm / 35) * 60));
        const waypoints = [
            { name: 'Origin Depot', coordinates: origin, reached: true },
            { name: 'Intermediary Corridor', coordinates: { lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 }, reached: false },
            { name: 'Target Destination', coordinates: destination, reached: false }
        ];
        const pathCoordinates = [
            origin,
            { lat: origin.lat + (destination.lat - origin.lat) * 0.33, lng: origin.lng + (destination.lng - origin.lng) * 0.25 },
            { lat: origin.lat + (destination.lat - origin.lat) * 0.66, lng: origin.lng + (destination.lng - origin.lng) * 0.75 },
            destination
        ];
        const route = {
            id,
            origin,
            destination,
            originName: 'Relief Staging Point',
            destinationName: 'Emergency Incident Zone',
            distanceKm: distKm,
            estimatedMinutes: estMin,
            waypoints,
            pathCoordinates,
            trafficStatus: 'CLEAR'
        };
        return route;
    }
    // ── Shelters ──────────────────────────────────────────────────────────────
    getShelters() {
        return this.state.shelters;
    }
    getShelterById(id) {
        return this.state.shelters.find(s => s.id === id);
    }
    createShelter(data) {
        const id = `SHL-DEL-${String(this.state.shelters.length + 1).padStart(2, '0')}`;
        const newShelter = { id, ...data };
        this.state.shelters.push(newShelter);
        this.logAuditEvent({
            actor: 'Civil Defence Coordinator',
            action: 'Shelter Registered',
            target: `${id} (${data.name})`,
            result: `Capacity: ${data.capacityOccupied}/${data.capacityTotal} beds`,
            type: 'SYSTEM'
        });
        return newShelter;
    }
    updateShelterOccupancy(id, count) {
        const shl = this.getShelterById(id);
        if (!shl)
            return undefined;
        shl.capacityOccupied = Math.min(shl.capacityTotal, count);
        if (shl.capacityOccupied >= shl.capacityTotal)
            shl.status = 'FULL';
        else if (shl.status === 'FULL' && shl.capacityOccupied < shl.capacityTotal)
            shl.status = 'OPEN';
        return shl;
    }
    // ── Alerts & Audit ────────────────────────────────────────────────────────
    getAlerts() {
        return this.state.alerts;
    }
    createAlert(data) {
        const id = `ALT-${Date.now().toString(36).toUpperCase()}`;
        const newAlert = {
            id,
            timestamp: new Date().toISOString(),
            ...data
        };
        this.state.alerts.unshift(newAlert);
        return newAlert;
    }
    resolveAlert(id) {
        const alt = this.state.alerts.find(a => a.id === id);
        if (!alt)
            return undefined;
        alt.resolved = true;
        return alt;
    }
    getAuditEvents() {
        return this.state.auditEvents;
    }
    logAuditEvent(entry) {
        const event = {
            id: `LOG-${Date.now().toString(36).toUpperCase()}`,
            timestamp: new Date().toISOString(),
            ...entry
        };
        this.state.auditEvents.unshift(event);
        return event;
    }
}
exports.inMemoryStore = new InMemoryStore();
