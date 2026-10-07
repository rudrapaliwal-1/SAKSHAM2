import { prisma } from '../../db/db.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';
import { calculateHaversineDistance } from '../../utils/distance.js';
import { MATCH_WEIGHTS, COMPATIBLE_CATEGORIES } from './matching.constants.js';
import { ResourceStatus, DemandStatus } from '@prisma/client';

export interface ScoreBreakdown {
  compatibility: number;
  availability: number;
  distance: number;
  priority: number;
  readiness: number;
  total: number;
}

export interface Recommendation {
  resourceId: string;
  name: string;
  category: string;
  storageDepot: string;
  availableQuantity: number;
  requestedQuantity: number;
  canFullyFulfill: boolean;
  distanceKm: number;
  score: number;
  breakdown: ScoreBreakdown;
  qualityLabel: 'EXCELLENT' | 'GOOD' | 'PARTIAL' | 'POOR' | 'INCOMPATIBLE';
  explanation: string[];
}

export interface MatchingOutput {
  status: 'MATCHES_FOUND' | 'PARTIAL_MATCHES_FOUND' | 'NO_MATCH_FOUND';
  demandId?: string;
  matches?: Array<{ resourceId: string; name: string; score: number; distanceKm: number; breakdown: ScoreBreakdown; recommended: boolean }>;
  results: Recommendation[];
  bestMatch: Recommendation | null;
  fullCoveragePossible: boolean;
  candidateCombination: Array<{ resourceId: string; quantity: number }> | null;
}

export class MatchingService {
  /**
   * Generates ranked recommendations for a given demand request.
   */
  static async getRecommendations(demandId: string): Promise<MatchingOutput> {
    try {
      // 1. Fetch demand details along with incident coordinates
      const demand = await prisma.demandRequest.findUnique({
        where: { id: demandId },
        include: { incident: true },
      });

      if (!demand) {
        throw new Error(`Demand request ${demandId} not found.`);
      }

      // Determine compatible resource categories
      const compatibleCats = COMPATIBLE_CATEGORIES[demand.requestedType] ?? [demand.requestedType];

      // 2. Fetch candidate resources matching the categories
      const resources = await prisma.resource.findMany({
        where: {
          category: { in: compatibleCats },
        },
      });

      return MatchingService.rankResources(
        demand.quantity,
        demand.requestedType,
        demand.priority,
        demand.incident.latitude,
        demand.incident.longitude,
        resources.map(r => ({
          id: r.id,
          materialName: r.materialName,
          category: r.category,
          storageDepot: r.storageDepot,
          availableQuantity: r.availableQuantity,
          reservedQuantity: r.reservedQuantity,
          unit: r.unit,
          status: r.status,
          latitude: r.latitude,
          longitude: r.longitude,
        })),
        demandId
      );
    } catch (err: any) {
      // Fallback to inMemoryStore
      const inMemDemand = inMemoryStore.getDemandById(demandId);
      if (!inMemDemand) {
        throw new Error(`Demand request ${demandId} not found.`);
      }

      const inMemResources = inMemoryStore.getResources();
      return MatchingService.rankResources(
        inMemDemand.quantity,
        inMemDemand.category || inMemDemand.itemNeeded,
        inMemDemand.priority,
        inMemDemand.coordinates.lat,
        inMemDemand.coordinates.lng,
        inMemResources.map(r => ({
          id: r.id,
          materialName: r.name,
          category: r.category,
          storageDepot: r.locationName,
          availableQuantity: r.quantity,
          reservedQuantity: r.allocatedQuantity ?? 0,
          unit: r.unit,
          status: r.status as any,
          latitude: r.coordinates.lat,
          longitude: r.coordinates.lng,
        })),
        demandId
      );
    }
  }

