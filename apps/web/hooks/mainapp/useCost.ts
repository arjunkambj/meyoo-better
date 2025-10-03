import { useMemo } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import type { GenericId as Id } from "convex/values";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";

/**
 * Cost Management Hooks
 * Handles organization-level costs including shipping, payment processing, and operational expenses
 */

// Cost type constants
const COST_TYPES = {
  SHIPPING: "shipping",
  PAYMENT: "payment",
  OPERATIONAL: "operational",
} as const;

const PAYMENT_COST_ARGS = { type: "payment" } as const;
const OPERATIONAL_COST_ARGS = { type: "operational" } as const;

// Cost calculation methods
const CALCULATION_METHODS = {
  FIXED: "fixed",
  PERCENTAGE: "percentage",
  PER_UNIT: "per_unit",
  TIERED: "tiered",
  WEIGHT_BASED: "weight_based",
  FORMULA: "formula",
} as const;

// Cost frequency
const COST_FREQUENCY = {
  ONE_TIME: "one_time",
  PER_ORDER: "per_order",
  PER_ITEM: "per_item",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  YEARLY: "yearly",
  PERCENTAGE: "percentage",
} as const;

// ============ GENERAL COST HOOKS ============

/**
 * Get all costs with optional filtering
 */
export function useCost(
  type?: keyof typeof COST_TYPES,
  dateRange?: { startDate: string; endDate: string },
) {
  const { timezone } = useOrganizationTimeZone();
  const normalizedRange = useMemo(() => {
    if (!dateRange) return undefined;
    const utcRange = toUtcRangeStrings(dateRange, timezone);
    return {
      ...utcRange,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    } as const;
  }, [dateRange?.endDate, dateRange?.startDate, timezone]);

  const queryArgs = useMemo(
    () => ({
      type: type ? COST_TYPES[type] : undefined,
      dateRange: normalizedRange,
    }),
    [normalizedRange, type],
  );

  const costs = useQuery(api.core.costs.getCosts, queryArgs);

  return {
    costs: costs || [],
    loading: costs === undefined,
    error: null,
  };
}

// ============ SPECIFIC COST TYPE HOOKS ============

/**
 * Get shipping costs
 */
export function useShippingCosts(limit?: number) {
  const args = useMemo(() => ({ limit }), [limit]);
  const shippingCosts = useQuery(api.core.costs.getShippingCosts, args);

  return {
    shippingCosts: shippingCosts || [],
    loading: shippingCosts === undefined,
    error: null,
  };
}

/**
 * Get transaction/payment fees
 */
export function useTransactionFees() {
  const fees = useQuery(api.core.costs.getCosts, PAYMENT_COST_ARGS);

  return {
    fees: fees || [],
    loading: fees === undefined,
    error: null,
  };
}

/**
 * Get operational expenses
 */
export function useExpenses() {
  const expenses = useQuery(api.core.costs.getCosts, OPERATIONAL_COST_ARGS);

  return {
    expenses: expenses || [],
    loading: expenses === undefined,
    error: null,
  };
}

export function useManualReturnRate() {
  const rate = useQuery(api.core.costs.getManualReturnRate, {});

  return {
    manualReturnRate: rate || null,
    loading: rate === undefined,
    error: null,
  };
}

export function useSetManualReturnRate() {
  const mutation = useMutation(api.core.costs.setManualReturnRate);

  return async (data: { ratePercent?: number; note?: string }) => {
    const payload = {
      ratePercent:
        typeof data.ratePercent === "number" && !Number.isNaN(data.ratePercent)
          ? data.ratePercent
          : undefined,
      note: data.note,
    } as { ratePercent?: number; note?: string };

    const result = await mutation(payload);
    return result;
  };
}

// ============ MUTATION HOOKS ============

/**
 * Create new expense/cost
 */
