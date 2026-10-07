"use strict";
/**
 * SAKSHAM Demand Priority Assessment Engine
 * ──────────────────────────────────────────
 * Deterministic, multi-criteria assessment algorithm that evaluates
 * disaster relief demands based on objective situational factors.
 *
 * Scoring Factors (Total: 100 points):
 * 1. Incident Severity (25 pts): Baseline severity of parent emergency event
 * 2. Affected Population (25 pts): Scaled volume of human population in peril
 * 3. Resource Criticality (20 pts): Life-support nature of requested item
 * 4. Waiting Time (15 pts): Elapsed latency since initial request logging
 * 5. Vulnerability & Accessibility (15 pts): Geographic / infrastructure hazard
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemandPriorityEngine = void 0;
class DemandPriorityEngine {
    /**
     * Evaluates demand priority deterministically with transparent component scoring
     * and explainable natural-language reasoning.
     */
    static evaluate(input) {
        const { demand, incident } = input;
        const now = input.currentTime || new Date();
        // 1. Incident Severity Score (0–25)
        const incidentSeverity = incident?.severity || demand.priority || 'MEDIUM';
        let incidentSeverityScore = 12;
        let incidentReason = '';
        switch (incidentSeverity) {
            case 'CRITICAL':
                incidentSeverityScore = 25;
                incidentReason = `Parent incident is designated CRITICAL (Life Threat / Extreme Destruction).`;
                break;
            case 'HIGH':
                incidentSeverityScore = 18;
                incidentReason = `Parent incident severity is HIGH (Substantial Danger & Displacement).`;
                break;
            case 'MEDIUM':
                incidentSeverityScore = 12;
                incidentReason = `Parent incident severity is MEDIUM (Local Inundation / Managed Pocket).`;
                break;
            case 'LOW':
                incidentSeverityScore = 5;
                incidentReason = `Parent incident severity is LOW (Precautionary / Staging Phase).`;
                break;
        }
        // 2. Affected Population Scale Score (0–25)
        const count = demand.affectedCount || incident?.peopleAffected || 0;
        let affectedPopulationScore = 5;
        let populationReason = '';
        if (count >= 2000) {
            affectedPopulationScore = 25;
            populationReason = `Extremely large affected population scale (${count.toLocaleString()} individuals affected).`;
        }
        else if (count >= 1000) {
            affectedPopulationScore = 20;
            populationReason = `High density casualty/displacement footprint (${count.toLocaleString()} individuals affected).`;
        }
        else if (count >= 500) {
            affectedPopulationScore = 16;
            populationReason = `Moderate-to-large population cluster affected (${count.toLocaleString()} individuals).`;
        }
        else if (count >= 100) {
            affectedPopulationScore = 11;
            populationReason = `Localized group affected (${count.toLocaleString()} individuals).`;
        }
        else if (count > 0) {
            affectedPopulationScore = 7;
            populationReason = `Small local pocket affected (${count.toLocaleString()} individuals).`;
        }
        else {
            affectedPopulationScore = 5;
            populationReason = `Unspecified population count (baseline weighting applied).`;
        }
        // 3. Resource Criticality Score (0–20)
        const category = (demand.category || '').toUpperCase();
        const item = (demand.itemNeeded || '').toLowerCase();
        let resourceCriticalityScore = 10;
        let criticalityReason = '';
        if (category === 'MEDICAL' ||
            item.includes('trauma') ||
            item.includes('triage') ||
            item.includes('oxygen') ||
            item.includes('blood') ||
            item.includes('ambulance') ||
            category === 'RESCUE_EQUIPMENT' ||
            item.includes('boat') ||
            item.includes('cutter')) {
            resourceCriticalityScore = 20;
            criticalityReason = `Critical Tier-1 Life Rescue Resource (${demand.itemNeeded}) — direct casualty prevention.`;
        }
        else if (category === 'WATER' ||
            item.includes('water') ||
            item.includes('purification')) {
            resourceCriticalityScore = 17;
            criticalityReason = `Essential Survival Resource (${demand.itemNeeded}) — acute hydration need.`;
        }
        else if (category === 'FOOD' ||
            item.includes('ration') ||
            item.includes('meal')) {
            resourceCriticalityScore = 13;
            criticalityReason = `Vital Sustenance Resource (${demand.itemNeeded}) — food ration mobilization.`;
        }
        else if (category === 'CLOTHING' ||
            category === 'SHELTER_SUPPLIES' ||
            item.includes('blanket') ||
            item.includes('tent')) {
            resourceCriticalityScore = 10;
            criticalityReason = `Protection & Thermal Shelter Resource (${demand.itemNeeded}) — environmental exposure mitigation.`;
        }
        else {
            resourceCriticalityScore = 6;
            criticalityReason = `Secondary Logistics / Support Material (${demand.itemNeeded}).`;
        }
        // 4. Waiting Time / Latency Score (0–15)
        const reqTime = demand.requestedAt ? new Date(demand.requestedAt).getTime() : now.getTime() - 15 * 60000;
        const elapsedMinutes = Math.max(0, Math.round((now.getTime() - reqTime) / 60000));
        let waitingTimeScore = 2;
        let waitingReason = '';
        if (elapsedMinutes >= 180) {
            waitingTimeScore = 15;
            waitingReason = `Severe latency backlog: Request has been pending for ${elapsedMinutes} minutes (>3 hours).`;
        }
        else if (elapsedMinutes >= 90) {
            waitingTimeScore = 12;
            waitingReason = `Elevated delay: Pending for ${elapsedMinutes} minutes (>1.5 hours) without dispatch.`;
        }
        else if (elapsedMinutes >= 45) {
            waitingTimeScore = 9;
            waitingReason = `Moderate latency: Request logged ${elapsedMinutes} minutes ago.`;
        }
        else if (elapsedMinutes >= 15) {
            waitingTimeScore = 5;
            waitingReason = `Recent request: Logged ${elapsedMinutes} minutes ago.`;
        }
        else {
            waitingTimeScore = 2;
            waitingReason = `Immediate intake: Fresh request logged under 15 minutes ago.`;
        }
        // 5. Vulnerability & Accessibility Score (0–15)
        // Assesses environmental vulnerability based on location keywords, flood level, and access
        const locationStr = `${demand.zoneName} ${incident?.location || ''}`.toLowerCase();
        let vulnerabilityScore = 8;
        let vulnerabilityReason = '';
        if (locationStr.includes('yamuna') ||
            locationStr.includes('river') ||
            locationStr.includes('slum') ||
            locationStr.includes('inundat') ||
            locationStr.includes('collapse') ||
            locationStr.includes('debris')) {
            vulnerabilityScore = 15;
            vulnerabilityReason = `High Vulnerability Zone (Active flood plain / structural hazard / low-lying topography).`;
        }
        else if (locationStr.includes('camp') ||
            locationStr.includes('transit') ||
            locationStr.includes('settlement')) {
            vulnerabilityScore = 11;
            vulnerabilityReason = `Elevated Vulnerability (Evacuation relief cluster / high population density).`;
        }
        else {
            vulnerabilityScore = 7;
            vulnerabilityReason = `Standard urban grid access corridor.`;
        }
        // Total Calculation
        const totalScore = incidentSeverityScore + affectedPopulationScore + resourceCriticalityScore + waitingTimeScore + vulnerabilityScore;
        // Derived Priority Level
        let priorityLevel = 'LOW';
        if (totalScore >= 80)
            priorityLevel = 'CRITICAL';
        else if (totalScore >= 60)
            priorityLevel = 'HIGH';
        else if (totalScore >= 40)
            priorityLevel = 'MEDIUM';
        else
            priorityLevel = 'LOW';
        const breakdown = {
            incidentSeverityScore,
            affectedPopulationScore,
            resourceCriticalityScore,
            waitingTimeScore,
            vulnerabilityScore,
            totalScore,
        };
        const reasoning = [
            incidentReason,
            populationReason,
            criticalityReason,
            waitingReason,
            vulnerabilityReason,
            `Calculated Priority Score: ${totalScore}/100 ➔ Assigned Priority Level: ${priorityLevel}.`
        ];
        return {
            demandId: demand.id,
            priorityScore: totalScore,
            priorityLevel,
            breakdown,
            reasoning,
            evaluatedAt: now.toISOString(),
        };
    }
}
exports.DemandPriorityEngine = DemandPriorityEngine;
