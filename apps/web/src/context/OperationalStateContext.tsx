import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Incident, IncidentStatus } from '../types/incident';
import type { Vehicle, VehicleStatus } from '../types/vehicle';
import type { Shelter } from '../types/shelter';
import type { DemandRequest, RequestStatus } from '../types/request';
import type { ResourceItem, ResourceStatus, ResourceCategory } from '../types/resource';
import type { Coordinates, Severity } from '../types/common';
import apiClient from '../services/apiClient';

import { mockIncidents } from '../data/mockIncidents';
import { mockRequests } from '../data/mockRequests';
import { mockResources } from '../data/mockResources';
import { mockVehicles } from '../data/mockVehicles';
import { mockShelters } from '../data/mockShelters';
import { mockMissions } from '../data/mockMissions';
import { mockDeliveries } from '../data/mockDeliveries';
import { mockAuditLogs, type AuditLogEntry } from '../data/mockAuditLogs';
import { mockResponders, type ResponderItem } from '../data/mockResponders';
import { mockHospitals, type HospitalItem } from '../data/mockHospitals';
import { mockHazardZones, type HazardZone } from '../data/mockHazardZones';

export interface DispatchMission {
  id: string;
  requestId: string;
  vehicleId: string;
  status: 'AWAITING_DISPATCH' | 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED' | 'DELIVERED';
  destinationName: string;
  resourceType: string;
  quantity: number;
  unit: string;
  etaMinutes: number;
  operatorName: string;
  speedKmh: number;
  distanceKm: number;
  signalStrength: number;
  fuelPct: number;
  trafficLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'BLOCKED';
  routePath: string[];
  alertMessage?: string;
  timeline: { time: string; title: string; done: boolean }[];
}

export interface ReliefDelivery {
  id: string;
  dispatchId: string;
  demandId: string;
  incidentId: string;
  resourceId: string;
  vehicleId: string;
  requestedQty: number;
  allocatedQty: number;
  deliveredQty: number;
  unit: string;
  status: 'PENDING' | 'ARRIVED' | 'IN_DELIVERY' | 'DELIVERED' | 'VERIFIED';
  resourceType: string;
  destinationName: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  exceptionReason?: string;
  proofRef?: string;
}

export interface ToastMessage {
  id: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  text: string;
}

export interface AlertNotification {
  id: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  timestamp: string;
  category: 'DEMAND' | 'RESOURCE' | 'SHELTER' | 'MISSION' | 'INCIDENT';
  actionPath?: string;
}

export type OperationalDataMode = 'LIVE_BACKEND' | 'SIMULATED_DEMO';

interface OperationalStateContextType {
  incidents: Incident[];
  vehicles: Vehicle[];
  requests: DemandRequest[];
  shelters: Shelter[];
  resources: ResourceItem[];
  missions: DispatchMission[];
  deliveries: ReliefDelivery[];
  responders: ResponderItem[];
  hospitals: HospitalItem[];
  hazardZones: HazardZone[];
  auditLogs: AuditLogEntry[];
  alerts: AlertNotification[];
  dataMode: OperationalDataMode;
  setDataMode: (mode: OperationalDataMode) => void;
  resetToDemoDataset: () => void;
  
  setMissions: React.Dispatch<React.SetStateAction<DispatchMission[]>>;
  setDeliveries: React.Dispatch<React.SetStateAction<ReliefDelivery[]>>;
  setResponders: React.Dispatch<React.SetStateAction<ResponderItem[]>>;
  setHospitals: React.Dispatch<React.SetStateAction<HospitalItem[]>>;
  setHazardZones: React.Dispatch<React.SetStateAction<HazardZone[]>>;
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], text: string) => void;
  removeToast: (id: string) => void;
  isOffline: boolean;

  // --- Audit Logging ---
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;

  // --- SOS & Entity Intake ---
  addIncidentFromSOS: (sosData: {
    name: string;
    phone: string;
    zone: string;
    need: string;
    details: string;
  }) => string;

  addManualIncident: (manualData: {
    type: any;
    severity: Severity;
    location: string;
    coordinates: Coordinates;
    description: string;
    reporterName: string;
    reporterContact: string;
    source: string;
    peopleAffected: number;
    requiredResources?: any[];
  }) => Promise<string>;

  addManualRequest: (data: {
    incidentId?: string;
    zoneName: string;
    coordinates: Coordinates;
    itemNeeded: string;
    category: string;
    quantity: number;
    unit: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    affectedCount: number;
  }) => string;

  addResource: (data: {
    name: string;
    category: ResourceCategory;
    quantity: number;
    unit: string;
    locationName: string;
    coordinates: Coordinates;
    contactPerson: string;
    contactNumber: string;
  }) => string;

  addVehicle: (data: {
    name: string;
    type: any;
    capacity: string;
    location: Coordinates;
    driverName: string;
    driverContact: string;
    teamName?: string;
  }) => string;

  addShelter: (data: {
    name: string;
    locationName: string;
    coordinates: Coordinates;
    capacityTotal: number;
    capacityOccupied?: number;
    contactPerson: string;
    contactNumber: string;
    resourcesAvailable: string[];
  }) => string;

  // --- Dispatch & Mission Execution ---
  dispatchVehicleToIncident: (vehicleId: string, incidentId: string) => void;
  createAndDispatchMission: (missionData: {
    requestId: string;
    vehicleId: string;
    operatorName?: string;
  }) => string;
  updateMissionStatus: (missionId: string, status: DispatchMission['status']) => void;

  // --- Delivery & Reconciliation ---
  verifyAndReconcileDelivery: (data: {
    deliveryId: string;
    deliveredQty: number;
    verifiedBy: string;
    notes?: string;
    proofRef?: string;
    exceptionReason?: string;
  }) => boolean;

  // --- Status updaters ---
  updateIncidentStatus: (incidentId: string, status: IncidentStatus) => void;
  setIncidentPriority: (incidentId: string, severity: Severity) => void;
  updateVehicleStatus: (vehicleId: string, status: VehicleStatus) => void;
  updateResourceStatus: (resourceId: string, status: ResourceStatus) => void;
  updateDemandStatus: (demandId: string, status: RequestStatus, resourceId?: string) => void;

  // --- Matching Engine Action ---
  allocateResourceToRequest: (
    demandId: string,
    resourceId: string,
    quantity: number
  ) => string;

  // --- Direct Setters ---
  setIncidents: React.Dispatch<React.SetStateAction<Incident[]>>;
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  setRequests: React.Dispatch<React.SetStateAction<DemandRequest[]>>;
  setResources: React.Dispatch<React.SetStateAction<ResourceItem[]>>;
  setShelters: React.Dispatch<React.SetStateAction<Shelter[]>>;
}

