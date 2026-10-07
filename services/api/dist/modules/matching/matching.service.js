"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingService = void 0;
const db_js_1 = require("../../db/db.js");
const inMemoryStore_js_1 = require("../../db/inMemoryStore.js");
const distance_js_1 = require("../../utils/distance.js");
const matching_constants_js_1 = require("./matching.constants.js");
const client_1 = require("@prisma/client");
class MatchingService {
    /**
     * Generates ranked recommendations for a given demand request.
     */
    static async getRecommendations(demandId) {
        try {
            // 1. Fetch demand details along with incident coordinates
            const demand = await db_js_1.prisma.demandRequest.findUnique({
                where: { id: demandId },
                include: { incident: true },
            });
            if (!demand) {
                throw new Error(`Demand request ${demandId} not found.`);
            }
            // Determine compatible resource categories
            const compatibleCats = matching_constants_js_1.COMPATIBLE_CATEGORIES[demand.requestedType] ?? [demand.requestedType];
            // 2. Fetch candidate resources matching the categories
            const resources = await db_js_1.prisma.resource.findMany({
                where: {
                    category: { in: compatibleCats },
                },
            });
            return MatchingService.rankResources(demand.quantity, demand.requestedType, demand.priority, demand.incident.latitude, demand.incident.longitude, resources.map(r => ({
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
            })), demandId);
        }
        catch (err) {
            // Fallback to inMemoryStore
            const inMemDemand = inMemoryStore_js_1.inMemoryStore.getDemandById(demandId);
            if (!inMemDemand) {
                throw new Error(`Demand request ${demandId} not found.`);
            }
            const inMemResources = inMemoryStore_js_1.inMemoryStore.getResources();
            return MatchingService.rankResources(inMemDemand.quantity, inMemDemand.category || inMemDemand.itemNeeded, inMemDemand.priority, inMemDemand.coordinates.lat, inMemDemand.coordinates.lng, inMemResources.map(r => ({
                id: r.id,
                materialName: r.name,
                category: r.category,
                storageDepot: r.locationName,
                availableQuantity: r.quantity,
                reservedQuantity: r.allocatedQuantity ?? 0,
                unit: r.unit,
                status: r.status,
                latitude: r.coordinates.lat,
                longitude: r.coordinates.lng,
            })), demandId);
        }
    }
    static rankResources(demandQuantity, requestedType, demandPriority, demandLat, demandLng, resources, demandId) {
        const recommendations = [];
        for (const res of resources) {
            // 3. Eligibility filters
            // A resource is considered INELIGIBLE if:
            // - status is DEPLETED or RESERVED
            // - availableQuantity is <= 0
            // - categories do not match
            const ineligibleStatuses = [client_1.ResourceStatus.DEPLETED, client_1.ResourceStatus.RESERVED];
            const isStatusIneligible = ineligibleStatuses.includes(res.status);
            const isQuantityIneligible = res.availableQuantity - res.reservedQuantity <= 0;
            // Category compatibility check
            const reqUpper = (requestedType || '').toUpperCase();
            const compatibleList = matching_constants_js_1.COMPATIBLE_CATEGORIES[reqUpper] || [reqUpper];
            const isCategoryCompatible = compatibleList.includes(res.category?.toUpperCase()) ||
                res.category?.toUpperCase() === reqUpper;
            if (isStatusIneligible || isQuantityIneligible || !isCategoryCompatible) {
                continue;
            }
            // Calculate availability parameters
            const unreservedQty = res.availableQuantity - res.reservedQuantity;
            const canFullyFulfill = unreservedQty >= demandQuantity;
            // Distance calculation
            const dist = (0, distance_js_1.calculateHaversineDistance)(demandLat, demandLng, res.latitude, res.longitude);
            const distKm = Math.round(dist * 10) / 10;
            // Compatibility Score (35%)
            const compatScore = matching_constants_js_1.MATCH_WEIGHTS.COMPATIBILITY;
            // Availability Score (25%)
            let availScore = 0;
            let availReason = '';
            if (canFullyFulfill) {
                availScore = matching_constants_js_1.MATCH_WEIGHTS.AVAILABILITY;
                availReason = `Sufficient quantity is available: ${unreservedQty.toLocaleString()} ${res.unit} (requires ${demandQuantity.toLocaleString()}).`;
            }
            else {
                const ratio = unreservedQty / demandQuantity;
                availScore = Math.round(matching_constants_js_1.MATCH_WEIGHTS.AVAILABILITY * ratio);
                availReason = `Partial stock: ${unreservedQty.toLocaleString()} of ${demandQuantity.toLocaleString()} ${res.unit} available (${Math.round(ratio * 100)}% of demand).`;
            }
            // Distance Score (20%)
            let distScore = 0;
            const wDist = matching_constants_js_1.MATCH_WEIGHTS.DISTANCE;
            if (dist <= 3)
                distScore = wDist;
            else if (dist <= 7)
                distScore = Math.round(wDist * 0.88);
            else if (dist <= 12)
                distScore = Math.round(wDist * 0.72);
            else if (dist <= 18)
                distScore = Math.round(wDist * 0.56);
            else if (dist <= 25)
                distScore = Math.round(wDist * 0.36);
            else if (dist <= 40)
                distScore = Math.round(wDist * 0.20);
            else
                distScore = Math.max(0, Math.round(wDist * (1 - dist / 80)));
            // Priority Score (10%)
            let prioScore = 0;
            const wPrio = matching_constants_js_1.MATCH_WEIGHTS.PRIORITY;
            if (demandPriority === 'CRITICAL')
                prioScore = wPrio;
            else if (demandPriority === 'HIGH')
                prioScore = Math.round(wPrio * 0.85);
            else if (demandPriority === 'MEDIUM')
                prioScore = Math.round(wPrio * 0.65);
            else
                prioScore = Math.round(wPrio * 0.45);
            // Readiness Score (10%)
            let readScore = 0;
            const wRead = matching_constants_js_1.MATCH_WEIGHTS.READINESS;
            if (res.status === client_1.ResourceStatus.AVAILABLE)
                readScore = wRead;
            else if (res.status === client_1.ResourceStatus.LOW)
                readScore = Math.round(wRead * 0.7);
            else if (res.status === client_1.ResourceStatus.IN_TRANSIT)
                readScore = Math.round(wRead * 0.4);
            // Final Score
            const finalScore = compatScore + availScore + distScore + prioScore + readScore;
            // Quality Label
            let qualityLabel;
            if (finalScore >= 90)
                qualityLabel = 'EXCELLENT';
            else if (finalScore >= 75)
                qualityLabel = 'GOOD';
            else if (finalScore >= 50)
                qualityLabel = 'PARTIAL';
            else if (finalScore >= 20)
                qualityLabel = 'POOR';
            else
                qualityLabel = 'INCOMPATIBLE';
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
        let status = 'NO_MATCH_FOUND';
        if (recommendations.length > 0) {
            status = recommendations.some(r => r.canFullyFulfill) ? 'MATCHES_FOUND' : 'PARTIAL_MATCHES_FOUND';
        }
        // Combination logic for partial coverage (if best match cannot satisfy)
        let fullCoveragePossible = false;
        let candidateCombination = null;
        if (bestMatch && !bestMatch.canFullyFulfill) {
            let accumulated = 0;
            const combo = [];
            for (const rec of recommendations) {
                if (accumulated >= demandQuantity)
                    break;
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
exports.MatchingService = MatchingService;
