import { v } from "convex/values";
import { roundMoney } from "../../libs/utils/money";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";
import { dateRangeValidator } from "../web/analyticsShared";

/**
 * Cost management
 * Handles organization-level shipping, payment processing, and operational expenses
 */

// Cost categories
export const COST_CATEGORIES = {
  COGS: "cogs", // Cost of goods sold
  SHIPPING: "shipping", // Shipping costs
  HANDLING: "handling", // Handling fees
  TRANSACTION: "transaction", // Payment processing fees
  TAX: "tax", // Taxes paid
  OPERATIONAL: "operational", // Operational expenses
  RETURNS: "returns", // Return processing costs
} as const;

const clampPercentage = (value: number | undefined | null): number => {
  if (value === undefined || value === null) return 0;
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const sortManualRateDocs = (
  docs: Doc<"manualReturnRates">[],
): Doc<"manualReturnRates">[] =>
  docs
    .slice()
    .sort(
      (a, b) =>
        (b.updatedAt ?? b.effectiveFrom ?? b.createdAt ?? 0) -
        (a.updatedAt ?? a.effectiveFrom ?? a.createdAt ?? 0),
    );

const pickLatestManualRate = (
  docs: Doc<"manualReturnRates">[],
): Doc<"manualReturnRates"> | null => {
  if (docs.length === 0) return null;
  const sorted = sortManualRateDocs(docs);
  return sorted.find((doc) => doc.isActive) ?? sorted[0] ?? null;
};

// ============ QUERIES ============

/**
 * Get costs for date range
 */
export const getCosts = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
    type: v.optional(v.union(v.literal("shipping"), v.literal("payment"), v.literal("operational"))),
  },
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const orgId = auth.orgId as Id<'organizations'>;

    // Use proper index for type filtering
    let costs: Doc<"globalCosts">[];

    if (args.type) {
      costs = await ctx.db
        .query("globalCosts")
        .withIndex("by_org_and_type", (q) =>
          q
            .eq("organizationId", orgId)
            .eq("type", args.type as "shipping" | "payment" | "operational"),
        )
        .collect();
    } else {
      costs = await ctx.db
        .query("globalCosts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", orgId),
        )
        .collect();
    }

    // Filter by date range in memory if provided
    if (args.dateRange) {
      const startTime = new Date(args.dateRange.startDate).getTime();
      const endTime = new Date(args.dateRange.endDate).getTime();

      costs = costs.filter(
        (cost: Doc<"globalCosts">) =>
          cost.effectiveFrom >= startTime &&
          (!cost.effectiveTo || cost.effectiveTo <= endTime),
      );
    }

    return costs;
  },
});

/**
 * Get shipping costs
 */
export const getShippingCosts = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    return await ctx.db
      .query("globalCosts")
      .withIndex("by_org_and_type", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .eq("type", "shipping"),
      )
      .order("desc")
      .take(args.limit || 100);
  },
});

export const getManualReturnRate = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      ratePercent: v.number(),
      isActive: v.boolean(),
      note: v.optional(v.string()),
      effectiveFrom: v.optional(v.number()),
      effectiveTo: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const orgId = auth.orgId as Id<"organizations">;
    const docs = await ctx.db
      .query("manualReturnRates")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const latest = pickLatestManualRate(docs);
    if (!latest) {
      return null;
    }

    return {
      ratePercent: latest.ratePercent,
      isActive: latest.isActive,
      note: latest.note,
      effectiveFrom: latest.effectiveFrom,
      effectiveTo: latest.effectiveTo,
      updatedAt: latest.updatedAt,
    } as const;
  },
});

// ============ MUTATIONS ============

/**
 * Add cost entry
 */
