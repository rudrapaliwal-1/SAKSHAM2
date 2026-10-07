/**
 * SAKSHAM Demand → Resource Matching Engine
 * ─────────────────────────────────────────────────────────────────────────
 * Deterministic scoring model that ranks resource candidates against a demand.
 *
 * ARCHITECTURE NOTE:
 * The main entry point is `matchResources(demand, resources, context)`.
 * The current implementation uses a weighted deterministic scoring model.
 * This interface is designed so it can later be replaced or supplemented by:
 *   - ML-based ranking
 *   - Travel-time prediction (OSRM / Google Maps API)
 *   - Resource depletion forecasting
 *   - Historical allocation success scoring
 *   - Incident severity weighting
 * without changing any calling code.
 */

import type { DemandRequest } from '../types/request';
import type { ResourceItem } from '../types/resource';

// ─── Scoring Weights ─────────────────────────────────────────────────────────
// Centralized constants. Edit here to rebalance the model.
// Sum must equal 100.
export const MATCH_WEIGHTS = {
  availability: 40,
  distance: 25,
  priority: 20,
  compatibility: 10,
  allocationPressure: 5,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchScoreBreakdown {
  availability: number;        // 0–40
  distance: number;            // 0–25
  priority: number;            // 0–20
  compatibility: number;       // 0–10
  allocationPressure: number;  // 0–5
  total: number;               // 0–100
}

export type MatchQuality = 'EXCELLENT' | 'GOOD' | 'PARTIAL' | 'POOR' | 'INCOMPATIBLE';

export interface MatchResult {
  resourceId: string;
  matchScore: number;
  breakdown: MatchScoreBreakdown;
  availableQuantity: number;
  requestedQuantity: number;
  canFullyFulfill: boolean;
  distanceKm: number;
  estimatedDeliveryMinutes: number;
  estimatedDeliveryTime: string;
  explainableSentence: string;
  qualityLabel: MatchQuality;
  reasoning: string[];         // Human-readable explanation per component
  rank: number;
}

export interface SplitAllocationPart {
  resourceId: string;
  quantity: number;
  matchScore: number;
  distanceKm: number;
}

export interface SplitAllocation {
  parts: SplitAllocationPart[];
  totalQuantity: number;
  requestedQuantity: number;
  isFulfilled: boolean;
  shortfall: number;
}

export interface MatchContext {
  otherRequests?: DemandRequest[];
}

export interface MatchEngineOutput {
  results: MatchResult[];
  bestMatch: MatchResult | null;
  splitAllocation: SplitAllocation | null;
  canFulfill: boolean;
  totalAvailableCompatible: number;
  shortfall: number;
}

// ─── Distance (Haversine Formula) ─────────────────────────────────────────────

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const a1 =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
}

// ─── Category Compatibility Map ───────────────────────────────────────────────
// Maps demand category → compatible resource categories.
const COMPATIBLE_CATEGORIES: Record<string, string[]> = {
  WATER: ['WATER'],
  FOOD: ['FOOD'],
  MEDICAL: ['MEDICAL'],
  SHELTER_SUPPLIES: ['SHELTER_SUPPLIES'],
  CLOTHING: ['CLOTHING'],
  RESCUE_EQUIPMENT: ['RESCUE_EQUIPMENT'],
  VEHICLES: ['VEHICLES'],
  OTHER: ['OTHER', 'WATER', 'FOOD'], // generic requests can use any
};

function categoryScore(demandCategory: string, resourceCategory: string): number {
  const compatible = COMPATIBLE_CATEGORIES[demandCategory] ?? [demandCategory];
  return compatible.includes(resourceCategory) ? MATCH_WEIGHTS.compatibility : 0;
}

// ─── Component Scorers ────────────────────────────────────────────────────────

