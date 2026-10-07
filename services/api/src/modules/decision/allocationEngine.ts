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

import {
  DemandRequest,
  Resource,
  ResourceAllocation,
  AllocationPlan,
} from '../../types/contracts.js';
import { DecisionMatchingEngine } from './matchingEngine.js';
import { inMemoryStore } from '../../db/inMemoryStore.js';

export interface AllocationValidation {
  isValid: boolean;
  errorCode?: 'OVER_ALLOCATION' | 'NEGATIVE_INVENTORY' | 'RESOURCE_UNAVAILABLE' | 'INCOMPATIBLE_RESOURCE' | 'INVALID_QUANTITY';
  errorMessage?: string;
}

export class ResourceAllocationEngine {
  /**
   * Validates an allocation request against core safety invariants.
   */
  public static validate(
    demand: DemandRequest,
    resource: Resource,
    quantity: number
  ): AllocationValidation {
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
    const isComp = DecisionMatchingEngine.isCompatible(demand.category, resource.category);
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
  public static executeAllocation(params: {
    demandId: string;
    resourceId: string;
    quantity: number;
    vehicleId?: string;
    approvedBy?: string;
  }): { success: boolean; plan?: AllocationPlan; allocation?: ResourceAllocation; error?: string } {
    const demand = inMemoryStore.getDemandById(params.demandId);
    const resource = inMemoryStore.getResourceById(params.resourceId);

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
    const matchEvaluation = DecisionMatchingEngine.evaluateResourceMatch(demand, resource);

    // Perform atomic state mutation via inMemoryStore
    const allocation = inMemoryStore.createAllocation({
      demandId: params.demandId,
      resourceId: params.resourceId,
      quantity: params.quantity,
      vehicleId: params.vehicleId,
    });

    const remainingStock = Math.max(0, resource.quantity);

    const plan: AllocationPlan = {
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
