import { v } from "convex/values";
import { roundMoney } from "../../libs/utils/money";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

/**
 * Cost management
 * Handles all cost tracking including COGS, shipping, taxes, and custom expenses
 */

// Cost categories
export const COST_CATEGORIES = {
  COGS: "cogs", // Cost of goods sold
  SHIPPING: "shipping", // Shipping costs
  HANDLING: "handling", // Handling fees
  TRANSACTION: "transaction", // Payment processing fees
  TAX: "tax", // Taxes paid
  MARKETING: "marketing", // Ad spend (auto-tracked)
  CUSTOM: "custom", // Custom expenses
  OPERATIONAL: "operational", // Operational expenses
  RETURNS: "returns", // Return processing costs
} as const;

// ============ QUERIES ============

/**
 * Get costs for date range
 */
export const getCosts = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    type: v.optional(
      v.union(
        v.literal("product"),
        v.literal("shipping"),
        v.literal("payment"),
        v.literal("operational"),
        v.literal("tax"),
        v.literal("handling"),
        v.literal("marketing"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const orgId = auth.orgId as Id<'organizations'>;

    // Use proper index for type filtering
    let costs: Doc<"costs">[];

    if (args.type) {
      costs = await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q
            .eq("organizationId", orgId)
            .eq(
              "type",
              args.type as
                | "product"
                | "shipping"
                | "payment"
                | "operational"
                | "tax"
                | "handling"
                | "marketing",
            ),
        )
        .collect();
    } else {
      costs = await ctx.db
        .query("costs")
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
        (cost: Doc<"costs">) =>
          cost.effectiveFrom >= startTime &&
          (!cost.effectiveTo || cost.effectiveTo <= endTime),
      );
    }

    return costs;
  },
});

/**
 * Get cost categories
 */
export const getCostCategories = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    return await ctx.db
      .query("costCategories")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", auth.orgId as Id<"organizations">),
      )
      .collect();
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
      .query("costs")
      .withIndex("by_org_and_type", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .eq("type", "shipping"),
      )
      .order("desc")
      .take(args.limit || 100);
  },
});

/**
 * Get tax rates
 */
export const getTaxRates = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    // Get tax rates from costs
    const taxCosts = await ctx.db
      .query("costs")
      .withIndex("by_org_and_type", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .eq("type", "tax"),
      )
      .collect();

    return taxCosts.map((tax) => ({
      id: tax._id,
      name: tax.name,
      rate: tax.calculation === "percentage" ? tax.value : undefined,
      amount: tax.calculation !== "percentage" ? tax.value : undefined,
      calculation: tax.calculation,
      frequency: tax.frequency,
      provider: tax.provider,
      isActive: tax.isActive,
    }));
  },
});

/**
 * Get cost summary
 */
export const getCostSummary = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      period: v.object({ startDate: v.string(), endDate: v.string() }),
      costs: v.array(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const dateRange = args.dateRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10),
      endDate: new Date().toISOString().substring(0, 10),
    };

    const costs = await ctx.db
      .query("costs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", auth.orgId as Id<"organizations">),
      )
      .collect();

    const startTime = new Date(dateRange.startDate).getTime();
    const endTime = new Date(dateRange.endDate).getTime();

    const filteredCosts = costs.filter((cost) => {
      const from = cost.effectiveFrom;
      const to = cost.effectiveTo ?? Number.POSITIVE_INFINITY;
      return cost.isActive && from <= endTime && to >= startTime;
    });

    return {
      period: dateRange,
      costs: filteredCosts,
    } as const;
  },
});

// ============ MUTATIONS ============

/**
 * Add cost entry
 */