function scoreAvailability(
  demand: DemandRequest,
  resource: ResourceItem
): { score: number; reasoning: string } {
  const w = MATCH_WEIGHTS.availability;

  if (['DEPLETED', 'RESERVED', 'IN_TRANSIT'].includes(resource.status)) {
    return {
      score: 0,
      reasoning: `Resource unavailable — current status: ${resource.status}.`,
    };
  }

  if (resource.quantity <= 0) {
    return { score: 0, reasoning: 'Stock is depleted (zero units available).' };
  }

  if (resource.quantity >= demand.quantity) {
    return {
      score: w,
      reasoning: `Full stock available: ${resource.quantity.toLocaleString()} ${resource.unit} (requires ${demand.quantity.toLocaleString()}).`,
    };
  }

  // Partial availability — proportional score
  const ratio = resource.quantity / demand.quantity;
  const score = Math.round(w * ratio);
  return {
    score,
    reasoning: `Partial stock: ${resource.quantity.toLocaleString()} of ${demand.quantity.toLocaleString()} ${resource.unit} available (${Math.round(ratio * 100)}% of demand).`,
  };
}

function scoreDistance(
  demand: DemandRequest,
  resource: ResourceItem
): { score: number; distanceKm: number; reasoning: string } {
  const w = MATCH_WEIGHTS.distance;
  const dist = haversineKm(demand.coordinates, resource.coordinates);
  const d = Math.round(dist * 10) / 10;

  let score: number;
  if (dist <= 3)       score = w;                       // 25 — very close
  else if (dist <= 7)  score = Math.round(w * 0.88);   // 22
  else if (dist <= 12) score = Math.round(w * 0.72);   // 18
  else if (dist <= 18) score = Math.round(w * 0.56);   // 14
  else if (dist <= 25) score = Math.round(w * 0.36);   // 9
  else if (dist <= 40) score = Math.round(w * 0.20);   // 5
  else                 score = Math.max(0, Math.round(w * (1 - dist / 80)));

  return {
    score: Math.max(0, Math.min(w, score)),
    distanceKm: d,
    reasoning: `Resource depot is ${d} km from the demand location.`,
  };
}

function scorePriority(
  demand: DemandRequest,
  resource: ResourceItem
): { score: number; reasoning: string } {
  const w = MATCH_WEIGHTS.priority;

  if (['DEPLETED', 'RESERVED'].includes(resource.status)) {
    return { score: 0, reasoning: 'Resource cannot support any priority demand.' };
  }

  const priorityMap: Record<string, number> = {
    CRITICAL: w,                     // 20
    HIGH:     Math.round(w * 0.85), // 17
    MEDIUM:   Math.round(w * 0.65), // 13
    LOW:      Math.round(w * 0.45), // 9
  };

  const score = priorityMap[demand.priority] ?? Math.round(w * 0.5);
  return {
    score,
    reasoning: `Demand priority is ${demand.priority}; resource meets this operational level.`,
  };
}

function scoreCompatibility(
  demand: DemandRequest,
  resource: ResourceItem
): { score: number; reasoning: string } {
  const score = categoryScore(demand.category, resource.category);
  const reasoning =
    score > 0
      ? `Resource category (${resource.category}) is compatible with demand (${demand.category}).`
      : `Resource category (${resource.category}) does not match demand (${demand.category}).`;
  return { score, reasoning };
}

function scoreAllocationPressure(
  resource: ResourceItem,
  context: MatchContext
): { score: number; reasoning: string } {
  const w = MATCH_WEIGHTS.allocationPressure;
  const competing = (context.otherRequests ?? []).filter(
    r =>
      r.allocatedResourceId === resource.id &&
      ['ALLOCATED', 'MATCHED', 'DISPATCHED', 'FULFILLING'].includes(r.status)
  ).length;

  let score: number;
  if (competing === 0)      score = w;  // 5 — no pressure
  else if (competing === 1) score = 4;
  else if (competing === 2) score = 2;
  else                      score = 1;

  return {
    score,
    reasoning:
      competing === 0
        ? 'No competing active allocations on this resource.'
        : `${competing} other active allocation(s) competing for this resource.`,
  };
}

function qualityLabel(score: number): MatchQuality {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 50) return 'PARTIAL';
  if (score >= 20) return 'POOR';
  return 'INCOMPATIBLE';
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

/**
 * matchResources — Core matching engine entry point.
 *
 * Scores and ranks all candidate resources against a demand request.
 * Pure function: no side effects, no React, no network calls.
 *
 * Replace or wrap this function in the future to use:
 *  - ML scoring model
 *  - External optimization API
 *  - Real-time travel time data
 */
