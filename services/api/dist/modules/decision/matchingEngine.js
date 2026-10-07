"use strict";
/**
 * SAKSHAM Resource-Demand Decision Matching Engine
 * ─────────────────────────────────────────────────
 * Deterministic multi-factor scoring algorithm that evaluates
 * all candidate stockpiles against a specific relief demand.
 *
 * Scoring Model (100-point scale):
 * 1. Compatibility (10 pts): Strict categorical & item validation (0 if incompatible)
 * 2. Available Quantity (40 pts): Proportional stock satisfaction ratio
 * 3. Distance & Transit (25 pts): Haversine distance & travel impediment
 * 4. Urgency Alignment (20 pts): Demand priority urgency alignment
 * 5. Allocation Pressure & Readiness (5 pts): Status & competing demand pressure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionMatchingEngine = exports.COMPATIBLE_CATEGORIES = void 0;
const distance_js_1 = require("../../utils/distance.js");
exports.COMPATIBLE_CATEGORIES = {
    WATER: ['WATER'],
    FOOD: ['FOOD'],
    MEDICAL: ['MEDICAL'],
    SHELTER_SUPPLIES: ['SHELTER_SUPPLIES'],
    CLOTHING: ['CLOTHING'],
    RESCUE_EQUIPMENT: ['RESCUE_EQUIPMENT'],
    VEHICLES: ['VEHICLES'],
    OTHER: ['OTHER', 'WATER', 'FOOD', 'MEDICAL', 'CLOTHING', 'SHELTER_SUPPLIES', 'RESCUE_EQUIPMENT'],
};
class DecisionMatchingEngine {
    /**
     * Calculates compatibility between demand category and resource category.
     */
    static isCompatible(demandCategory, resourceCategory) {
        const dCat = (demandCategory || 'OTHER').toUpperCase();
        const rCat = (resourceCategory || 'OTHER').toUpperCase();
        if (dCat === rCat)
            return true;
        const compatibleList = exports.COMPATIBLE_CATEGORIES[dCat] ?? [dCat];
        return compatibleList.includes(rCat);
    }
    /**
     * Evaluates a single resource against a demand request.
     */
    static evaluateResourceMatch(demand, resource, competingDemandCount = 0) {
        const isComp = this.isCompatible(demand.category, resource.category);
        const availableStock = Math.max(0, resource.quantity);
        const unreservedStock = Math.max(0, availableStock);
        // Strict Compatibility Score (0 or 10)
        const compatibilityScore = isComp ? 10 : 0;
        // Availability Score (0–40)
        let availabilityScore = 0;
        let availReason = '';
        const isStatusUnusable = resource.status === 'DEPLETED' || resource.status === 'RESERVED';
        if (isStatusUnusable || unreservedStock === 0) {
            availabilityScore = 0;
            availReason = `Resource unavailable (${resource.status} with 0 unreserved stock).`;
        }
        else if (unreservedStock >= demand.quantity) {
            availabilityScore = 40;
            availReason = `Sufficient unreserved stock (${unreservedStock.toLocaleString()} ${resource.unit} available vs ${demand.quantity.toLocaleString()} requested).`;
        }
        else {
            const ratio = unreservedStock / demand.quantity;
            availabilityScore = Math.round(40 * ratio);
            availReason = `Partial stock (${unreservedStock.toLocaleString()} of ${demand.quantity.toLocaleString()} ${resource.unit} available, satisfying ${Math.round(ratio * 100)}% of demand).`;
        }
        // Distance & Transit Calculation (0–25)
        const distKm = Math.round((0, distance_js_1.calculateHaversineDistance)(demand.coordinates.lat, demand.coordinates.lng, resource.coordinates.lat, resource.coordinates.lng) * 10) / 10;
        // Approximate transit speed: 45 km/h in city traffic + 4 mins initial dispatch prep
        const estMinutes = Math.max(4, Math.round((distKm / 45) * 60 + 4));
        const estDeliveryTime = `~${estMinutes} mins`;
        let distanceScore = 0;
        if (!isComp || isStatusUnusable) {
            distanceScore = 0;
        }
        else if (distKm <= 3)
            distanceScore = 25;
        else if (distKm <= 7)
            distanceScore = 22;
        else if (distKm <= 12)
            distanceScore = 18;
        else if (distKm <= 18)
            distanceScore = 14;
        else if (distKm <= 25)
            distanceScore = 9;
        else if (distKm <= 40)
            distanceScore = 5;
        else
            distanceScore = Math.max(0, Math.round(25 * (1 - distKm / 80)));
        // Urgency / Priority Score (0–20)
        let priorityScore = 0;
        if (!isComp || isStatusUnusable) {
            priorityScore = 0;
        }
        else {
            const priorityWeights = {
                CRITICAL: 20,
                HIGH: 17,
                MEDIUM: 13,
                LOW: 9,
            };
            priorityScore = priorityWeights[demand.priority] ?? 10;
        }
        // Allocation Pressure & Readiness (0–5)
        let pressureScore = 5;
        if (competingDemandCount >= 3)
            pressureScore = 1;
        else if (competingDemandCount === 2)
            pressureScore = 2;
        else if (competingDemandCount === 1)
            pressureScore = 4;
        if (resource.status === 'LOW')
            pressureScore = Math.max(1, pressureScore - 2);
        // Total Score Calculation
        const totalScore = isComp && !isStatusUnusable
            ? compatibilityScore + availabilityScore + distanceScore + priorityScore + pressureScore
            : 0;
        // Quality Label
        let qualityLabel;
        if (!isComp)
            qualityLabel = 'INCOMPATIBLE';
        else if (isStatusUnusable || totalScore < 20)
            qualityLabel = 'POOR';
        else if (totalScore >= 90)
            qualityLabel = 'EXCELLENT';
        else if (totalScore >= 75)
            qualityLabel = 'GOOD';
        else
            qualityLabel = 'PARTIAL';
        const recommendedQuantity = Math.min(demand.quantity, unreservedStock);
        const breakdown = {
            compatibility: compatibilityScore,
            availability: availabilityScore,
            distance: distanceScore,
            priority: priorityScore,
            allocationPressure: pressureScore,
            total: totalScore,
        };
        // Construct Explainable Reasoning Sentence
        const reasoning = isComp
            ? `Recommended Resource ${resource.id} because it satisfies the requested ${demand.category.toLowerCase()} category, has ${unreservedStock >= demand.quantity ? 'sufficient stock' : 'partial stock'} (${unreservedStock.toLocaleString()} ${resource.unit} available vs ${demand.quantity.toLocaleString()} requested), is ${distKm} km away (${estDeliveryTime} transit), and the request is ${demand.priority}.`
            : `Resource ${resource.id} (${resource.category}) is incompatible with requested ${demand.category} demand.`;
        const detailedExplanation = [
            isComp ? `Resource category (${resource.category}) is compatible with demand (${demand.category}).` : `Incompatible resource category (${resource.category} vs ${demand.category}).`,
            availReason,
            `Distance: ${distKm} km from target zone · Estimated transit time: ${estDeliveryTime}.`,
            `Demand urgency is ${demand.priority} (priority weight score: ${priorityScore}/20).`,
            `Depot stockpile status is ${resource.status} (${competingDemandCount} competing active allocation(s)).`,
        ];
        return {
            demandId: demand.id,
            matchScore: totalScore,
            recommendedResource: {
                id: resource.id,
                name: resource.name,
                category: resource.category,
                storageDepot: resource.locationName,
                availableQuantity: unreservedStock,
                unit: resource.unit,
            },
            recommendedQuantity,
            distanceKm: distKm,
            estimatedDeliveryMinutes: estMinutes,
            estimatedDeliveryTime: estDeliveryTime,
            breakdown,
            qualityLabel,
            reasoning,
            detailedExplanation,
        };
    }
    /**
     * Ranks all candidate resources for a demand request, sorted by match score descending.
     */
    static rankCandidates(demand, resources, competingMap = {}) {
        const recommendations = [];
        for (const res of resources) {
            const competing = competingMap[res.id] || 0;
            const rec = this.evaluateResourceMatch(demand, res, competing);
            recommendations.push(rec);
        }
        // Sort descending by matchScore, then by distance ascending
        recommendations.sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return a.distanceKm - b.distanceKm;
        });
        const bestMatch = recommendations.length > 0 && recommendations[0].matchScore > 0 ? recommendations[0] : null;
        return {
            recommendations,
            bestMatch,
        };
    }
}
exports.DecisionMatchingEngine = DecisionMatchingEngine;