export const addCost = mutation({
  args: {
    type: v.union(
      v.literal("product"),
      v.literal("shipping"),
      v.literal("payment"),
      v.literal("operational"),
      v.literal("tax"),
      v.literal("handling"),
      v.literal("marketing"),
    ),
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
    provider: v.optional(v.string()),
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
    config: v.optional(v.any()),
  },
  returns: v.object({ id: v.id("costs"), success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    const costId = await ctx.db.insert("costs", {
      organizationId: user.organizationId as Id<"organizations">,
      userId: user._id,
      type: args.type,
      name: args.name,
      value: roundMoney(args.value),
      calculation: args.calculation,
      effectiveFrom: args.effectiveFrom,
      description: args.description,
      provider: args.provider,
      frequency: args.frequency,
      config: args.config,
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
    costId: v.id("costs"),
    value: v.optional(v.number()),
    description: v.optional(v.string()),
    provider: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    config: v.optional(v.any()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { orgId } = await requireUserAndOrg(ctx);

    const cost = await ctx.db.get(args.costId);

    if (!cost || cost.organizationId !== orgId) {
      throw new Error("Cost not found or access denied");
    }

    const updates: Partial<Doc<"costs">> & { updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.value !== undefined) updates.value = roundMoney(args.value);
    if (args.description !== undefined) updates.description = args.description;
    if (args.provider !== undefined) updates.provider = args.provider;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.config !== undefined) updates.config = args.config;

    await ctx.db.patch(args.costId, updates);

    return { success: true };
  },
});

/**
 * Delete cost entry
 */
export const deleteCost = mutation({
  args: {
    costId: v.id("costs"),
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

/**
 * Add or update cost category
 */
export const upsertCostCategory = mutation({
  args: {
    categoryId: v.optional(v.id("costCategories")),
    name: v.string(),
    type: v.string(),
    defaultValue: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.object({ id: v.id("costCategories"), success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    if (args.categoryId) {
      // Update existing
      const category = await ctx.db.get(args.categoryId);

      if (!category || category.organizationId !== orgId) {
        throw new Error("Category not found or access denied");
      }

      await ctx.db.patch(args.categoryId, {
        name: args.name,
        costType: args.type as
          | "product"
          | "shipping"
          | "payment"
          | "operational"
          | "tax"
          | "handling"
          | "marketing",
        isActive:
          args.isActive !== undefined ? args.isActive : category.isActive,
        updatedAt: Date.now(),
      });

      return { id: args.categoryId, success: true };
    } else {
      // Create new
      const categoryId = await ctx.db.insert("costCategories", {
        organizationId: orgId,
        userId: user._id,
        name: args.name,
        costType: args.type as
          | "product"
          | "shipping"
          | "payment"
          | "operational"
          | "tax"
          | "handling"
          | "marketing",
        isActive: args.isActive !== undefined ? args.isActive : true,
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return { id: categoryId, success: true };
    }
  },
});

// Removed legacy product cost mutations (use upsertProductCostComponents instead)

/**
 * Get product-level cost components for a variant
 */
export const getProductCostComponents = query({
  args: {
    variantId: v.id("shopifyProductVariants"),
  },
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const row = await ctx.db
      .query("productCostComponents")
      .withIndex("by_org_variant", (q) =>
        q.eq("organizationId", auth.orgId as Id<"organizations">).eq("variantId", args.variantId),
      )
      .first();

    return row || null;
  },
});

/**
 * Upsert product-level cost components
 */
export const upsertProductCostComponents = mutation({
  args: {
    variantId: v.id("shopifyProductVariants"),
    cogsPerUnit: v.optional(v.number()),
    shippingPerUnit: v.optional(v.number()),
    handlingPerUnit: v.optional(v.number()),
    taxPercent: v.optional(v.number()),
    paymentFeePercent: v.optional(v.number()),
    paymentFixedPerItem: v.optional(v.number()),
    paymentProvider: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    const existing = await ctx.db
      .query("productCostComponents")
      .withIndex("by_org_variant", (q) =>
        q.eq("organizationId", orgId as Id<"organizations">).eq("variantId", args.variantId),
      )
      .first();

    // Only include fields that are explicitly provided to avoid wiping others
    const updates: any = { updatedAt: Date.now() };
    if (args.cogsPerUnit !== undefined) updates.cogsPerUnit = args.cogsPerUnit;
    if (args.shippingPerUnit !== undefined) updates.shippingPerUnit = args.shippingPerUnit;
    if (args.handlingPerUnit !== undefined) updates.handlingPerUnit = args.handlingPerUnit;
    if (args.taxPercent !== undefined) updates.taxPercent = args.taxPercent;
    if (args.paymentFeePercent !== undefined) updates.paymentFeePercent = args.paymentFeePercent;
    if (args.paymentFixedPerItem !== undefined) updates.paymentFixedPerItem = args.paymentFixedPerItem;
    if (args.paymentProvider !== undefined) updates.paymentProvider = args.paymentProvider;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("productCostComponents", {
        organizationId: orgId,
        userId: user._id,
        variantId: args.variantId,
        isActive: true,
        effectiveFrom: Date.now(),
        ...updates,
        createdAt: Date.now(),
      });
    }

    // Keep variant doc cogs in sync when provided
    if (args.cogsPerUnit !== undefined) {
      try {
        await ctx.db.patch(args.variantId, {
          costPerItem: roundMoney(args.cogsPerUnit),
          updatedAt: Date.now(),
        } as any);
      } catch (error) {
        // Ignore variant patch failures; variant might have been deleted concurrently.
        void error;
      }
    }

    return { success: true };
  },
});

/**
 * Bulk import costs
 */
export const bulkImportCosts = mutation({
  args: {
    costs: v.array(
      v.object({
        type: v.union(
          v.literal("product"),
          v.literal("shipping"),
          v.literal("payment"),
          v.literal("operational"),
          v.literal("tax"),
          v.literal("handling"),
          v.literal("marketing"),
        ),
        value: v.number(),
        effectiveFrom: v.number(),
        description: v.optional(v.string()),
        provider: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({ imported: v.number(), success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    const importedIds = [];

    for (const cost of args.costs) {
      const costId = await ctx.db.insert("costs", {
        organizationId: orgId,
        userId: user._id,
        type: cost.type,
        name: cost.description || "Imported cost",
        value: roundMoney(cost.value),
        calculation: "fixed" as const,
        effectiveFrom: cost.effectiveFrom,
      description: cost.description,
      provider: cost.provider,
      isActive: true,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

      importedIds.push(costId);
    }

    return {
      success: true,
      imported: importedIds.length,
    };
  },
});

/**
 * Get products from Shopify for cost assignment
 */
export const getProducts = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireUserAndOrg(ctx);

    // Get products from Shopify
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .take(100);

    return products.map((product) => ({
      id: product.shopifyId,
      title: product.title,
      handle: product.handle,
      imageUrl: product.featuredImage,
      variants: [],
    }));
  },
});

/**
 * Get products with all variants and cost components
 */
export const getProductsWithVariants = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireUserAndOrg(ctx);
    const limit = args.limit || 500;

    // Get all products
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .take(limit);

    // Get all variants for these products
    const productIds = products.map(p => p._id);
    const allVariants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Filter variants by product IDs in memory
    const variantsByProduct = new Map<string, typeof allVariants>();
    for (const variant of allVariants) {
      if (productIds.includes(variant.productId)) {
        const existing = variantsByProduct.get(variant.productId) || [];
        existing.push(variant);
        variantsByProduct.set(variant.productId, existing);
      }
    }

    // Get all cost components for variants
    const allCostComponents = await ctx.db
      .query("productCostComponents")
      .withIndex("by_org_and_active", (q) =>
        q.eq("organizationId", orgId).eq("isActive", true),
      )
      .collect();

    // Create a map of variant ID to cost components
    const costComponentsByVariant = new Map<string, typeof allCostComponents[0]>();
    for (const component of allCostComponents) {
      costComponentsByVariant.set(component.variantId, component);
    }

    // Deprecated: do not use global averages for tax/overhead here

    // Build the result with products and their variants
    const result = products.map((product) => {
      const variants = variantsByProduct.get(product._id) || [];
      
      return {
        id: product.shopifyId,
        _id: product._id,
        title: product.title,
        handle: product.handle,
        vendor: product.vendor,
        productType: product.productType,
        imageUrl: product.featuredImage,
        variants: variants.map((variant) => {
          const costComponent = costComponentsByVariant.get(variant._id);
          const price = variant.price || 0;
          const cogs = costComponent?.cogsPerUnit || variant.costPerItem || 0;
          const overhead = 0;
          const taxRate = costComponent?.taxPercent || 0;
          const shipping = costComponent?.shippingPerUnit || 0;
          const handling = costComponent?.handlingPerUnit || 0;
          
          // Calculate gross margin
          const totalCost = cogs + shipping + handling;
          const grossProfit = price - totalCost;
          const grossMargin = price > 0 ? (grossProfit / price) * 100 : 0;

          return {
            id: variant.shopifyId,
            _id: variant._id,
            title: variant.title,
            sku: variant.sku,
            barcode: variant.barcode,
            price: price,
            compareAtPrice: variant.compareAtPrice,
            inventoryQuantity: variant.inventoryQuantity,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3,
            // Cost fields
            cogsPerUnit: cogs,
            overheadPercent: overhead,
            taxPercent: taxRate,
            shippingPerUnit: shipping,
            handlingPerUnit: handling,
            // Calculated fields
            grossProfit: roundMoney(grossProfit),
            grossMargin: roundMoney(grossMargin),
            totalCost: roundMoney(totalCost),
          };
        }),
      };
    });

    // Apply search filter if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      return result.filter(product => 
        product.title.toLowerCase().includes(searchLower) ||
        product.vendor?.toLowerCase().includes(searchLower) ||
        product.variants.some(v => 
          v.title.toLowerCase().includes(searchLower) ||
          v.sku?.toLowerCase().includes(searchLower)
        )
      );
    }

    return result;
  },
});

/**
 * Get variant costs
 */
export const getVariantCosts = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireUserAndOrg(ctx);

    const costs = await ctx.db
      .query("costs")
      .withIndex("by_org_and_type", (q) =>
        q.eq("organizationId", orgId).eq("type", "product")
      )
      .collect();

    return costs.map((cost) => ({
      variantId: cost.name.replace("Variant ", ""),
      cost: cost.value,
    }));
  },
});

/**
 * Set variant costs
 */
export const setVariantCosts = mutation({
  args: {
    costs: v.array(
      v.object({
        variantId: v.string(),
        cost: v.number(),
      })
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    // Delete existing variant costs
    const existingCosts = await ctx.db
      .query("costs")
      .withIndex("by_org_and_type", (q) =>
        q.eq("organizationId", orgId).eq("type", "product")
      )
      .collect();

    for (const cost of existingCosts) {
      await ctx.db.delete(cost._id);
    }

    // Insert new variant costs
    for (const variantCost of args.costs) {
      if (variantCost.cost > 0) {
        await ctx.db.insert("costs", {
          organizationId: orgId,
          userId: user._id,
          type: "product",
          name: `Variant ${variantCost.variantId}`,
          value: roundMoney(variantCost.cost),
          calculation: "fixed" as const,
          effectiveFrom: Date.now(),
          isActive: true,
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // Update onboarding step from 5 (products) to 6 (cost)
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", user._id).eq("organizationId", orgId),
      )
      .first();

    if (onboarding && onboarding.onboardingStep === 5) {
      await ctx.db.patch(onboarding._id, {
        onboardingStep: 6, // Move to cost step
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Bulk update product cost components
 */
export const bulkUpdateProductCosts = mutation({
  args: {
    variantIds: v.array(v.id("shopifyProductVariants")),
    updates: v.object({
      cogsPerUnit: v.optional(v.number()),
      overheadPercent: v.optional(v.number()),
      taxPercent: v.optional(v.number()),
      shippingPerUnit: v.optional(v.number()),
      handlingPerUnit: v.optional(v.number()),
      applyType: v.union(
        v.literal("fixed"), // Fixed amount
        v.literal("percentage"), // Percentage of price
        v.literal("add"), // Add to existing
        v.literal("multiply") // Multiply existing
      ),
    }),
  },
  returns: v.object({ 
    success: v.boolean(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);
    let updatedCount = 0;

    for (const variantId of args.variantIds) {
      // Get variant to calculate percentage-based values
      const variant = await ctx.db.get(variantId);
      if (!variant || variant.organizationId !== orgId) continue;

      // Get existing cost component if it exists
      const existing = await ctx.db
        .query("productCostComponents")
        .withIndex("by_org_variant", (q) =>
          q.eq("organizationId", orgId).eq("variantId", variantId)
        )
        .first();

      // Calculate new values based on apply type
      const updates: any = {};
      const price = variant.price || 0;

      if (args.updates.cogsPerUnit !== undefined) {
        if (args.updates.applyType === "percentage") {
          updates.cogsPerUnit = roundMoney(price * (args.updates.cogsPerUnit / 100));
        } else if (args.updates.applyType === "add" && existing?.cogsPerUnit) {
          updates.cogsPerUnit = roundMoney(existing.cogsPerUnit + args.updates.cogsPerUnit);
        } else if (args.updates.applyType === "multiply" && existing?.cogsPerUnit) {
          updates.cogsPerUnit = roundMoney(existing.cogsPerUnit * args.updates.cogsPerUnit);
        } else {
          updates.cogsPerUnit = roundMoney(args.updates.cogsPerUnit);
        }
      }

      if (args.updates.shippingPerUnit !== undefined) {
        updates.shippingPerUnit = roundMoney(args.updates.shippingPerUnit);
      }

      if (args.updates.handlingPerUnit !== undefined) {
        updates.handlingPerUnit = roundMoney(args.updates.handlingPerUnit);
      }

      // Update or create cost component
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...updates,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("productCostComponents", {
          organizationId: orgId,
          userId: user._id,
          variantId,
          ...updates,
          isActive: true,
          effectiveFrom: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Sync COGS to variant if provided
      if (updates.cogsPerUnit !== undefined) {
        await ctx.db.patch(variantId, {
          costPerItem: updates.cogsPerUnit,
        } as any);
      }

      updatedCount++;
    }

    // Historical defaults removed: global tax/overhead not updated here

    return { 
      success: true,
      updated: updatedCount,
    };
  },
});

/**
 * Apply global handling configuration across products
 * - mode = 'per_item' sets handlingPerUnit on all variants for the org
 * - mode = 'percent' updates global operatingCosts (overhead percent)
 */
export const applyGlobalHandling = mutation({
  args: {
    mode: v.union(v.literal('per_item'), v.literal('percent')),
    value: v.number(),
  },
  returns: v.object({ success: v.boolean(), updated: v.number() }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    let updated = 0;

    if (args.mode === 'per_item') {
      // Iterate all variants for this org and upsert handlingPerUnit
      const variants = await ctx.db
        .query('shopifyProductVariants')
        .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
        .collect();

      for (const variant of variants) {
        // existing component
        const existing = await ctx.db
          .query('productCostComponents')
          .withIndex('by_org_variant', (q) => q.eq('organizationId', orgId).eq('variantId', variant._id))
          .first();

        const handling = roundMoney(args.value);

        if (existing) {
          await ctx.db.patch(existing._id, {
            handlingPerUnit: handling,
            updatedAt: Date.now(),
          });
        } else {
          await ctx.db.insert('productCostComponents', {
            organizationId: orgId,
            userId: user._id,
            variantId: variant._id,
            handlingPerUnit: handling,
            isActive: true,
            effectiveFrom: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }

        updated++;
      }
    } else {
      // Store as global overhead percent in costs (single source of truth)
      const existingOverhead = await ctx.db
        .query('costs')
        .withIndex('by_org_and_type', (q) => q.eq('organizationId', orgId).eq('type', 'operational'))
        .first();

      if (existingOverhead) {
        await ctx.db.patch(existingOverhead._id, {
          calculation: 'percentage',
          value: args.value,
          frequency: 'percentage',
          isActive: true,
          updatedAt: Date.now(),
        } as any);
      } else {
        await ctx.db.insert('costs', {
          organizationId: orgId,
          userId: user._id,
          type: 'operational',
          name: 'Operating Overhead (%)',
          description: 'Global overhead percentage',
          calculation: 'percentage',
          value: args.value,
          frequency: 'percentage',
          isActive: true,
          isDefault: true,
          effectiveFrom: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as any);
      }
    }

    return { success: true, updated };
  },
});

/**
 * Save all product cost components at once
 */
export const saveProductCostComponents = mutation({
  args: {
    costs: v.array(
      v.object({
        variantId: v.id("shopifyProductVariants"),
        cogsPerUnit: v.optional(v.number()),
        taxPercent: v.optional(v.number()),
        shippingPerUnit: v.optional(v.number()),
        handlingPerUnit: v.optional(v.number()),
        paymentFeePercent: v.optional(v.number()),
        paymentFixedPerItem: v.optional(v.number()),
        paymentProvider: v.optional(v.string()),
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
        cost.shippingPerUnit !== undefined ||
        cost.handlingPerUnit !== undefined ||
        cost.taxPercent !== undefined ||
        cost.paymentFeePercent !== undefined ||
        cost.paymentFixedPerItem !== undefined ||
        cost.paymentProvider !== undefined;

      if (!hasAnyValue) continue;

      // Get existing component
      const existing = await ctx.db
        .query("productCostComponents")
        .withIndex("by_org_variant", (q) =>
          q.eq("organizationId", orgId).eq("variantId", cost.variantId)
        )
        .first();

      // Build updates with only provided fields to prevent wiping existing values
      const updates: any = { updatedAt: Date.now() };
      if (cost.cogsPerUnit !== undefined) updates.cogsPerUnit = cost.cogsPerUnit;
      if (cost.shippingPerUnit !== undefined) updates.shippingPerUnit = cost.shippingPerUnit;
      if (cost.handlingPerUnit !== undefined) updates.handlingPerUnit = cost.handlingPerUnit;
      if (cost.taxPercent !== undefined) updates.taxPercent = cost.taxPercent;
      if (cost.paymentFeePercent !== undefined) updates.paymentFeePercent = cost.paymentFeePercent;
      if (cost.paymentFixedPerItem !== undefined) updates.paymentFixedPerItem = cost.paymentFixedPerItem;
      if (cost.paymentProvider !== undefined) updates.paymentProvider = cost.paymentProvider;

      if (existing) {
        await ctx.db.patch(existing._id, updates);
      } else {
        await ctx.db.insert("productCostComponents", {
          organizationId: orgId,
          userId: user._id,
          variantId: cost.variantId,
          ...updates,
          isActive: true,
          effectiveFrom: Date.now(),
          createdAt: Date.now(),
        });
      }

      // Sync COGS to variant
      if (cost.cogsPerUnit !== undefined) {
        await ctx.db.patch(cost.variantId, {
          costPerItem: roundMoney(cost.cogsPerUnit),
        } as any);
      }
    }

    // Persist per-variant taxPercent when provided (no global averages)
    // Already handled above in per-variant loop and productCostComponents updates

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
 * Update historical tax rate based on calculated average from orders
 */
export const updateHistoricalTaxRate = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    taxPercent: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Single source of truth: update or create a tax cost entry only
    const existingTaxCost = await ctx.db
      .query("costs")
      .withIndex("by_org_type_default", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("type", "tax")
          .eq("isDefault", true),
      )
      .first();
    
    if (existingTaxCost) {
      await ctx.db.patch(existingTaxCost._id, {
        value: args.taxPercent,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("costs", {
        organizationId: args.organizationId,
        type: "tax",
        name: "Calculated Sales Tax",
        value: args.taxPercent,
        calculation: "percentage",
        isActive: true,
        isDefault: true,
        effectiveFrom: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Create product cost components for synced variants
 */
export const createProductCostComponents = internalMutation({
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
        .query("productCostComponents")
        .withIndex("by_variant_and_active", (q) =>
          q.eq("variantId", variantId).eq("isActive", true)
        )
        .first();
      
      if (existing) {
        // Update existing component
        await ctx.db.patch(existing._id, {
          cogsPerUnit: component.cogsPerUnit,
          updatedAt: Date.now(),
        });
      } else {
        // Create new component
        await ctx.db.insert("productCostComponents", {
          organizationId: args.organizationId,
          variantId,
          cogsPerUnit: component.cogsPerUnit,
          isActive: true,
          effectiveFrom: Date.now(),
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
    const variantsWithCOGS = variants.filter(v => v.costPerItem && v.costPerItem > 0).length;
    
    // Check cost components
    const costComponents = await ctx.db
      .query("productCostComponents")
      .withIndex("by_org_and_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("isActive", true)
      )
      .collect();
    
    const variantsWithCostComponents = new Set(costComponents.map(c => c.variantId)).size;
    
    // Check other cost types
    const costs = await ctx.db
      .query("costs")
      .withIndex("by_org_and_active", (q) =>
        q.eq("organizationId", args.organizationId).eq("isActive", true)
      )
      .collect();
    
    const hasTaxRate = costs.some(c => c.type === "tax");
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
      recommendations.push("No tax rate configured. The system calculated one from your orders.");
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

/**
 * Auto-calculate shipping costs
 */
export const calculateShippingCost = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    orderId: v.string(),
    weight: v.optional(v.number()),
    destination: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Get shipping rate configuration for this organization
    // First get all categories for the organization, then filter by type in memory
    // This is necessary because we don't have a composite index for [organizationId, costType]
    const allOrgCategories = await ctx.db
      .query("costCategories")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();

    // Filter for shipping type in memory (acceptable since we've already filtered by org)
    const _orgShippingRates = allOrgCategories.filter(
      (rate) => rate.costType === "shipping",
    );

    // Simple calculation - would be more complex in production
    let shippingCost = 10; // Base cost

    if (args.weight) {
      shippingCost += args.weight * 0.5; // $0.50 per unit weight
    }

    // Store calculated shipping cost - need to get userId first
    const users = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .first();

    if (users) {
      await ctx.db.insert("costs", {
        organizationId: args.organizationId,
        userId: users._id,
        type: "shipping",
        name: `Shipping for order ${args.orderId}`,
        value: roundMoney(shippingCost),
        calculation: "weight_based" as const,
        effectiveFrom: Date.now(),
        description: `Shipping for order ${args.orderId}`,
        config: {
          weight: args.weight,
          destination: args.destination,
          calculated: true,
        },
        isActive: true,
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return shippingCost;
  },
});

/**
 * Sync costs from integrated platforms
 */
export const syncPlatformCosts = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.string(),
    costs: v.array(
      v.object({
        type: v.union(
          v.literal("product"),
          v.literal("shipping"),
          v.literal("payment"),
          v.literal("operational"),
          v.literal("tax"),
          v.literal("handling"),
          v.literal("marketing"),
        ),
        value: v.number(),
        effectiveFrom: v.number(),
        description: v.string(),
      }),
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    for (const cost of args.costs) {
      // Check if cost already exists (avoid duplicates)
      const allCosts = await ctx.db
        .query("costs")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">),
        )
        .collect();

      // Check for duplicates in memory
      const existing = allCosts.find(
        (c) =>
          c.effectiveFrom === cost.effectiveFrom &&
          c.type === cost.type &&
          c.value === cost.value &&
          c.description === cost.description,
      );

      if (!existing) {
        // Get a user for this organization
        const user = await ctx.db
          .query("users")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId as Id<"organizations">),
          )
          .first();

        if (user) {
          await ctx.db.insert("costs", {
            organizationId: args.organizationId,
            userId: user._id,
            type: cost.type,
            name: cost.description,
            value: roundMoney(cost.value),
            calculation: "fixed" as const,
            effectiveFrom: cost.effectiveFrom,
            description: cost.description,
          config: {
            source: args.platform,
            synced: true,
          },
          isActive: true,
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        }
      }
    }

    return { success: true };
  },
});
