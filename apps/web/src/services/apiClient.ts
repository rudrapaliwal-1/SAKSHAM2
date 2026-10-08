/**
 * SAKSHAM Centralized API Client Service
 * Bridges React frontend modules to backend REST APIs.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<{ data: T; meta?: any }> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `HTTP Error ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  if (json && typeof json === 'object' && 'data' in json) {
    return json;
  }
  return { data: json };
}

export const apiClient = {
  // ── Incidents ──
  async getIncidents(params?: { status?: string; severity?: string; search?: string; region?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.set(key, String(val));
        }
      });
    }
    const queryString = query.toString();
    return fetchJson<any[]>(`/incidents${queryString ? `?${queryString}` : ''}`);
  },

  async getIncidentById(id: string) {
    return fetchJson<any>(`/incidents/${id}`);
  },

  async createIncident(data: any) {
    return fetchJson<any>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateIncident(id: string, data: any) {
    return fetchJson<any>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateIncidentStatus(id: string, status: string) {
    return fetchJson<any>(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // ── Demands ──
  async getDemands(params?: { status?: string; priority?: string; incidentId?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.set(key, String(val));
        }
      });
    }
    const queryString = query.toString();
    return fetchJson<any[]>(`/demands${queryString ? `?${queryString}` : ''}`);
  },

  async getDemandById(id: string) {
    return fetchJson<any>(`/demands/${id}`);
  },

  async createDemand(data: any) {
    return fetchJson<any>('/demands', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDemand(id: string, data: any) {
    return fetchJson<any>(`/demands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateDemandStatus(id: string, status: string) {
    return fetchJson<any>(`/demands/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // ── Resources ──
  async getResources(params?: { category?: string; status?: string; search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.set(key, String(val));
        }
      });
    }
    const queryString = query.toString();
    return fetchJson<any[]>(`/resources${queryString ? `?${queryString}` : ''}`);
  },

  async getResourceById(id: string) {
    return fetchJson<any>(`/resources/${id}`);
  },

  // ── Vehicles ──
  async getVehicles(params?: { status?: string; type?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.set(key, String(val));
        }
      });
    }
    const queryString = query.toString();
    return fetchJson<any[]>(`/vehicles${queryString ? `?${queryString}` : ''}`);
  },

  async getVehicleById(id: string) {
    return fetchJson<any>(`/vehicles/${id}`);
  },

  // ── Shelters ──
  async getShelters(params?: { status?: string; region?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.set(key, String(val));
        }
      });
    }
    const queryString = query.toString();
    return fetchJson<any[]>(`/shelters${queryString ? `?${queryString}` : ''}`);
  },

  async getShelterById(id: string) {
    return fetchJson<any>(`/shelters/${id}`);
  },

  // ── Timelines ──
  async getIncidentTimeline(incidentId: string) {
    return fetchJson<any[]>(`/incidents/${incidentId}/timeline`);
  },

  async createIncidentTimelineEvent(incidentId: string, data: { eventType: string; message: string; actorId?: string; metadata?: any }) {
    return fetchJson<any>(`/incidents/${incidentId}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ── Matching & Allocations ──
  async getMatchingRecommendations(demandId: string) {
    return fetchJson<any>(`/matching/demands/${demandId}/recommendations`);
  },

  async getAllocations(params?: { status?: string; demandId?: string; resourceId?: string; search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.set(key, String(val));
        }
      });
    }
    const queryString = query.toString();
    return fetchJson<any[]>(`/allocations${queryString ? `?${queryString}` : ''}`);
  },

  async getAllocation(id: string) {
    return fetchJson<any>(`/allocations/${id}`);
  },

  async createAllocation(data: { demandId: string; resourceId: string; quantity: number; vehicleId?: string }) {
    return fetchJson<any>('/allocations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveAllocation(id: string) {
    return fetchJson<any>(`/allocations/${id}/approve`, {
      method: 'POST',
    });
  },

  async rejectAllocation(id: string, reason: string) {
    return fetchJson<any>(`/allocations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // ── Routing (OSRM road geometry + OR-Tools fleet assignment) ──
  /**
   * Real road-following route geometry for a dispatch (vehicle -> resource
   * depot -> incident site), as GeoJSON-style [lng, lat] coordinate pairs.
   * Falls back server-side to a straight-line approximation if OSRM is
   * disabled or unreachable — check the `source` field on the response.
   */
  async getDispatchRoute(dispatchId: string) {
    return fetchJson<{
      dispatchId: string;
      vehicleId: string;
      geometry: [number, number][];
      distanceKm: number;
      durationMinutes: number;
      source: 'local' | 'public_fallback' | 'straight_line_fallback';
    }>(`/routing/dispatch/${dispatchId}/route`);
  },

  /**
   * Jointly assigns available vehicles to approved-but-unassigned
   * allocations using OR-Tools, minimizing total road distance weighted
   * by demand priority. Pass allocationIds to target a specific subset,
   * or omit to target every eligible approved allocation.
   */
  async optimizeFleet(allocationIds?: string[]) {
    return fetchJson<{
      assignments: Array<{
        allocationId: string;
        vehicleId: string;
        vehicleName: string;
        demandId: string;
        resourceId: string;
        distanceKm: number;
        priority: string;
      }>;
      unassignedAllocationIds: string[];
      osrmSource: string;
    }>('/routing/optimize-fleet', {
      method: 'POST',
      body: JSON.stringify({ allocationIds: allocationIds ?? null }),
    });
  },
};
export default apiClient;