export function useCreateExpense() {
  const mutation = useMutation(api.core.costs.addCost);

  return async (data: {
    type: keyof typeof COST_TYPES;
    name: string;
    value: number;
    calculation: keyof typeof CALCULATION_METHODS;
    effectiveFrom: string | Date;
    description?: string;
    frequency?: keyof typeof COST_FREQUENCY;
  }) => {
    try {
      const costType =
        COST_TYPES[data.type] as (typeof COST_TYPES)[keyof typeof COST_TYPES];
      const calculation =
        CALCULATION_METHODS[
          data.calculation
        ] as (typeof CALCULATION_METHODS)[keyof typeof CALCULATION_METHODS];
      const frequency = data.frequency
        ? (COST_FREQUENCY[
            data.frequency
          ] as (typeof COST_FREQUENCY)[keyof typeof COST_FREQUENCY])
        : undefined;

      const result = await mutation({
        type: costType,
        name: data.name,
        value: data.value,
        calculation,
        effectiveFrom:
          typeof data.effectiveFrom === "string"
            ? new Date(data.effectiveFrom).getTime()
            : data.effectiveFrom?.getTime?.() ?? Date.now(),
        description: data.description,
        frequency,
      });

      return { success: true, id: result.id };
    } catch (error) {
      // Error handled silently

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create expense",
      };
    }
  };
}

/**
 * Update existing expense/cost
 */
export function useUpdateExpense() {
  const mutation = useMutation(api.core.costs.updateCost);

  return async (data: {
    costId: Id<"globalCosts">;
    name?: string;
    value?: number;
    description?: string;
    isActive?: boolean;
    frequency?: keyof typeof COST_FREQUENCY;
  }) => {
    try {
      const payload = {
        costId: data.costId,
        name: data.name,
        value: data.value,
        description: data.description,
        isActive: data.isActive,
        frequency: data.frequency
          ? (COST_FREQUENCY[
              data.frequency
            ] as (typeof COST_FREQUENCY)[keyof typeof COST_FREQUENCY])
          : undefined,
      };

      await mutation(payload);

      return { success: true };
    } catch (error) {
      // Error handled silently

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update expense",
      };
    }
  };
}

/**
 * Delete expense/cost
 */
export function useDeleteExpense() {
  const mutation = useMutation(api.core.costs.deleteCost);

  return async (costId: Id<"globalCosts">) => {
    try {
      await mutation({ costId });

      return { success: true };
    } catch (error) {
      // Error handled silently

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete expense",
      };
    }
  };
}

// ============ SPECIALIZED COST HOOKS ============

/**
 * Create shipping cost
 */
export function useCreateShippingCost() {
  const createExpense = useCreateExpense();

  return async (data: {
    name: string;
    value: number;
    calculation: keyof typeof CALCULATION_METHODS;
    description?: string;
  }) => {
    return await createExpense({
      ...data,
      type: "SHIPPING",
      effectiveFrom: new Date().toISOString().split("T")[0] as string,
      frequency: "PER_ORDER",
    });
  };
}

/**
 * Create tax rate
 */
/**
 * Create transaction fee
 */
export function useCreateTransactionFee() {
  const createExpense = useCreateExpense();

  return async (data: {
    name: string;
    value: number;
    calculation: keyof typeof CALCULATION_METHODS;
    description?: string;
  }) => {
    return await createExpense({
      ...data,
      type: "PAYMENT",
      effectiveFrom: new Date().toISOString().split("T")[0] as string,
      frequency: "PER_ORDER",
    });
  };
}

export function useUpsertVariantCosts() {
  const mutation = useMutation(api.core.costs.upsertVariantCosts);

  return async (data: {
    variantId: Id<"shopifyProductVariants"> | string;
    cogsPerUnit?: number;
    handlingPerUnit?: number;
    taxPercent?: number;
  }) => {
    try {
      const result = await mutation({
        variantId: data.variantId as Id<"shopifyProductVariants">,
        cogsPerUnit: data.cogsPerUnit,
        handlingPerUnit: data.handlingPerUnit,
        taxPercent: data.taxPercent,
      } as any);

      return { success: result.success };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to upsert product cost components",
      };
    }
  };
}

export function useSaveVariantCosts() {
  const mutation = useMutation(api.core.costs.saveVariantCosts);

  return async (
    costs: Array<{
      variantId: Id<"shopifyProductVariants"> | string;
      cogsPerUnit?: number;
      handlingPerUnit?: number;
      taxPercent?: number;
    }>,
  ) => {
    const payload = costs
      .map((c) => ({
        variantId: c.variantId as Id<"shopifyProductVariants">,
        cogsPerUnit: c.cogsPerUnit,
        handlingPerUnit: c.handlingPerUnit,
        taxPercent: c.taxPercent,
      })) as any;

    try {
      const res = await mutation({ costs: payload });
      return { success: res.success };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}