export function normalizeIncident(backendInc: any): Incident {
  return {
    id: backendInc.incidentId || backendInc.id,
    type: backendInc.type,
    severity: backendInc.severity,
    location: backendInc.location,
    coordinates: {
      lat: backendInc.latitude,
      lng: backendInc.longitude
    },
    time: backendInc.reportedAt || backendInc.createdAt || new Date().toISOString(),
    status: backendInc.status,
    assignedTeam: backendInc.assignedUnit || 'UNASSIGNED',
    description: backendInc.description,
    reporterName: backendInc.reporterName || 'Field Reporter',
    reporterContact: backendInc.reporterContact || '',
    casualtiesCount: 0,
    displacedCount: backendInc.displacedPeople || 0,
    reportedAt: backendInc.reportedAt,
    updatedAt: backendInc.updatedAt,
    source: backendInc.region || 'HEADQUARTERS',
    peopleAffected: backendInc.affectedPeople || 0,
    requiredResources: backendInc.requiredResources || [],
    timeline: backendInc.timeline || [
      {
        time: new Date(backendInc.reportedAt || backendInc.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }),
        title: 'INCIDENT REPORTED',
        description: 'Incident registered in the command network database.'
      }
    ]
  };
}

export function normalizeResource(backendRes: any): ResourceItem {
  return {
    id: backendRes.resourceId || backendRes.id,
    name: backendRes.materialName || backendRes.name,
    category: backendRes.category,
    quantity: backendRes.availableQuantity ?? backendRes.quantity ?? 0,
    allocatedQuantity: backendRes.reservedQuantity ?? backendRes.allocatedQuantity ?? 0,
    unit: backendRes.unit,
    locationName: backendRes.location || backendRes.locationName,
    coordinates: {
      lat: backendRes.latitude ?? backendRes.coordinates?.lat ?? 28.6139,
      lng: backendRes.longitude ?? backendRes.coordinates?.lng ?? 77.2090
    },
    status: backendRes.status,
    lastUpdated: backendRes.lastUpdated || backendRes.updatedAt || new Date().toISOString(),
    contactPerson: backendRes.pointOfContact || backendRes.contactPerson || 'Depot Manager',
    contactNumber: backendRes.contactNumber || '+91-99999-88888'
  };
}

export function normalizeVehicle(backendVeh: any): Vehicle {
  let vehType = (backendVeh.type || 'TRUCK').toUpperCase();
  if (vehType === 'RESCUE BOAT') vehType = 'RESCUE_BOAT';
  return {
    id: backendVeh.vehicleId || backendVeh.id,
    name: backendVeh.name,
    type: vehType as any,
    capacity: `${backendVeh.capacity} ${backendVeh.capacityUnit || ''}`.trim(),
    status: backendVeh.status,
    location: {
      lat: backendVeh.currentLatitude ?? backendVeh.location?.lat ?? 28.6139,
      lng: backendVeh.currentLongitude ?? backendVeh.location?.lng ?? 77.2090
    },
    driverName: backendVeh.operatorName || backendVeh.driverName || 'Field Unit Operator',
    driverContact: backendVeh.contactRadio || backendVeh.driverContact || '+91-98765-43210',
    speedKmh: backendVeh.speed || backendVeh.speedKmh || 0,
    incidentId: backendVeh.currentMission || backendVeh.incidentId || undefined
  };
}

export function normalizeDemand(backendDem: any): DemandRequest {
  return {
    id: backendDem.requestId || backendDem.id,
    incidentId: backendDem.incidentId,
    zoneName: backendDem.affectedZone || backendDem.zoneName || 'Delhi Emergency Zone',
    coordinates: {
      lat: backendDem.latitude ?? backendDem.coordinates?.lat ?? 28.6139,
      lng: backendDem.longitude ?? backendDem.coordinates?.lng ?? 77.2090
    },
    itemNeeded: backendDem.requestedType || backendDem.itemNeeded,
    category: backendDem.requestedType || backendDem.category || 'FOOD',
    quantity: backendDem.quantity,
    unit: backendDem.unit,
    priority: backendDem.priority || 'HIGH',
    affectedCount: backendDem.affectedPeople || backendDem.affectedCount || 0,
    status: backendDem.status || 'PENDING',
    requestedAt: backendDem.createdAt || backendDem.requestedAt || new Date().toISOString()
  };
}

export function normalizeShelter(backendShelter: any): Shelter {
  return {
    id: backendShelter.shelterId || backendShelter.id,
    name: backendShelter.name,
    locationName: backendShelter.location || backendShelter.locationName,
    coordinates: {
      lat: backendShelter.latitude ?? backendShelter.coordinates?.lat ?? 28.6139,
      lng: backendShelter.longitude ?? backendShelter.coordinates?.lng ?? 77.2090
    },
    capacityTotal: backendShelter.totalCapacity ?? backendShelter.capacityTotal ?? 500,
    capacityOccupied: backendShelter.currentOccupancy ?? backendShelter.capacityOccupied ?? 0,
    status: backendShelter.status || 'OPEN',
    contactPerson: backendShelter.contactPerson || 'Camp Officer',
    contactNumber: backendShelter.contactInfo || backendShelter.contactNumber || '+91-99999-88888',
    resourcesAvailable: backendShelter.facilities || backendShelter.resourcesAvailable || ['Water', 'Food']
  };
}