export const addCost = mutation({
  args: {
    type: v.union(v.literal("shipping"), v.literal("payment"), v.literal("operational")),
    name: v.string(),
    value: v.number(),
    calculation: v.union(
      v.literal("fixed"),
      v.literal("percentage"),
      v.literal("per_unit"),
      v.literal("tiered"),
      v.literal("weight_based"),
      v.literal("formula"),
    ),
    effectiveFrom: v.number(),
    description: v.optional(v.string()),
    frequency: v.optional(
      v.union(
        v.literal("one_time"),
        v.literal("per_order"),
        v.literal("per_item"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly"),
        v.literal("percentage"),
      ),
    ),
  },
  returns: v.object({ id: v.id("globalCosts"), success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    const costId = await ctx.db.insert("globalCosts", {
      organizationId: user.organizationId as Id<"organizations">,
      userId: user._id,
      type: args.type,
      name: args.name,
      value: roundMoney(args.value),
      calculation: args.calculation,
      effectiveFrom: args.effectiveFrom,
      description: args.description,
      frequency: args.frequency,
      isActive: true,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { id: costId, success: true };
  },
});

/**
 * Update cost entry
 */
export const updateCost = mutation({
  args: {
    costId: v.id("globalCosts"),
    name: v.optional(v.string()),
    value: v.optional(v.number()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    frequency: v.optional(
      v.union(
        v.literal("one_time"),
        v.literal("per_order"),
        v.literal("per_item"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("yearly"),
        v.literal("percentage"),
      ),
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { orgId } = await requireUserAndOrg(ctx);

    const cost = await ctx.db.get(args.costId);

    if (!cost || cost.organizationId !== orgId) {
      throw new Error("Cost not found or access denied");
    }

    const updates: Partial<Doc<"globalCosts">> & { updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.value !== undefined) updates.value = roundMoney(args.value);
    if (args.description !== undefined) updates.description = args.description;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.frequency !== undefined) updates.frequency = args.frequency;

    await ctx.db.patch(args.costId, updates);

    return { success: true };
  },
});

/**
 * Delete cost entry
 */
export const deleteCost = mutation({
  args: {
    costId: v.id("globalCosts"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    const cost = await ctx.db.get(args.costId);

    if (!cost || cost.organizationId !== user.organizationId) {
      throw new Error("Cost not found or access denied");
    }

    await ctx.db.delete(args.costId);

    return { success: true };
  },
});

// Removed legacy product cost mutations (use upsertVariantCosts instead)

/**
 * Upsert product-level cost components
 */
export const upsertVariantCosts = mutation({
  args: {
    variantId: v.id("shopifyProductVariants"),
    cogsPerUnit: v.optional(v.number()),
    handlingPerUnit: v.optional(v.number()),
    taxPercent: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    const existing = await ctx.db
      .query("variantCosts")
      .withIndex("by_org_variant", (q) =>
        q.eq("organizationId", orgId as Id<"organizations">).eq("variantId", args.variantId),
      )
      .first();

    // Only include fields that are explicitly provided to avoid wiping others
    const updates: any = { updatedAt: Date.now() };
    if (args.cogsPerUnit !== undefined) updates.cogsPerUnit = args.cogsPerUnit;
    if (args.handlingPerUnit !== undefined) updates.handlingPerUnit = args.handlingPerUnit;
    if (args.taxPercent !== undefined) updates.taxPercent = args.taxPercent;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("variantCosts", {
        organizationId: orgId,
        userId: user._id,
        variantId: args.variantId,
        ...updates,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const setManualReturnRate = mutation({
  args: {
    ratePercent: v.optional(v.number()),
    note: v.optional(v.string()),
    effectiveFrom: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    ratePercent: v.number(),
    isActive: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    const normalizedRate = clampPercentage(args.ratePercent);
    const manualRateResult = await ctx.runMutation(
      internal.core.costs.upsertManualReturnRate,
      {
        organizationId: orgId as Id<"organizations">,
        userId: user._id,
        ratePercent: normalizedRate,
        note: args.note,
        effectiveFrom: args.effectiveFrom ?? Date.now(),
        isActive: normalizedRate > 0,
      },
    ) as {
      success: boolean;
      isActive: boolean;
      ratePercent: number;
      changed: boolean;
    };

    if (manualRateResult.changed) {
      await ctx.scheduler.runAfter(0, internal.engine.analytics.calculateAnalytics, {
        organizationId: orgId,
        dateRange: { daysBack: 90 },
        syncType: "incremental",
      });
    }

    return {
      success: manualRateResult.success,
      ratePercent: manualRateResult.isActive ? manualRateResult.ratePercent : 0,
      isActive: manualRateResult.isActive,
    } as const;
  },
});

/**
 * Save all product cost components at once
 */
export const saveVariantCosts = mutation({
  args: {
    costs: v.array(
      v.object({
        variantId: v.id("shopifyProductVariants"),
        cogsPerUnit: v.optional(v.number()),
        taxPercent: v.optional(v.number()),
        handlingPerUnit: v.optional(v.number()),
      })
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    for (const cost of args.costs) {
      // Skip rows that truly have no provided values
      // Include taxPercent so tax-only edits are persisted
      const hasAnyValue =
        cost.cogsPerUnit !== undefined ||
        cost.handlingPerUnit !== undefined ||
        cost.taxPercent !== undefined;

      if (!hasAnyValue) continue;

      // Get existing component
      const existing = await ctx.db
        .query("variantCosts")
        .withIndex("by_org_variant", (q) =>
          q.eq("organizationId", orgId).eq("variantId", cost.variantId)
        )
        .first();

      // Build updates with only provided fields to prevent wiping existing values
      const updates: any = { updatedAt: Date.now() };
      if (cost.cogsPerUnit !== undefined) updates.cogsPerUnit = cost.cogsPerUnit;
      if (cost.handlingPerUnit !== undefined) updates.handlingPerUnit = cost.handlingPerUnit;
      if (cost.taxPercent !== undefined) updates.taxPercent = cost.taxPercent;

      if (existing) {
        await ctx.db.patch(existing._id, updates);
      } else {
        await ctx.db.insert("variantCosts", {
          organizationId: orgId,
          userId: user._id,
          variantId: cost.variantId,
          ...updates,
          createdAt: Date.now(),
        });
      }

      // Sync COGS to variant
    }

    // Persist per-variant taxPercent when provided (no global averages)
    // Already handled above in per-variant loop and variantCosts updates

    // Update onboarding step
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", user._id).eq("organizationId", orgId)
      )
      .first();

    if (onboarding && onboarding.onboardingStep === 5) {
      await ctx.db.patch(onboarding._id, {
        // Mark product cost setup complete at step 5
        isProductCostSetup: true,
        onboardingStep: 6,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// ============ INTERNAL FUNCTIONS ============

/**
 * Create product cost components for synced variants
 */
export const getManualReturnRateEntries = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    windowStart: v.optional(v.number()),
    windowEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("manualReturnRates")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const start = args.windowStart ?? Number.NEGATIVE_INFINITY;
    const end = args.windowEnd ?? Number.POSITIVE_INFINITY;

    return docs.filter((doc) => {
      const from = typeof doc.effectiveFrom === "number" ? doc.effectiveFrom : 0;
      const rawTo = doc.effectiveTo;
      const to =
        rawTo === undefined || rawTo === null
          ? Number.POSITIVE_INFINITY
          : typeof rawTo === "number"
            ? rawTo
            : Number.POSITIVE_INFINITY;
      return from <= end && to >= start;
    });
  },
});

export const upsertManualReturnRate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    ratePercent: v.optional(v.number()),
    note: v.optional(v.string()),
    effectiveFrom: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    isActive: v.boolean(),
    ratePercent: v.number(),
    changed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("manualReturnRates")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const normalizedRate = clampPercentage(args.ratePercent);
    const shouldActivate = args.isActive ?? normalizedRate > 0;
    const now = Date.now();
    const latest = pickLatestManualRate(docs);
    const note = args.note;

    if (!latest) {
      if (!shouldActivate) {
        return { success: true, isActive: false, ratePercent: 0, changed: false } as const;
      }

      await ctx.db.insert("manualReturnRates", {
        organizationId: args.organizationId,
        userId: args.userId,
        ratePercent: normalizedRate,
        note,
        isActive: true,
        effectiveFrom: args.effectiveFrom ?? now,
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        isActive: true,
        ratePercent: normalizedRate,
        changed: true,
      } as const;
    }

    if (!shouldActivate) {
      if (!latest.isActive) {
        return { success: true, isActive: false, ratePercent: 0, changed: false } as const;
      }

      await ctx.db.patch(latest._id, {
        isActive: false,
        ratePercent: normalizedRate,
        note: note !== undefined ? note : latest.note,
        effectiveTo: now,
        updatedAt: now,
      });

      return {
        success: true,
        isActive: false,
        ratePercent: 0,
        changed: true,
      } as const;
    }

    const updates: Record<string, unknown> = {
      ratePercent: normalizedRate,
      isActive: true,
      updatedAt: now,
      effectiveTo: undefined,
    };

    if (args.userId) {
      updates.userId = args.userId;
    }

    if (args.effectiveFrom !== undefined) {
      updates.effectiveFrom = args.effectiveFrom;
    } else if (!latest.effectiveFrom) {
      updates.effectiveFrom = now;
    }

    if (note !== undefined) {
      updates.note = note;
    }

    const hasChanged =
      latest.ratePercent !== normalizedRate ||
      !latest.isActive ||
      (note !== undefined && note !== latest.note) ||
      (updates.effectiveFrom !== undefined && updates.effectiveFrom !== latest.effectiveFrom);

    if (hasChanged) {
      await ctx.db.patch(latest._id, updates);
    }

    return {
      success: true,
      isActive: true,
      ratePercent: normalizedRate,
      changed: hasChanged,
    } as const;
  },
});

export const createVariantCosts = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    components: v.array(
      v.object({
        variantId: v.string(),
        cogsPerUnit: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // First, get all variants to map Shopify IDs to internal IDs
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
    
    const shopifyIdToVariantId = new Map<string, Id<"shopifyProductVariants">>();
    for (const variant of variants) {
      shopifyIdToVariantId.set(variant.shopifyId, variant._id);
    }
    
    // Create or update product cost components
    for (const component of args.components) {
      const variantId = shopifyIdToVariantId.get(component.variantId);
      
      if (!variantId) {
        console.warn(`Variant not found for Shopify ID: ${component.variantId}`);
        continue;
      }
      
      // Check if component already exists
      const existing = await ctx.db
        .query("variantCosts")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .first();
      
      if (existing) {
        // Update existing component
        await ctx.db.patch(existing._id, {
          cogsPerUnit: component.cogsPerUnit,
          updatedAt: Date.now(),
        });
      } else {
        // Create new component
        await ctx.db.insert("variantCosts", {
          organizationId: args.organizationId,
          variantId,
          cogsPerUnit: component.cogsPerUnit,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  },
});

/**
 * Validate cost data completeness
 */
export const validateCostDataCompleteness = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    totalVariants: v.number(),
    variantsWithCOGS: v.number(),
    variantsWithCostComponents: v.number(),
    completenessPercentage: v.number(),
    hasTaxRate: v.boolean(),
    hasShippingCosts: v.boolean(),
    hasPaymentFees: v.boolean(),
    recommendations: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get all variants
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();
    
    const totalVariants = variants.length;

    // Check cost components
  const costComponents = await ctx.db
    .query("variantCosts")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", args.organizationId)
    )
    .collect();

    const variantsWithCostComponentsIds = new Set<string>();
    const variantsWithCogsIds = new Set<string>();
    for (const component of costComponents) {
      variantsWithCostComponentsIds.add(component.variantId as string);
      if (component.cogsPerUnit && component.cogsPerUnit > 0) {
        variantsWithCogsIds.add(component.variantId as string);
      }
    }
    const variantsWithCostComponents = variantsWithCostComponentsIds.size;
    const variantsWithCOGS = variantsWithCogsIds.size;
    
    // Check other cost types
    const costs = await ctx.db
      .query("globalCosts")
      .withIndex("by_org_and_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("isActive", true)
      )
      .collect();
    
    const hasTaxRate = costComponents.some((component) => {
      const value = component.taxPercent;
      return typeof value === "number" && value > 0;
    });
    const hasShippingCosts = costs.some(c => c.type === "shipping");
    const hasPaymentFees = costs.some(c => c.type === "payment");
    
    const recommendations: string[] = [];
    
    // Calculate completeness
    const effectiveVariantsWithCosts = Math.max(variantsWithCOGS, variantsWithCostComponents);
    const completenessPercentage = totalVariants > 0 
      ? Math.round((effectiveVariantsWithCosts / totalVariants) * 100)
      : 0;
    
    // Generate recommendations
    if (completenessPercentage < 50) {
      recommendations.push("More than 50% of products are missing cost data. Consider updating costs in Shopify.");
    }
    
    if (!hasTaxRate) {
      recommendations.push("No tax rates configured at the product level. Add tax percentages to your variants for better reporting.");
    }
    
    if (!hasShippingCosts) {
      recommendations.push("No shipping costs configured. Consider setting up shipping rates.");
    }
    
    if (!hasPaymentFees) {
      recommendations.push("No payment processing fees configured. Add them for accurate profit calculations.");
    }
    
    if (variantsWithCOGS < variantsWithCostComponents) {
      recommendations.push("Some products have manual cost overrides. Ensure these are up to date.");
    }
    
    return {
      totalVariants,
      variantsWithCOGS,
      variantsWithCostComponents,
      completenessPercentage,
      hasTaxRate: hasTaxRate,
      hasShippingCosts: hasShippingCosts,
      hasPaymentFees: hasPaymentFees,
      recommendations,
    };
  },
});
