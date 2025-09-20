import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import type { GenericId as Id } from "convex/values";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";

/**
 * Cost Management Hooks
 * Handles all cost tracking including COGS, shipping, taxes, and custom expenses
 */

// Cost type constants
export const COST_TYPES = {
  PRODUCT: "product",
  SHIPPING: "shipping",
  PAYMENT: "payment",
  OPERATIONAL: "operational",
  TAX: "tax",
  HANDLING: "handling",
  MARKETING: "marketing",
} as const;

// Cost calculation methods
export const CALCULATION_METHODS = {
  FIXED: "fixed",
  PERCENTAGE: "percentage",
  PER_UNIT: "per_unit",
  TIERED: "tiered",
  WEIGHT_BASED: "weight_based",
  FORMULA: "formula",
} as const;

// Cost frequency
export const COST_FREQUENCY = {
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
  const costs = useQuery(api.core.costs.getCosts, {
    type: type ? COST_TYPES[type] : undefined,
    dateRange: dateRange ? toUtcRangeStrings(dateRange, timezone) : undefined,
  });

  return {
    costs: costs || [],
    loading: costs === undefined,
    error: null,
  };
}

/**
 * Get cost summary for date range
 */
export function useCostSummary(dateRange?: {
  startDate: string;
  endDate: string;
}) {
  const { timezone } = useOrganizationTimeZone();
  const summary = useQuery(api.core.costs.getCostSummary, {
    dateRange: dateRange ? toUtcRangeStrings(dateRange, timezone) : undefined,
  });

  return {
    summary,
    loading: summary === undefined,
    error: null,
    total: summary?.total || 0,
    byCategory: summary?.byCategory || {},
    costCount: summary?.costCount || 0,
  };
}

/**
 * Get cost categories
 */
export function useExpenseCategories() {
  const categories = useQuery(api.core.costs.getCostCategories);

  return {
    categories: categories || [],
    loading: categories === undefined,
    error: null,
  };
}

// ============ SPECIFIC COST TYPE HOOKS ============

/**
 * Get shipping costs
 */
export function useShippingCosts(limit?: number) {
  const shippingCosts = useQuery(api.core.costs.getShippingCosts, { limit });

  return {
    shippingCosts: shippingCosts || [],
    loading: shippingCosts === undefined,
    error: null,
  };
}

/**
 * Get tax rates
 */
export function useTaxRates() {
  const taxRates = useQuery(api.core.costs.getTaxRates);

  return {
    taxRates: taxRates || [],
    loading: taxRates === undefined,
    error: null,
  };
}

/**
 * Get transaction/payment fees
 */
