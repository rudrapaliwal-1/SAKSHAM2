import { DepotInput, DemandTargetInput } from './vrp.types.js';
import { calculateHaversineKm } from '../routing/coordinates.js';
import { COMPATIBLE_CATEGORIES } from '../matching/matching.constants.js';

export interface PreprocessedMatch {
  demand: DemandTargetInput;
  matchedDepot: DepotInput | null;
  distanceKm: number;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export class MatchingPreprocessor {
  /**
   * Evaluates demand-to-depot compatibility and selects the optimal candidate depot for each demand point.
   */
  static preprocessDemands(demands: DemandTargetInput[], depots: DepotInput[]): {
    matched: PreprocessedMatch[];
    unmatched: PreprocessedMatch[];
    depotAllocations: Record<string, number>;
  } {
    const matched: PreprocessedMatch[] = [];
    const unmatched: PreprocessedMatch[] = [];
    const depotRemainingStock: Record<string, number> = {};

    depots.forEach((d) => {
      depotRemainingStock[d.id] = (d.availableQuantity || 0) - (d.allocatedQuantity || 0);
    });

    // Sort demands so CRITICAL ones get first claim on depot stock
    const sortedDemands = [...demands].sort((a, b) => {
      const pWeights: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (pWeights[b.priority] || 2) - (pWeights[a.priority] || 2);
    });

    for (const demand of sortedDemands) {
      const reqCat = (demand.category || demand.itemNeeded || 'OTHER').toUpperCase();
      const compatibleList = COMPATIBLE_CATEGORIES[reqCat] || [reqCat];

      // Find compatible depots with positive stock
      const candidateDepots = depots.filter((depot) => {
        const depotCat = (depot.category || '').toUpperCase();
        const depotResourceTypes = (depot.resourceTypes || []).map((t) => t.toUpperCase());
        const isCompatible =
          compatibleList.includes(depotCat) ||
          depotCat === reqCat ||
          depotResourceTypes.some((t) => compatibleList.includes(t) || t === reqCat);

        return isCompatible && (depotRemainingStock[depot.id] || 0) > 0;
      });

      if (candidateDepots.length === 0) {
        unmatched.push({
          demand,
          matchedDepot: null,
          distanceKm: 0,
          isEligible: false,
          ineligibilityReason: `No depot currently stocked with compatible resource (${demand.category || demand.itemNeeded}).`,
        });
        continue;
      }

      // Rank candidate depots by distance + available stock
      let bestDepot: DepotInput | null = null;
      let minDistance = Infinity;

      for (const depot of candidateDepots) {
        const dist = calculateHaversineKm(demand.location, depot.location);
        const availableStock = depotRemainingStock[depot.id] || 0;

        // Prefer closer depot; if ties, prefer depot with larger buffer
        if (dist < minDistance && availableStock >= Math.min(demand.quantity, availableStock)) {
          minDistance = dist;
          bestDepot = depot;
        }
      }

      if (bestDepot) {
        const allocated = Math.min(demand.quantity, depotRemainingStock[bestDepot.id]);
        depotRemainingStock[bestDepot.id] -= allocated;

        matched.push({
          demand: {
            ...demand,
            assignedDepotId: bestDepot.id,
          },
          matchedDepot: bestDepot,
          distanceKm: Math.round(minDistance * 10) / 10,
          isEligible: true,
        });
      } else {
        unmatched.push({
          demand,
          matchedDepot: null,
          distanceKm: 0,
          isEligible: false,
          ineligibilityReason: `Depot stock depleted for ${demand.itemNeeded}.`,
        });
      }
    }

    const depotAllocations: Record<string, number> = {};
    depots.forEach((d) => {
      const initial = (d.availableQuantity || 0) - (d.allocatedQuantity || 0);
      const remaining = depotRemainingStock[d.id] || 0;
      depotAllocations[d.id] = initial - remaining;
    });

    return { matched, unmatched, depotAllocations };
  }
}