  private static rankResources(
    demandQuantity: number,
    requestedType: string,
    demandPriority: string,
    demandLat: number,
    demandLng: number,
    resources: Array<{
      id: string;
      materialName: string;
      category: string;
      storageDepot: string;
      availableQuantity: number;
      reservedQuantity: number;
      unit: string;
      status: ResourceStatus;
      latitude: number;
      longitude: number;
    }>,
    demandId?: string
  ): MatchingOutput {

    const recommendations: Recommendation[] = [];

    for (const res of resources) {
      // 3. Eligibility filters
      // A resource is considered INELIGIBLE if:
      // - status is DEPLETED or RESERVED
      // - availableQuantity is <= 0
      // - categories do not match
      const ineligibleStatuses: ResourceStatus[] = [ResourceStatus.DEPLETED, ResourceStatus.RESERVED];
      const isStatusIneligible = ineligibleStatuses.includes(res.status);
      const isQuantityIneligible = res.availableQuantity - res.reservedQuantity <= 0;

      // Category compatibility check
      const reqUpper = (requestedType || '').toUpperCase();
      const compatibleList = COMPATIBLE_CATEGORIES[reqUpper] || [reqUpper];
      const isCategoryCompatible = compatibleList.includes(res.category?.toUpperCase()) ||
        res.category?.toUpperCase() === reqUpper;

      if (isStatusIneligible || isQuantityIneligible || !isCategoryCompatible) {
        continue;
      }

      // Calculate availability parameters
      const unreservedQty = res.availableQuantity - res.reservedQuantity;
      const canFullyFulfill = unreservedQty >= demandQuantity;

      // Distance calculation
      const dist = calculateHaversineDistance(
        demandLat,
        demandLng,
        res.latitude,
        res.longitude
      );
      const distKm = Math.round(dist * 10) / 10;

      // Compatibility Score (35%)
      const compatScore = MATCH_WEIGHTS.COMPATIBILITY;

      // Availability Score (25%)
      let availScore = 0;
      let availReason = '';
      if (canFullyFulfill) {
        availScore = MATCH_WEIGHTS.AVAILABILITY;
        availReason = `Sufficient quantity is available: ${unreservedQty.toLocaleString()} ${res.unit} (requires ${demandQuantity.toLocaleString()}).`;
      } else {
        const ratio = unreservedQty / demandQuantity;
        availScore = Math.round(MATCH_WEIGHTS.AVAILABILITY * ratio);
        availReason = `Partial stock: ${unreservedQty.toLocaleString()} of ${demandQuantity.toLocaleString()} ${res.unit} available (${Math.round(ratio * 100)}% of demand).`;
      }

      // Distance Score (20%)
      let distScore = 0;
      const wDist = MATCH_WEIGHTS.DISTANCE;
      if (dist <= 3) distScore = wDist;
      else if (dist <= 7) distScore = Math.round(wDist * 0.88);
      else if (dist <= 12) distScore = Math.round(wDist * 0.72);
      else if (dist <= 18) distScore = Math.round(wDist * 0.56);
      else if (dist <= 25) distScore = Math.round(wDist * 0.36);
      else if (dist <= 40) distScore = Math.round(wDist * 0.20);
      else distScore = Math.max(0, Math.round(wDist * (1 - dist / 80)));

      // Priority Score (10%)
      let prioScore = 0;
      const wPrio = MATCH_WEIGHTS.PRIORITY;
      if (demandPriority === 'CRITICAL') prioScore = wPrio;
      else if (demandPriority === 'HIGH') prioScore = Math.round(wPrio * 0.85);
      else if (demandPriority === 'MEDIUM') prioScore = Math.round(wPrio * 0.65);
      else prioScore = Math.round(wPrio * 0.45);

      // Readiness Score (10%)
      let readScore = 0;
      const wRead = MATCH_WEIGHTS.READINESS;
      if (res.status === ResourceStatus.AVAILABLE) readScore = wRead;
      else if (res.status === ResourceStatus.LOW) readScore = Math.round(wRead * 0.7);
      else if (res.status === ResourceStatus.IN_TRANSIT) readScore = Math.round(wRead * 0.4);

      // Final Score
      const finalScore = compatScore + availScore + distScore + prioScore + readScore;

      // Quality Label
      let qualityLabel: 'EXCELLENT' | 'GOOD' | 'PARTIAL' | 'POOR' | 'INCOMPATIBLE';
      if (finalScore >= 90) qualityLabel = 'EXCELLENT';
      else if (finalScore >= 75) qualityLabel = 'GOOD';
      else if (finalScore >= 50) qualityLabel = 'PARTIAL';
      else if (finalScore >= 20) qualityLabel = 'POOR';
      else qualityLabel = 'INCOMPATIBLE';

      // Explanation components
      const explanation = [
        `Resource type matches the request (${res.category})`,
        availReason,
        `Resource is ${distKm} km from the affected area`,
        `Resource depot readiness status is ${res.status}`,
      ];

      recommendations.push({
        resourceId: res.id,
        name: res.materialName,
        category: res.category,
        storageDepot: res.storageDepot,
        availableQuantity: unreservedQty,
        requestedQuantity: demandQuantity,
        canFullyFulfill,
        distanceKm: distKm,
        score: finalScore,
        breakdown: {
          compatibility: compatScore,
          availability: availScore,
          distance: distScore,
          priority: prioScore,
          readiness: readScore,
          total: finalScore,
        },
        qualityLabel,
        explanation,
      });
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    const bestMatch = recommendations.length > 0 ? recommendations[0] : null;

    // Determine overall result status
    let status: 'MATCHES_FOUND' | 'PARTIAL_MATCHES_FOUND' | 'NO_MATCH_FOUND' = 'NO_MATCH_FOUND';
    if (recommendations.length > 0) {
      status = recommendations.some(r => r.canFullyFulfill) ? 'MATCHES_FOUND' : 'PARTIAL_MATCHES_FOUND';
    }

    // Combination logic for partial coverage (if best match cannot satisfy)
    let fullCoveragePossible = false;
    let candidateCombination: Array<{ resourceId: string; quantity: number }> | null = null;

    if (bestMatch && !bestMatch.canFullyFulfill) {
      let accumulated = 0;
      const combo: Array<{ resourceId: string; quantity: number }> = [];

      for (const rec of recommendations) {
        if (accumulated >= demandQuantity) break;
        const take = Math.min(rec.availableQuantity, demandQuantity - accumulated);
        if (take > 0) {
          combo.push({ resourceId: rec.resourceId, quantity: take });
          accumulated += take;
        }
      }

      if (accumulated >= demandQuantity) {
        fullCoveragePossible = true;
        candidateCombination = combo;
      }
    }

    const matches = recommendations.map((r, i) => ({
      resourceId: r.resourceId,
      name: r.name,
      score: r.score,
      distanceKm: r.distanceKm,
      breakdown: r.breakdown,
      recommended: i === 0,
    }));

    return {
      status,
      demandId,
      matches,
      results: recommendations,
      bestMatch,
      fullCoveragePossible,
      candidateCombination,
    };
  }
}