export function useTransactionFees() {
  const fees = useQuery(api.core.costs.getCosts, {
    type: "payment",
  });

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
  const expenses = useQuery(api.core.costs.getCosts, {
    type: "operational",
  });

  return {
    expenses: expenses || [],
    loading: expenses === undefined,
    error: null,
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
        provider?: string;
        frequency?: keyof typeof COST_FREQUENCY;
        config?: Record<string, unknown>;
      }) => {
    try {
      const result = await mutation({
        type: COST_TYPES[
          data.type
        ] as (typeof COST_TYPES)[keyof typeof COST_TYPES],
        name: data.name,
        value: data.value,
        calculation: CALCULATION_METHODS[
          data.calculation
        ] as (typeof CALCULATION_METHODS)[keyof typeof CALCULATION_METHODS],
        effectiveFrom:
          typeof data.effectiveFrom === "string"
            ? new Date(data.effectiveFrom).getTime()
            : data.effectiveFrom?.getTime?.() ?? Date.now(),
        description: data.description,
        provider: data.provider,
        frequency: data.frequency
          ? (COST_FREQUENCY[
              data.frequency
            ] as (typeof COST_FREQUENCY)[keyof typeof COST_FREQUENCY])
          : undefined,
        config: data.config,
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
    costId: Id<"costs">;
    value?: number;
    description?: string;
    provider?: string;
    isActive?: boolean;
    config?: Record<string, unknown>;
  }) => {
    try {
      await mutation(data);

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

  return async (costId: Id<"costs">) => {
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

/**
 * Upsert (create/update) a cost category
 */
export function useUpsertCostCategory() {
  const mutation = useMutation(api.core.costs.upsertCostCategory);

  return async (data: {
    categoryId?: Id<"costCategories">;
    name: string;
    type: string; // "operational" | "shipping" | ... (backend validates)
    defaultValue?: number;
    isActive?: boolean;
  }) => {
    try {
      const result = await mutation(data as any);

      return { success: true, id: result.id };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to upsert cost category",
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
    provider?: string;
    description?: string;
    config?: Record<string, unknown>;
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
 * Update shipping cost
 */
export function useUpdateShippingCost() {
  const updateExpense = useUpdateExpense();

  return updateExpense;
}

/**
 * Delete shipping cost
 */
export function useDeleteShippingCost() {
  const deleteExpense = useDeleteExpense();

  return deleteExpense;
}

/**
 * Create tax rate
 */
export function useCreateTaxRate() {
  const createExpense = useCreateExpense();

  return async (data: {
    name: string;
    rate: number; // Percentage
    description?: string;
  }) => {
    return await createExpense({
      type: "TAX",
      name: data.name,
      value: data.rate,
      calculation: "PERCENTAGE",
      effectiveFrom: new Date().toISOString().split("T")[0] as string,
      description: data.description,
      frequency: "PER_ORDER",
    });
  };
}

/**
 * Update tax rate
 */
export function useUpdateTaxRate() {
  const updateExpense = useUpdateExpense();

  return updateExpense;
}

/**
 * Delete tax rate
 */
export function useDeleteTaxRate() {
  const deleteExpense = useDeleteExpense();

  return deleteExpense;
}

/**
 * Create transaction fee
 */
export function useCreateTransactionFee() {
  const createExpense = useCreateExpense();

  return async (data: {
    name: string;
    value: number;
    calculation: keyof typeof CALCULATION_METHODS;
    provider?: string;
    description?: string;
    config?: Record<string, unknown>;
  }) => {
    return await createExpense({
      ...data,
      type: "PAYMENT",
      effectiveFrom: new Date().toISOString().split("T")[0] as string,
      frequency: "PER_ORDER",
    });
  };
}

/**
 * Update transaction fee
 */
export function useUpdateTransactionFee() {
  const updateExpense = useUpdateExpense();

  return updateExpense;
}

/**
 * Delete transaction fee
 */
export function useDeleteTransactionFee() {
  const deleteExpense = useDeleteExpense();

  return deleteExpense;
}

// ============ BULK OPERATIONS ============

/**
 * Bulk import costs
 */
export function useBulkImportCosts() {
  const createExpense = useCreateExpense();

  return async (
    costs: Array<{
      type: keyof typeof COST_TYPES;
      name: string;
      value: number;
      calculation: keyof typeof CALCULATION_METHODS;
      effectiveFrom?: string;
      description?: string;
      provider?: string;
      frequency?: keyof typeof COST_FREQUENCY;
    }>,
  ) => {
    const results = [];
    const errors = [];

    for (const cost of costs) {
      const result = await createExpense({
        ...cost,
        effectiveFrom: String(
          cost.effectiveFrom ?? new Date().toISOString().split("T")[0],
        ),
      });

      if (result.success) {
        results.push(result);
      } else {
        errors.push({ cost, error: result.error });
      }
    }

    return {
      success: errors.length === 0,
      imported: results.length,
      failed: errors.length,
      errors,
    };
  };
}

// ============ CALCULATION HELPERS ============

/**
 * Update product cost
 */
export function useUpdateProductCost() {
  const upsert = useMutation(api.core.costs.upsertProductCostComponents);

  return async (productId: string, cost: number) => {
    try {
      await upsert({ variantId: productId as any, cogsPerUnit: cost } as any);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update product cost",
      };
    }
  };
}

/**
 * Bulk update product costs
 */
export function useBulkUpdateProductCosts() {
  const upsert = useMutation(api.core.costs.upsertProductCostComponents);

  return async (updates: Array<{ productId: string; cost: number }>) => {
    const errors: Array<{ id: string; error: string }> = [];
    for (const u of updates) {
      try {
        await upsert({ variantId: u.productId as any, cogsPerUnit: u.cost } as any);
      } catch (e) {
        errors.push({ id: u.productId, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { success: errors.length === 0, data: { updated: updates.length - errors.length, errors } } as any;
  };
}

/**
 * Product-level cost components (variant scoped)
 */
export function useProductCostComponents(variantId?: Id<"shopifyProductVariants">) {
  const row = useQuery(
    api.core.costs.getProductCostComponents,
    variantId ? { variantId } : "skip",
  );

  return {
    components: row || null,
    loading: variantId ? row === undefined : false,
    error: null,
  };
}

export function useUpsertProductCostComponents() {
  const mutation = useMutation(api.core.costs.upsertProductCostComponents);

  return async (data: {
    variantId: Id<"shopifyProductVariants"> | string;
    cogsPerUnit?: number;
    shippingPerUnit?: number;
    handlingPerUnit?: number;
    taxPercent?: number;
    paymentFeePercent?: number;
    paymentFixedPerItem?: number;
    paymentProvider?: string;
  }) => {
    try {
      const result = await mutation({
        variantId: data.variantId as Id<"shopifyProductVariants">,
        cogsPerUnit: data.cogsPerUnit,
        shippingPerUnit: data.shippingPerUnit,
        handlingPerUnit: data.handlingPerUnit,
        taxPercent: data.taxPercent,
        paymentFeePercent: data.paymentFeePercent,
        paymentFixedPerItem: data.paymentFixedPerItem,
        paymentProvider: data.paymentProvider,
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

export function useSaveProductCostComponents() {
  const mutation = useMutation(api.core.costs.saveProductCostComponents);

  return async (
    costs: Array<{
      variantId: Id<"shopifyProductVariants"> | string;
      cogsPerUnit?: number;
      shippingPerUnit?: number;
      handlingPerUnit?: number;
      taxPercent?: number;
      paymentFeePercent?: number;
      paymentFixedPerItem?: number;
      paymentProvider?: string;
    }>,
  ) => {
    const payload = costs
      .map((c) => ({
        variantId: c.variantId as Id<"shopifyProductVariants">,
        cogsPerUnit: c.cogsPerUnit,
        shippingPerUnit: c.shippingPerUnit,
        handlingPerUnit: c.handlingPerUnit,
        taxPercent: c.taxPercent,
        paymentFeePercent: c.paymentFeePercent,
        paymentFixedPerItem: c.paymentFixedPerItem,
        paymentProvider: c.paymentProvider,
      })) as any;

    try {
      const res = await mutation({ costs: payload });
      return { success: res.success };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}

/**
 * Calculate total costs for orders
 */
export function useCalculateOrderCosts() {
  const { costs } = useCost();

  return (orderValue: number, itemCount: number = 1) => {
    let totalCost = 0;

    for (const cost of costs) {
      if (!cost.isActive) continue;

      switch (cost.calculation) {
        case "fixed":
          if (cost.frequency === "per_order") {
            totalCost += cost.value;
          } else if (cost.frequency === "per_item") {
            totalCost += cost.value * itemCount;
          }
          break;

        case "percentage":
          totalCost += (orderValue * cost.value) / 100;
          break;

        case "per_unit":
          totalCost += cost.value * itemCount;
          break;

        default:
          // Handle other calculation methods based on config
          break;
      }
    }

    return totalCost;
  };
}
