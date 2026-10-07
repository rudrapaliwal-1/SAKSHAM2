"use strict";
/**
 * SAKSHAM Resource Allocation Decision Engine
 * ───────────────────────────────────────────
 * Strictly deterministic and validated allocation engine.
 *
 * Guarantees that:
 * 1. Over-allocation is strictly prevented (requested > unreserved stock)
 * 2. Negative inventory is impossible (inventory >= 0)
 * 3. Unavailable resources are blocked (status !== 'DEPLETED' && !== 'RESERVED')
 * 4. Incompatible resources are rejected (category compatibility check)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceAllocationEngine = void 0;
const matchingEngine_js_1 = require("./matchingEngine.js");
const inMemoryStore_js_1 = require("../../db/inMemoryStore.js");
class ResourceAllocationEngine {
    /**
     * Validates an allocation request against core safety invariants.
     */
    static validate(demand, resource, quantity) {
        // 1. Validate positive quantity
        if (quantity <= 0 || !Number.isFinite(quantity)) {
            return {
                isValid: false,
                errorCode: 'INVALID_QUANTITY',
                errorMessage: `Allocation quantity must be a positive number (received: ${quantity}).`,
            };
        }
        // 2. Validate Resource Availability & Status
        if (resource.status === 'DEPLETED' || resource.status === 'RESERVED') {
            return {
                isValid: false,
                errorCode: 'RESOURCE_UNAVAILABLE',
                errorMessage: `Cannot allocate from unavailable resource depot ${resource.id} (Status: ${resource.status}).`,
            };
        }
        // 3. Validate Categorical Compatibility
        const isComp = matchingEngine_js_1.DecisionMatchingEngine.isCompatible(demand.category, resource.category);
        if (!isComp) {
            return {
                isValid: false,
                errorCode: 'INCOMPATIBLE_RESOURCE',
                errorMessage: `Incompatible allocation: Resource ${resource.id} (${resource.category}) cannot fulfill demand for ${demand.category}.`,
            };
        }
        // 4. Validate Over-Allocation & Negative Inventory
        const availableStock = resource.quantity;
        if (quantity > availableStock) {
            return {
                isValid: false,
                errorCode: 'OVER_ALLOCATION',
                errorMessage: `Over-allocation blocked: Requested allocation of ${quantity.toLocaleString()} ${resource.unit} exceeds remaining unreserved stock of ${availableStock.toLocaleString()} ${resource.unit}.`,
            };
        }
        return { isValid: true };
    }
    /**
     * Executes a validated allocation deterministically, updating store state
     * and generating structured, explainable reasoning.
     */
    static executeAllocation(params) {
        const demand = inMemoryStore_js_1.inMemoryStore.getDemandById(params.demandId);
        const resource = inMemoryStore_js_1.inMemoryStore.getResourceById(params.resourceId);
        if (!demand) {
            return { success: false, error: `Demand request ${params.demandId} not found.` };
        }
        if (!resource) {
            return { success: false, error: `Resource ${params.resourceId} not found.` };
        }
        // Run strict validation
        const validation = this.validate(demand, resource, params.quantity);
        if (!validation.isValid) {
            return { success: false, error: validation.errorMessage };
        }
        // Calculate match score & explainable reasoning
        const matchEvaluation = matchingEngine_js_1.DecisionMatchingEngine.evaluateResourceMatch(demand, resource);
        // Perform atomic state mutation via inMemoryStore
        const allocation = inMemoryStore_js_1.inMemoryStore.createAllocation({
            demandId: params.demandId,
            resourceId: params.resourceId,
            quantity: params.quantity,
            vehicleId: params.vehicleId,
        });
        const remainingStock = Math.max(0, resource.quantity);
        const plan = {
            allocationId: allocation.id,
            demandId: demand.id,
            resourceId: resource.id,
            allocatedQuantity: params.quantity,
            vehicleId: params.vehicleId,
            matchScore: matchEvaluation.matchScore,
            reasoning: `Allocated ${params.quantity.toLocaleString()} ${resource.unit} of ${resource.name} from ${resource.locationName} to ${demand.zoneName}. Remaining depot stock: ${remainingStock.toLocaleString()} ${resource.unit}. (Suitability score: ${matchEvaluation.matchScore}/100)`,
            timestamp: new Date().toISOString(),
            remainingDepotStock: remainingStock,
        };
        return {
            success: true,
            plan,
            allocation,
        };
    }
}
exports.ResourceAllocationEngine = ResourceAllocationEngine;