const OperationalStateContext = createContext<OperationalStateContextType | undefined>(undefined);

export const OperationalStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pre-seed with realistic Delhi NCR disaster data
  const [incidents, setIncidents] = useState<Incident[]>(() => mockIncidents);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => mockVehicles);
  const [requests, setRequests] = useState<DemandRequest[]>(() => mockRequests);
  const [shelters, setShelters] = useState<Shelter[]>(() => mockShelters);
  const [resources, setResources] = useState<ResourceItem[]>(() => mockResources);
  const [missions, setMissions] = useState<DispatchMission[]>(() => mockMissions);
  const [deliveries, setDeliveries] = useState<ReliefDelivery[]>(() => mockDeliveries);
  const [responders, setResponders] = useState<ResponderItem[]>(() => mockResponders);
  const [hospitals, setHospitals] = useState<HospitalItem[]>(() => mockHospitals);
  const [hazardZones, setHazardZones] = useState<HazardZone[]>(() => mockHazardZones);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => mockAuditLogs);
  const [dataMode, setDataMode] = useState<OperationalDataMode>('SIMULATED_DEMO');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const addToast = (type: ToastMessage['type'], text: string) => {
    const id = `toast-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { id, type, text };
    setToasts(prev => [...prev, newToast].slice(-5));
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Attempt to fetch from backend API if active
  useEffect(() => {
    let isMounted = true;
    const loadRealData = async () => {
      try {
        const [incRes, reqRes, resRes, vehRes, shlRes] = await Promise.allSettled([
          apiClient.getIncidents(),
          apiClient.getDemands(),
          apiClient.getResources(),
          apiClient.getVehicles(),
          apiClient.getShelters(),
        ]);
        if (!isMounted) return;

        let hasLiveBackendData = false;

        if (incRes.status === 'fulfilled') {
          const raw = incRes.value;
          const parsedArray = (raw as any)?.data || [];
          if (Array.isArray(parsedArray) && parsedArray.length > 0) {
            const normalized = parsedArray.map((inc: any) => normalizeIncident(inc));
            setIncidents(normalized);
            hasLiveBackendData = true;
          }
        }
        if (reqRes.status === 'fulfilled') {
          const raw = (reqRes.value as any)?.data || [];
          if (Array.isArray(raw) && raw.length > 0) {
            const normalized = raw.map((item: any) => normalizeDemand(item));
            setRequests(normalized);
            hasLiveBackendData = true;
          }
        }
        if (resRes.status === 'fulfilled') {
          const raw = (resRes.value as any)?.data || [];
          if (Array.isArray(raw) && raw.length > 0) {
            const normalized = raw.map((item: any) => normalizeResource(item));
            setResources(normalized);
            hasLiveBackendData = true;
          }
        }
        if (vehRes.status === 'fulfilled') {
          const raw = (vehRes.value as any)?.data || [];
          if (Array.isArray(raw) && raw.length > 0) {
            const normalized = raw.map((item: any) => normalizeVehicle(item));
            setVehicles(normalized);
            hasLiveBackendData = true;
          }
        }
        if (shlRes.status === 'fulfilled') {
          const raw = (shlRes.value as any)?.data || [];
          if (Array.isArray(raw) && raw.length > 0) {
            const normalized = raw.map((item: any) => normalizeShelter(item));
            setShelters(normalized);
            hasLiveBackendData = true;
          }
        }

        if (hasLiveBackendData) {
          setDataMode('LIVE_BACKEND');
          addToast('INFO', 'LIVE DATA CONNECTED: Syncing with central disaster backend API.');
        }
      } catch (err) {
        // Keep simulated demo mode active seamlessly
      }
    };
    loadRealData();
    return () => { isMounted = false; };
  }, []);

  // Online / Offline handlers
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      addToast('SUCCESS', 'CONNECTION RESTORED: Central telemetry active.');
    };
    const handleOffline = () => {
      setIsOffline(true);
      addToast('WARNING', 'OFFLINE MODE: Using localized operational cache.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper coordinate mapper for Delhi NCR zones
  const getZoneCoordinates = (zone: string): Coordinates => {
    switch (zone) {
      case 'East Delhi':
        return { lat: 28.6219, lng: 77.2691 };
      case 'West Delhi':
        return { lat: 28.6219, lng: 77.0878 };
      case 'North Delhi':
        return { lat: 28.6814, lng: 77.2224 };
      case 'South Delhi':
        return { lat: 28.5684, lng: 77.2435 };
      case 'Central Delhi':
      default:
        return { lat: 28.6304, lng: 77.2177 };
    }
  };

  // Reset to demo state
  const resetToDemoDataset = () => {
    setIncidents(mockIncidents);
    setRequests(mockRequests);
    setResources(mockResources);
    setVehicles(mockVehicles);
    setShelters(mockShelters);
    setMissions(mockMissions);
    setDeliveries(mockDeliveries);
    setAuditLogs(mockAuditLogs);
    setDataMode('SIMULATED_DEMO');
    addToast('SUCCESS', 'DEMO DATASET RESTORED: All operational entities reset to Delhi NCR scenario.');
    addAuditLog({
      actor: 'Operator / Demo Presenter',
      action: 'Reset Operational State',
      target: 'Platform State Engine',
      result: 'Restored baseline Delhi disaster simulation data',
      type: 'SYSTEM'
    });
  };

  // Dynamic alerts computed from current state
  const alerts = useMemo(() => {
    const list: AlertNotification[] = [];

    // 1. Critical unfulfilled demands
    requests.filter(r => r.priority === 'CRITICAL' && (r.status === 'PENDING' || r.status === 'OPEN')).forEach(req => {
      list.push({
        id: `alt-req-${req.id}`,
        title: 'CRITICAL DEMAND UNFULFILLED',
        message: `${req.quantity.toLocaleString()} ${req.unit} of ${req.itemNeeded} required at ${req.zoneName} (${req.affectedCount} affected).`,
        severity: 'CRITICAL',
        timestamp: req.requestedAt,
        category: 'DEMAND',
        actionPath: `/operations/matching?requestId=${req.id}`
      });
    });

    // 2. Resource stock shortage
    resources.filter(r => r.status === 'LOW' || r.quantity < 100).forEach(res => {
      list.push({
        id: `alt-res-${res.id}`,
        title: 'RESOURCE STOCK DEPLETION RISK',
        message: `${res.name} at ${res.locationName.split(',')[0]} is down to ${res.quantity.toLocaleString()} ${res.unit}.`,
        severity: 'HIGH',
        timestamp: res.lastUpdated,
        category: 'RESOURCE',
        actionPath: '/operations/resources'
      });
    });

    // 3. Shelters near capacity
    shelters.filter(s => s.status === 'FULL' || (s.capacityTotal > 0 && s.capacityOccupied / s.capacityTotal >= 0.85)).forEach(shl => {
      const pct = Math.round((shl.capacityOccupied / shl.capacityTotal) * 100);
      list.push({
        id: `alt-shl-${shl.id}`,
        title: 'SHELTER NEAR MAXIMUM OCCUPANCY',
        message: `${shl.name} is ${pct}% full (${shl.capacityOccupied}/${shl.capacityTotal} beds occupied).`,
        severity: 'HIGH',
        timestamp: new Date().toISOString(),
        category: 'SHELTER',
        actionPath: '/operations/shelters'
      });
    });

    // 4. En route missions
    missions.filter(m => m.status === 'EN_ROUTE').forEach(m => {
      list.push({
        id: `alt-mis-${m.id}`,
        title: 'RELIEF CONVOY EN ROUTE',
        message: `Mission ${m.id} delivering ${m.quantity} ${m.unit} ${m.resourceType} to ${m.destinationName} (ETA ~${m.etaMinutes} min).`,
        severity: 'MEDIUM',
        timestamp: new Date().toISOString(),
        category: 'MISSION',
        actionPath: '/operations/dispatch'
      });
    });

    return list;
  }, [requests, resources, shelters, missions]);

  /** SOS civilian intake */
  const addIncidentFromSOS = (sosData: {
    name: string;
    phone: string;
    zone: string;
    need: string;
    details: string;
  }) => {
    const coords = getZoneCoordinates(sosData.zone);
    const incidentId = `INC-2026-${Math.floor(Math.random() * 800) + 300}`;
    const requestId = `DEM-2026-${Math.floor(Math.random() * 800) + 300}`;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

    const newIncident: Incident = {
      id: incidentId,
      type: 'RESOURCE_SHORTAGE',
      severity: 'HIGH',
      location: `${sosData.zone} Emergency SOS Sector`,
      coordinates: coords,
      time: new Date().toISOString(),
      status: 'REPORTED',
      assignedTeam: 'UNASSIGNED',
      description: `Civilian SOS: needs ${sosData.need}. Description: ${sosData.details}`,
      reporterName: sosData.name,
      reporterContact: sosData.phone,
      displacedCount: 45,
      reportedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'CIVILIAN SOS PORTAL',
      peopleAffected: 45,
      requiredResources: [
        { itemNeeded: sosData.need, quantity: 150, unit: 'Units', priority: 'HIGH' }
      ],
      timeline: [
        {
          time: timeStr,
          title: 'SOS INCIDENT REPORTED',
          description: `Civilian emergency report received from ${sosData.name} (${sosData.phone}).`
        }
      ]
    };

    const newRequest: DemandRequest = {
      id: requestId,
      incidentId: incidentId,
      zoneName: `${sosData.zone} SOS Area`,
      coordinates: coords,
      itemNeeded: sosData.need,
      category: 'FOOD',
      quantity: 150,
      unit: 'Units',
      priority: 'HIGH',
      affectedCount: 45,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    };

    setIncidents(prev => [newIncident, ...prev]);
    setRequests(prev => [newRequest, ...prev]);
    addToast('SUCCESS', `SOS Ticket ${requestId} registered and queued for response triage.`);
    addAuditLog({
      actor: `Civilian (${sosData.name})`,
      action: 'Emergency SOS Ingested',
      target: `${incidentId} · ${requestId}`,
      result: `Needs: ${sosData.need} at ${sosData.zone}`,
      type: 'SYSTEM'
    });

    return requestId;
  };

  /** Manual Incident Intake */
  const addManualIncident = async (manualData: {
    type: any;
    severity: Severity;
    location: string;
    coordinates: Coordinates;
    description: string;
    reporterName: string;
    reporterContact: string;
    source: string;
    peopleAffected: number;
    requiredResources?: any[];
  }) => {
    const incidentId = `INC-2026-${Math.floor(Math.random() * 800) + 300}`;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

    const newIncident: Incident = {
      id: incidentId,
      type: manualData.type,
      severity: manualData.severity,
      location: manualData.location,
      coordinates: manualData.coordinates,
      time: new Date().toISOString(),
      status: 'REPORTED',
      assignedTeam: 'UNASSIGNED',
      description: manualData.description,
      reporterName: manualData.reporterName,
      reporterContact: manualData.reporterContact,
      reportedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: manualData.source || 'COMMAND HEADQUARTERS',
      peopleAffected: manualData.peopleAffected || 0,
      requiredResources: manualData.requiredResources ?? [],
      timeline: [
        {
          time: timeStr,
          title: 'INCIDENT REPORTED',
          description: `Manual incident logged by coordinator ${manualData.reporterName}.`
        }
      ]
    };

    setIncidents(prev => [newIncident, ...prev]);

    // If required resources were provided, create matching demand requests
    if (manualData.requiredResources && manualData.requiredResources.length > 0) {
      manualData.requiredResources.forEach((res, idx) => {
        const reqId = `DEM-2026-${Math.floor(Math.random() * 800) + 300 + idx}`;
        const newReq: DemandRequest = {
          id: reqId,
          incidentId,
          zoneName: manualData.location,
          coordinates: manualData.coordinates,
          itemNeeded: res.itemNeeded,
          category: res.category || 'FOOD',
          quantity: res.quantity || 100,
          unit: res.unit || 'Units',
          priority: res.priority || manualData.severity,
          affectedCount: manualData.peopleAffected || 50,
          status: 'PENDING',
          requestedAt: new Date().toISOString()
        };
        setRequests(prev => [newReq, ...prev]);
      });
    }

    addToast('SUCCESS', `Incident ${incidentId} successfully registered in the command matrix.`);
    addAuditLog({
      actor: manualData.reporterName || 'Duty Coordinator',
      action: 'Incident Created',
      target: `${incidentId} (${manualData.type})`,
      result: `Location: ${manualData.location} · Severity: ${manualData.severity}`,
      type: 'SYSTEM'
    });

    return incidentId;
  };

  /** Manual Request Intake */
  const addManualRequest = (data: {
    incidentId?: string;
    zoneName: string;
    coordinates: Coordinates;
    itemNeeded: string;
    category: string;
    quantity: number;
    unit: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    affectedCount: number;
  }) => {
    const requestId = `DEM-2026-${Math.floor(Math.random() * 800) + 400}`;
    const newReq: DemandRequest = {
      id: requestId,
      incidentId: data.incidentId,
      zoneName: data.zoneName,
      coordinates: data.coordinates,
      itemNeeded: data.itemNeeded,
      category: data.category,
      quantity: data.quantity,
      unit: data.unit,
      priority: data.priority,
      affectedCount: data.affectedCount,
      status: 'PENDING',
      requestedAt: new Date().toISOString()
    };
    setRequests(prev => [newReq, ...prev]);
    addToast('SUCCESS', `Demand request ${requestId} created for ${data.itemNeeded}.`);
    addAuditLog({
      actor: 'Logistics Officer',
      action: 'Demand Request Created',
      target: `${requestId} (${data.quantity} ${data.unit} ${data.itemNeeded})`,
      result: `Zone: ${data.zoneName} · Priority: ${data.priority}`,
      type: 'SYSTEM'
    });
    return requestId;
  };

  /** Add Resource Depot / Stock */
  const addResource = (data: {
    name: string;
    category: ResourceCategory;
    quantity: number;
    unit: string;
    locationName: string;
    coordinates: Coordinates;
    contactPerson: string;
    contactNumber: string;
  }) => {
    const resId = `RES-NCR-${Math.floor(Math.random() * 800) + 100}`;
    const newRes: ResourceItem = {
      id: resId,
      name: data.name,
      category: data.category,
      quantity: data.quantity,
      allocatedQuantity: 0,
      unit: data.unit,
      locationName: data.locationName,
      coordinates: data.coordinates,
      status: 'AVAILABLE',
      lastUpdated: new Date().toISOString(),
      contactPerson: data.contactPerson,
      contactNumber: data.contactNumber
    };
    setResources(prev => [newRes, ...prev]);
    addToast('SUCCESS', `Resource stockpile ${resId} registered at ${data.locationName}.`);
    addAuditLog({
      actor: 'Depot Manager',
      action: 'Resource Depot Registered',
      target: `${resId} (${data.quantity} ${data.unit} ${data.name})`,
      result: `Location: ${data.locationName}`,
      type: 'SYSTEM'
    });
    return resId;
  };

  /** Add Fleet Vehicle */
  const addVehicle = (data: {
    name: string;
    type: any;
    capacity: string;
    location: Coordinates;
    driverName: string;
    driverContact: string;
    teamName?: string;
  }) => {
    const vehId = `VEH-${data.type.substring(0, 3)}-${Math.floor(Math.random() * 800) + 100}`;
    const newVeh: Vehicle = {
      id: vehId,
      name: data.name,
      type: data.type,
      capacity: data.capacity,
      status: 'AVAILABLE',
      location: data.location,
      driverName: data.driverName,
      driverContact: data.driverContact,
      teamName: data.teamName || 'RESERVE-TEAM',
      speedKmh: 0
    };
    setVehicles(prev => [newVeh, ...prev]);
    addToast('SUCCESS', `Fleet unit ${vehId} (${data.name}) registered to command network.`);
    addAuditLog({
      actor: 'Fleet Coordinator',
      action: 'Vehicle Added to Fleet',
      target: `${vehId} (${data.name})`,
      result: `Driver: ${data.driverName} · Type: ${data.type}`,
      type: 'SYSTEM'
    });
    return vehId;
  };

  /** Add Shelter Facility */
  const addShelter = (data: {
    name: string;
    locationName: string;
    coordinates: Coordinates;
    capacityTotal: number;
    capacityOccupied?: number;
    contactPerson: string;
    contactNumber: string;
    resourcesAvailable: string[];
  }) => {
    const shlId = `SHL-DEL-${Math.floor(Math.random() * 80) + 10}`;
    const newShelter: Shelter = {
      id: shlId,
      name: data.name,
      locationName: data.locationName,
      coordinates: data.coordinates,
      capacityTotal: data.capacityTotal,
      capacityOccupied: data.capacityOccupied || 0,
      status: (data.capacityOccupied || 0) >= data.capacityTotal ? 'FULL' : 'OPEN',
      contactPerson: data.contactPerson,
      contactNumber: data.contactNumber,
      resourcesAvailable: data.resourcesAvailable
    };
    setShelters(prev => [newShelter, ...prev]);
    addToast('SUCCESS', `Shelter ${shlId} (${data.name}) registered in safe haven grid.`);
    addAuditLog({
      actor: 'Shelter Administration',
      action: 'Shelter Facility Registered',
      target: `${shlId} (${data.name})`,
      result: `Capacity: ${data.capacityTotal} Beds · ${data.locationName}`,
      type: 'SYSTEM'
    });
    return shlId;
  };

  /** Allocate resource to demand (Matching Engine) */
  const allocateResourceToRequest = (
    demandId: string,
    resourceId: string,
    quantity: number
  ): string => {
    const allocationId = `ALLOC-2026-${Math.floor(Math.random() * 900) + 100}`;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

    let allocatedDemand: DemandRequest | undefined;
    let allocatedResource: ResourceItem | undefined;

    // 1. Update resource stock
    setResources(prev =>
      prev.map(res => {
        if (res.id !== resourceId) return res;
        allocatedResource = res;
        const newQty = Math.max(0, res.quantity - quantity);
        const newAlloc = (res.allocatedQuantity ?? 0) + quantity;
        return {
          ...res,
          quantity: newQty,
          allocatedQuantity: newAlloc,
          allocationId,
          status: newQty === 0 ? 'DEPLETED' as ResourceStatus : (newQty < res.quantity * 0.2 ? 'LOW' as ResourceStatus : res.status),
          lastUpdated: new Date().toISOString()
        };
      })
    );

    // 2. Update demand status
    setRequests(prev =>
      prev.map(req => {
        if (req.id !== demandId) return req;
        allocatedDemand = req;
        return {
          ...req,
          status: 'ALLOCATED' as RequestStatus,
          allocatedResourceId: resourceId
        };
      })
    );

    // 3. Update linked incident timeline
    if (allocatedDemand?.incidentId) {
      const incId = allocatedDemand.incidentId;
      setIncidents(prev =>
        prev.map(inc => {
          if (inc.id !== incId) return inc;
          const currentTimeline = inc.timeline || [];
          return {
            ...inc,
            status: 'RESOURCE_MATCHED' as IncidentStatus,
            updatedAt: new Date().toISOString(),
            timeline: [...currentTimeline, {
              time: timeStr,
              title: 'RESOURCE ALLOCATED',
              description: `${quantity.toLocaleString()} units matched from ${allocatedResource?.locationName.split(',')[0] || 'depot'} (Ref: ${allocationId}).`
            }]
          };
        })
      );
    }

    addToast('SUCCESS', `Resource matched: ${quantity} units reserved from stockpile (Ref: ${allocationId}).`);
    addAuditLog({
      actor: 'Matching Engine / Operator',
      action: 'Resource Allocated',
      target: `${demandId} <- ${resourceId}`,
      result: `Allocated ${quantity} units · Allocation Ref: ${allocationId}`,
      type: 'MATCH'
    });

    return allocationId;
  };

  /** Create and dispatch a mission */
  const createAndDispatchMission = (missionData: {
    requestId: string;
    vehicleId: string;
    operatorName?: string;
  }) => {
    const missionId = `DSP-DEL-${Math.floor(Math.random() * 800) + 100}`;
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

    const targetReq = requests.find(r => r.id === missionData.requestId);
    const targetVeh = vehicles.find(v => v.id === missionData.vehicleId);

    const newMission: DispatchMission = {
      id: missionId,
      requestId: missionData.requestId,
      vehicleId: missionData.vehicleId,
      status: 'EN_ROUTE',
      destinationName: targetReq?.zoneName || 'Emergency Drop Zone',
      resourceType: targetReq?.itemNeeded || 'Relief Supplies',
      quantity: targetReq?.quantity || 100,
      unit: targetReq?.unit || 'Units',
      etaMinutes: Math.floor(Math.random() * 15) + 10,
      operatorName: missionData.operatorName || targetVeh?.driverName || 'Field Unit Operator',
      speedKmh: 48,
      distanceKm: 12.4,
      signalStrength: 95,
      fuelPct: 88,
      trafficLevel: 'MODERATE',
      routePath: ['Central Logistics Depot', 'Primary Corridor', targetReq?.zoneName || 'Zone'],
      timeline: [
        { time: timeStr, title: 'MISSION DISPATCHED', done: true },
        { time: '~15 min', title: 'DESTINATION ARRIVAL', done: false }
      ]
    };

    setMissions(prev => [newMission, ...prev]);

    // Update vehicle
    setVehicles(prev =>
      prev.map(veh =>
        veh.id === missionData.vehicleId
          ? {
              ...veh,
              status: 'EN_ROUTE' as VehicleStatus,
              destination: targetReq?.coordinates,
              cargo: `${targetReq?.quantity} ${targetReq?.unit} ${targetReq?.itemNeeded}`,
              speedKmh: 48,
              etaMinutes: 15,
              incidentId: targetReq?.incidentId
            }
          : veh
      )
    );

    // Update request
    setRequests(prev =>
      prev.map(req =>
        req.id === missionData.requestId
          ? { ...req, status: 'DISPATCHED' as RequestStatus, allocatedVehicleId: missionData.vehicleId, eta: '~15 mins' }
          : req
      )
    );

    // Update incident
    if (targetReq?.incidentId) {
      const incId = targetReq.incidentId;
      setIncidents(prev =>
        prev.map(inc => {
          if (inc.id !== incId) return inc;
          const currentTimeline = inc.timeline || [];
          return {
            ...inc,
            status: 'DISPATCHED' as IncidentStatus,
            updatedAt: new Date().toISOString(),
            timeline: [...currentTimeline, {
              time: timeStr,
              title: 'CONVOY DISPATCHED',
              description: `Unit ${missionData.vehicleId} dispatched under mission ${missionId}.`
            }]
          };
        })
      );
    }

    addToast('SUCCESS', `Mission ${missionId} initiated: Unit ${missionData.vehicleId} en route.`);
    addAuditLog({
      actor: missionData.operatorName || 'Logistics Coordinator',
      action: 'Mission Dispatched',
      target: `${missionId} (Vehicle ${missionData.vehicleId})`,
      result: `Destination: ${targetReq?.zoneName} (ETA 15 min)`,
      type: 'DISPATCH'
    });

    return missionId;
  };

  /** Dispatch vehicle directly to incident */
  const dispatchVehicleToIncident = (vehicleId: string, incidentId: string) => {
    const targetIncident = incidents.find(inc => inc.id === incidentId);
    if (!targetIncident) return;

    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

    setVehicles(prev =>
      prev.map(veh =>
        veh.id === vehicleId
          ? {
              ...veh,
              status: 'EN_ROUTE' as VehicleStatus,
              destination: targetIncident.coordinates,
              cargo: `Emergency relief supplies for ${targetIncident.type.replace(/_/g, ' ')}`,
              speedKmh: 50,
              incidentId: incidentId,
              etaMinutes: 18,
            }
          : veh
      )
    );

    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === incidentId) {
          const currentTimeline = inc.timeline || [];
          return {
            ...inc,
            status: 'DISPATCHED' as IncidentStatus,
            assignedTeam: `Dispatched ${vehicleId}`,
            updatedAt: new Date().toISOString(),
            timeline: [...currentTimeline, {
              time: timeStr,
              title: 'UNITS DISPATCHED',
              description: `Logistics vehicle ${vehicleId} mobilized to incident sector.`
            }]
          };
        }
        return inc;
      })
    );

    setRequests(prev =>
      prev.map(req => {
        if (req.incidentId === incidentId) {
          return { ...req, status: 'DISPATCHED' as RequestStatus, allocatedVehicleId: vehicleId, eta: '~18 mins' };
        }
        return req;
      })
    );

    addToast('SUCCESS', `Vehicle ${vehicleId} dispatched to incident ${incidentId}.`);
    addAuditLog({
      actor: 'Operations Commander',
      action: 'Vehicle Dispatched',
      target: `${vehicleId} -> ${incidentId}`,
      result: `Destination: ${targetIncident.location}`,
      type: 'DISPATCH'
    });
  };

  /** Update mission status */
  const updateMissionStatus = (missionId: string, status: DispatchMission['status']) => {
    setMissions(prev =>
      prev.map(m => {
        if (m.id !== missionId) return m;
        return { ...m, status };
      })
    );

    const mission = missions.find(m => m.id === missionId);
    if (mission) {
      if (status === 'ARRIVED') {
        setVehicles(prev =>
          prev.map(v => v.id === mission.vehicleId ? { ...v, status: 'ARRIVED' as VehicleStatus, speedKmh: 0, etaMinutes: 0 } : v)
        );
        addToast('INFO', `Vehicle ${mission.vehicleId} arrived at destination.`);
      } else if (status === 'DELIVERED') {
        setVehicles(prev =>
          prev.map(v => v.id === mission.vehicleId ? { ...v, status: 'AVAILABLE' as VehicleStatus, destination: undefined, cargo: undefined } : v)
        );
      }
    }
  };

  /** Verify & Reconcile Delivery */
  const verifyAndReconcileDelivery = (data: {
    deliveryId: string;
    deliveredQty: number;
    verifiedBy: string;
    notes?: string;
    proofRef?: string;
    exceptionReason?: string;
  }): boolean => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    let targetDelivery: ReliefDelivery | undefined;

    setDeliveries(prev =>
      prev.map(del => {
        if (del.id !== data.deliveryId) return del;
        targetDelivery = del;
        return {
          ...del,
          deliveredQty: data.deliveredQty,
          status: 'VERIFIED',
          verifiedBy: data.verifiedBy,
          verifiedAt: new Date().toISOString(),
          notes: data.notes || del.notes,
          proofRef: data.proofRef,
          exceptionReason: data.exceptionReason
        };
      })
    );

    if (targetDelivery) {
      const isFull = data.deliveredQty >= targetDelivery.requestedQty;
      const targetReqId = targetDelivery.demandId;
      const targetVehId = targetDelivery.vehicleId;
      const targetIncId = targetDelivery.incidentId;

      // Update Demand status
      setRequests(prev =>
        prev.map(req =>
          req.id === targetReqId
            ? { ...req, status: (isFull ? 'FULFILLED' : 'PARTIALLY_FULFILLED') as RequestStatus }
            : req
        )
      );

      // Release vehicle
      setVehicles(prev =>
        prev.map(veh =>
          veh.id === targetVehId
            ? { ...veh, status: 'AVAILABLE' as VehicleStatus, destination: undefined, cargo: undefined, incidentId: undefined }
            : veh
        )
      );

      // Update mission
      setMissions(prev =>
        prev.map(mis =>
          mis.id === targetDelivery?.dispatchId
            ? { ...mis, status: 'DELIVERED' }
            : mis
        )
      );

      // Update incident status and timeline
      if (targetIncId) {
        setIncidents(prev =>
          prev.map(inc => {
            if (inc.id !== targetIncId) return inc;
            const currentTimeline = inc.timeline || [];
            return {
              ...inc,
              status: 'UNDER_RESPONSE' as IncidentStatus,
              updatedAt: new Date().toISOString(),
              timeline: [...currentTimeline, {
                time: timeStr,
                title: 'RELIEF DELIVERED & VERIFIED',
                description: `${data.deliveredQty} units verified on ground by ${data.verifiedBy}.`
              }]
            };
          })
        );
      }

      addToast('SUCCESS', `Delivery ${data.deliveryId} reconciled and verified. Demand marked fulfilled.`);
      addAuditLog({
        actor: data.verifiedBy,
        action: 'Delivery Reconciled & Verified',
        target: `${data.deliveryId} (${data.deliveredQty} units)`,
        result: `Demand: ${targetReqId} -> FULFILLED · Proof: ${data.proofRef || 'On-site Receipt'}`,
        type: 'DELIVERY'
      });
      return true;
    }
    return false;
  };

  /** General Status updaters */
  const updateIncidentStatus = (incidentId: string, status: IncidentStatus) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

    let title = 'STATUS UPDATE';
    let description = `Incident status updated to ${status}.`;

    switch (status) {
      case 'REPORTED':
        title = 'INCIDENT REPORTED';
        description = 'Report registered in central operations registry.';
        break;
      case 'VERIFIED':
        title = 'INCIDENT VERIFIED';
        description = 'Ground reconnaissance and field verification confirmed.';
        break;
      case 'PRIORITIZED':
        title = 'PRIORITY ASSIGNED';
        description = 'Operational priority level designated by watch commander.';
        break;
      case 'RESOURCE_MATCHED':
        title = 'RESOURCE MATCHED';
        description = 'Relief resources successfully allocated from emergency stockpile.';
        break;
      case 'DISPATCHED':
        title = 'UNITS DISPATCHED';
        description = 'Response teams and transport fleet en route to coordinate.';
        break;
      case 'UNDER_RESPONSE':
        title = 'UNDER RESPONSE';
        description = 'Emergency mitigation operations active on ground.';
        break;
      case 'RESOLVED':
        title = 'INCIDENT RESOLVED';
        description = 'All threats mitigated, civilians secured, and operations closed.';
        break;
    }

    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id !== incidentId) return inc;
        const currentTimeline = inc.timeline || [];
        return {
          ...inc,
          status,
          updatedAt: new Date().toISOString(),
          timeline: [...currentTimeline, { time: timeStr, title, description }]
        };
      })
    );

    if (status === 'RESOLVED') {
      setVehicles(prev =>
        prev.map(veh =>
          veh.incidentId === incidentId
            ? { ...veh, status: 'AVAILABLE' as VehicleStatus, incidentId: undefined, destination: undefined, cargo: undefined }
            : veh
        )
      );
    }

    addToast('INFO', `Incident ${incidentId} status updated to ${status}.`);
    addAuditLog({
      actor: 'Duty Commander',
      action: 'Incident Status Update',
      target: incidentId,
      result: `Status -> ${status}`,
      type: status === 'VERIFIED' ? 'VERIFY' : status === 'RESOLVED' ? 'RESOLVE' : 'SYSTEM'
    });
  };

  const setIncidentPriority = (incidentId: string, severity: Severity) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id !== incidentId) return inc;
        const currentTimeline = inc.timeline || [];
        return {
          ...inc,
          severity,
          status: 'PRIORITIZED' as IncidentStatus,
          updatedAt: new Date().toISOString(),
          timeline: [...currentTimeline, {
            time: timeStr,
            title: 'PRIORITY ESCALATED',
            description: `Severity level designated as ${severity} by response director.`
          }]
        };
      })
    );

    addToast('WARNING', `Incident ${incidentId} severity updated to ${severity}.`);
    addAuditLog({
      actor: 'Response Director',
      action: 'Priority Designated',
      target: incidentId,
      result: `Severity -> ${severity}`,
      type: 'PRIORITIZE'
    });
  };

  const updateVehicleStatus = (vehicleId: string, status: VehicleStatus) => {
    setVehicles(prev =>
      prev.map(veh => {
        if (veh.id !== vehicleId) return veh;
        const updates: Partial<Vehicle> = { status };
        if (status === 'AVAILABLE' || status === 'RETURNING') {
          updates.incidentId = undefined;
          updates.destination = undefined;
          updates.cargo = undefined;
          updates.speedKmh = 0;
          updates.etaMinutes = undefined;
        }
        if (status === 'ARRIVED') {
          updates.speedKmh = 0;
          updates.etaMinutes = 0;
        }
        return { ...veh, ...updates };
      })
    );
  };

  const updateResourceStatus = (resourceId: string, status: ResourceStatus) => {
    setResources(prev =>
      prev.map(res =>
        res.id === resourceId
          ? { ...res, status, lastUpdated: new Date().toISOString() }
          : res
      )
    );
  };

  const updateDemandStatus = (demandId: string, status: RequestStatus, resourceId?: string) => {
    setRequests(prev =>
      prev.map(req => {
        if (req.id !== demandId) return req;
        return {
          ...req,
          status,
          allocatedResourceId: resourceId ?? req.allocatedResourceId,
        };
      })
    );
    if (status === 'FULFILLED' && resourceId) {
      updateResourceStatus(resourceId, 'DEPLOYED');
    }
  };

  return (
    <OperationalStateContext.Provider
      value={{
        incidents,
        vehicles,
        requests,
        shelters,
        resources,
        missions,
        deliveries,
        responders,
        hospitals,
        hazardZones,
        auditLogs,
        alerts,
        dataMode,
        setDataMode,
        resetToDemoDataset,
        setMissions,
        setDeliveries,
        setResponders,
        setHospitals,
        setHazardZones,
        toasts,
        addToast,
        removeToast,
        isOffline,
        addAuditLog,
        addIncidentFromSOS,
        addManualIncident,
        addManualRequest,
        addResource,
        addVehicle,
        addShelter,
        dispatchVehicleToIncident,
        createAndDispatchMission,
        updateMissionStatus,
        verifyAndReconcileDelivery,
        updateIncidentStatus,
        setIncidentPriority,
        updateVehicleStatus,
        updateResourceStatus,
        updateDemandStatus,
        allocateResourceToRequest,
        setIncidents,
        setVehicles,
        setRequests,
        setResources,
        setShelters,
      }}
    >
      {children}
    </OperationalStateContext.Provider>
  );
};

export const useOperationalState = () => {
  const context = useContext(OperationalStateContext);
  if (context === undefined) {
    throw new Error('useOperationalState must be used within an OperationalStateProvider');
  }
  return context;
};