export function matchResources(
  demand: DemandRequest,
  resources: ResourceItem[],
  context: MatchContext = {}
): MatchEngineOutput {
  const emptyOutput: MatchEngineOutput = {
    results: [],
    bestMatch: null,
    splitAllocation: null,
    canFulfill: false,
    totalAvailableCompatible: 0,
    shortfall: demand?.quantity ?? 0,
  };

  if (!demand || resources.length === 0) return emptyOutput;

  const results: MatchResult[] = [];

  for (const resource of resources) {
    // Skip wholly incompatible categories
    if (categoryScore(demand.category, resource.category) === 0) continue;

    const avail   = scoreAvailability(demand, resource);
    const dist    = scoreDistance(demand, resource);
    const prio    = scorePriority(demand, resource);
    const compat  = scoreCompatibility(demand, resource);
    const pressure = scoreAllocationPressure(resource, context);

    const total =
      avail.score + dist.score + prio.score + compat.score + pressure.score;

    const canFullyFulfill =
      resource.status === 'AVAILABLE' && resource.quantity >= demand.quantity;

    const estMinutes = Math.max(4, Math.round((dist.distanceKm / 45) * 60 + 4));
    const estDeliveryTime = `~${estMinutes} mins`;
    const isComp = categoryScore(demand.category, resource.category) > 0;

    const explainableSentence = isComp
      ? `Recommended Resource ${resource.id} because it satisfies the requested ${demand.category.toLowerCase()} category, has ${canFullyFulfill ? 'sufficient stock' : 'partial stock'} (${resource.quantity.toLocaleString()} ${resource.unit} available vs ${demand.quantity.toLocaleString()} requested), is ${dist.distanceKm} km away (${estDeliveryTime} transit), and the request is ${demand.priority}.`
      : `Resource ${resource.id} (${resource.category}) is incompatible with requested ${demand.category} demand.`;

    results.push({
      resourceId: resource.id,
      matchScore: total,
      breakdown: {
        availability:       avail.score,
        distance:           dist.score,
        priority:           prio.score,
        compatibility:      compat.score,
        allocationPressure: pressure.score,
        total,
      },
      availableQuantity:  resource.quantity,
      requestedQuantity:  demand.quantity,
      canFullyFulfill,
      distanceKm:         dist.distanceKm,
      estimatedDeliveryMinutes: estMinutes,
      estimatedDeliveryTime: estDeliveryTime,
      explainableSentence,
      qualityLabel:       qualityLabel(total),
      reasoning: [
        avail.reasoning,
        dist.reasoning,
        prio.reasoning,
        compat.reasoning,
        pressure.reasoning,
      ],
      rank: 0,
    });
  }

  // Sort by total score descending
  results.sort((a, b) => b.matchScore - a.matchScore);
  results.forEach((r, i) => { r.rank = i + 1; });

  const bestMatch = results.length > 0 ? results[0] : null;
  const canFulfill = bestMatch?.canFullyFulfill ?? false;

  // Total available compatible stock
  const totalAvailableCompatible = resources
    .filter(
      r =>
        categoryScore(demand.category, r.category) > 0 &&
        r.status === 'AVAILABLE' &&
        r.quantity > 0
    )
    .reduce((sum, r) => sum + r.quantity, 0);

  const shortfall = Math.max(0, demand.quantity - totalAvailableCompatible);

  // Build split allocation if best match cannot fully satisfy demand
  let splitAllocation: SplitAllocation | null = null;
  if (!canFulfill && totalAvailableCompatible > 0) {
    const parts: SplitAllocationPart[] = [];
    let remaining = demand.quantity;

    for (const result of results) {
      if (remaining <= 0) break;
      const resource = resources.find(r => r.id === result.resourceId);
      if (!resource || resource.status !== 'AVAILABLE' || resource.quantity <= 0) continue;

      const take = Math.min(resource.quantity, remaining);
      parts.push({
        resourceId:  result.resourceId,
        quantity:    take,
        matchScore:  result.matchScore,
        distanceKm:  result.distanceKm,
      });
      remaining -= take;
    }

    splitAllocation = {
      parts,
      totalQuantity:     demand.quantity - remaining,
      requestedQuantity: demand.quantity,
      isFulfilled:       remaining <= 0,
      shortfall:         Math.max(0, remaining),
    };
  }

  return {
    results,
    bestMatch,
    splitAllocation,
    canFulfill,
    totalAvailableCompatible,
    shortfall,
  };
}
