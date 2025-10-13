
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normalizeShopDomain } from "../utils/shop";

export const getStore = query({
  args: {},
  returns: v.union(v.null(), v.any()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return null;

    const orgId = user.organizationId;

    return await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q.eq("organizationId", orgId).eq("isActive", true)
      )
      .first();
  },
});

export const getProducts = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("shopifyProducts"),
      _creationTime: v.number(),
      organizationId: v.string(),
      storeId: v.id("shopifyStores"),
      shopifyId: v.string(),
      title: v.string(),
      handle: v.optional(v.string()),
      vendor: v.optional(v.string()),
      productType: v.optional(v.string()),
      status: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      totalInventory: v.optional(v.number()),
      totalVariants: v.number(),
      shopifyCreatedAt: v.number(),
      shopifyUpdatedAt: v.number(),
      publishedAt: v.optional(v.number()),
      syncedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

    const orgId = user.organizationId;

    return await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .take(args.limit || 100);
  },
});

export const getProductVariantsPaginated = query({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
  },
  returns: v.object({
    data: v.array(
      v.object({
        _id: v.id("shopifyProductVariants"),
        _creationTime: v.number(),
        organizationId: v.string(),
        productId: v.id("shopifyProducts"),
        shopifyId: v.string(),
        shopifyProductId: v.string(),
        sku: v.optional(v.string()),
        barcode: v.optional(v.string()),
        title: v.string(),
        position: v.number(),
        price: v.number(),
        compareAtPrice: v.optional(v.number()),
        inventoryQuantity: v.optional(v.number()),
        inventoryPolicy: v.optional(v.string()),
        inventoryManagement: v.optional(v.string()),
        weight: v.optional(v.number()),
        weightUnit: v.optional(v.string()),
        option1: v.optional(v.string()),
        option2: v.optional(v.string()),
        option3: v.optional(v.string()),
        available: v.optional(v.boolean()),
        cogsPerUnit: v.optional(v.number()),
        inventoryItemId: v.optional(v.string()),
        taxable: v.optional(v.boolean()),
        taxPercent: v.optional(v.number()),
        taxRate: v.optional(v.number()),
        handlingPerUnit: v.optional(v.number()),
        grossMargin: v.optional(v.number()),
        grossProfit: v.optional(v.number()),
        shopifyCreatedAt: v.number(),
        shopifyUpdatedAt: v.number(),
        // Product info (joined)
        productName: v.optional(v.string()),
        productHandle: v.optional(v.string()),
        productVendor: v.optional(v.string()),
        productType: v.optional(v.string()),
        productStatus: v.optional(v.string()),
        productImage: v.optional(v.string()),
      })
    ),
    totalPages: v.number(),
    totalItems: v.number(),
    currentPage: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId)
      return { data: [], totalPages: 0, totalItems: 0, currentPage: 1 };
    const user = await ctx.db.get(userId);

    if (!user?.organizationId)
      return { data: [], totalPages: 0, totalItems: 0, currentPage: 1 };

    const orgId = user.organizationId;
    const page = args.page || 1;
    const pageSize = Math.min(args.pageSize || 20, 1000); // Allow larger page sizes for bulk editing

    // Build query with organization filter
    const variantsQuery = ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId));

    // For search, we still need to collect all (can be optimized with full-text search later)
    let paginatedVariants: any[];
    let totalItems: number;

    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase();

      // Collect for search filtering
      const allVariants = await variantsQuery.collect();

      // Get products for search join
      const products = await ctx.db
        .query("shopifyProducts")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();

      const productMap = new Map();
      for (const product of products) {
        productMap.set(product._id, product);
      }

      const filtered = allVariants.filter((variant) => {
        const product = productMap.get(variant.productId);
        return (
          variant.title?.toLowerCase().includes(searchLower) ||
          variant.sku?.toLowerCase().includes(searchLower) ||
          variant.barcode?.toLowerCase().includes(searchLower) ||
          product?.title?.toLowerCase().includes(searchLower) ||
          product?.vendor?.toLowerCase().includes(searchLower)
        );
      });

      totalItems = filtered.length;
      const startIndex = (page - 1) * pageSize;
      paginatedVariants = filtered.slice(startIndex, startIndex + pageSize);
    } else {
      const allVariants = await variantsQuery
        .order("desc")
        .collect();

      totalItems = allVariants.length;
      const startIndex = Math.max(0, (page - 1) * pageSize);
      paginatedVariants = allVariants.slice(startIndex, startIndex + pageSize);
    }

    // Get products for join (only for paginated variants)
    const productIds = [...new Set(paginatedVariants.map(v => v.productId))];
    const products = await Promise.all(
      productIds.map(id => ctx.db.get(id))
    );

    const productMap = new Map();
    for (const product of products) {
      if (product) productMap.set(product._id, product);
    }

    const totalPages = Math.ceil(totalItems / pageSize);

    // Join with product data and apply default costs
    // Load product-level cost components for tax percent
    const pcc = await ctx.db
      .query("variantCosts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    const pccByVariant = new Map<string, typeof pcc[0]>();
    for (const row of pcc) pccByVariant.set(row.variantId, row);

    const data = paginatedVariants.map((variant) => {
      const product = productMap.get(variant.productId);

      // Tax rate from product cost components when present
      const variantPcc = pccByVariant.get(variant._id);
      const cogsPerUnit = variantPcc?.cogsPerUnit;
      const handlingPerUnit = variantPcc?.handlingPerUnit;
      const taxPercent = variantPcc?.taxPercent;
      const taxable = variant.taxable;

      const totalCost =
        (cogsPerUnit ?? 0) +
        (handlingPerUnit ?? 0);
      const grossProfit = variant.price - totalCost;
      const grossMargin = variant.price > 0 ? (grossProfit / variant.price) * 100 : 0;

      return {
        ...variant,
        cogsPerUnit,
        taxPercent,
        taxRate: taxPercent,
        taxable,
        handlingPerUnit,
        grossMargin,
        grossProfit,
        productName: product?.title,
        productHandle: product?.handle,
        productVendor: product?.vendor,
        productType: product?.productType,
        productStatus: product?.status,
        productImage: product?.featuredImage,
      };
    });

    return {
      data,
      totalPages,
      totalItems,
      currentPage: page,
    };
  },
});

export const getProductVariants = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("shopifyProductVariants"),
      _creationTime: v.number(),
      organizationId: v.string(),
      productId: v.id("shopifyProducts"),
      shopifyId: v.string(),
      shopifyProductId: v.string(),
      sku: v.optional(v.string()),
      barcode: v.optional(v.string()),
      title: v.string(),
      position: v.number(),
      price: v.number(),
      compareAtPrice: v.optional(v.number()),
      inventoryQuantity: v.optional(v.number()),
      inventoryPolicy: v.optional(v.string()),
      inventoryManagement: v.optional(v.string()),
      weight: v.optional(v.number()),
      weightUnit: v.optional(v.string()),
      option1: v.optional(v.string()),
      option2: v.optional(v.string()),
      option3: v.optional(v.string()),
      available: v.optional(v.boolean()),
      cogsPerUnit: v.optional(v.number()),
      inventoryItemId: v.optional(v.string()),
      taxable: v.optional(v.boolean()),
      taxPercent: v.optional(v.number()),
      taxRate: v.optional(v.number()),
      handlingPerUnit: v.optional(v.number()),
      grossMargin: v.optional(v.number()),
      grossProfit: v.optional(v.number()),
      shopifyCreatedAt: v.number(),
      shopifyUpdatedAt: v.number(),
      // Product info (joined)
      productName: v.optional(v.string()),
      productHandle: v.optional(v.string()),
      productVendor: v.optional(v.string()),
      productType: v.optional(v.string()),
      productStatus: v.optional(v.string()),
      productImage: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

    const orgId = user.organizationId;

    // Get variants
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .take(args.limit || 100);

    // Get unique product IDs
    const productIds = [...new Set(variants.map((v) => v.productId))];

    // Fetch all products in one query
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Create a map for quick product lookup
    const productMap = new Map();

    for (const product of products) {
      if (productIds.includes(product._id)) {
        productMap.set(product._id, product);
      }
    }

    // Load cost components for the organization once
    const costComponents = await ctx.db
      .query("variantCosts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    const componentByVariant = new Map<Id<"shopifyProductVariants">, typeof costComponents[number]>();
    for (const component of costComponents) {
      componentByVariant.set(component.variantId, component);
    }

    // Join variant with product and cost component data
    return variants.map((variant) => {
      const product = productMap.get(variant.productId);
      const component = componentByVariant.get(variant._id);
      const cogsPerUnit = component?.cogsPerUnit;
      const handlingPerUnit = component?.handlingPerUnit;
      const taxPercent = component?.taxPercent;

      const totalCost =
        (cogsPerUnit ?? 0) + (handlingPerUnit ?? 0);
      const grossProfit = variant.price - totalCost;
      const grossMargin = variant.price > 0 ? (grossProfit / variant.price) * 100 : 0;

      return {
        ...variant,
        cogsPerUnit,
        handlingPerUnit,
        taxPercent,
        taxRate: taxPercent,
        grossProfit,
        grossMargin,
        // Add product fields with "product" prefix
        productName: product?.title,
        productHandle: product?.handle,
        productVendor: product?.vendor,
        productType: product?.productType,
        productStatus: product?.status,
        productImage: product?.featuredImage,
      };
    });
  },
});

/**
 * Public version of getStoreByDomain for session management
 */
export const getPublicStoreByDomain = query({
  args: { shopDomain: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("shopifyStores"),
      organizationId: v.id("organizations"),
      shopDomain: v.string(),
      storeName: v.string(),
      accessToken: v.string(),
      scope: v.string(),
      isActive: v.boolean(),
      webhooksRegistered: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, args) => {
    // Get the store by shop domain - no auth required for session management
    const domain = normalizeShopDomain(args.shopDomain);
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", domain))
      .first();

    if (!store) return null;

    return {
      _id: store._id,
      organizationId: store.organizationId as Id<"organizations">,
      shopDomain: store.shopDomain,
      storeName: store.storeName,
      accessToken: store.accessToken,
      scope: store.scope || "",
      isActive: store.isActive,
      webhooksRegistered: store.webhooksRegistered,
    };
  },
});

/**
 * Public version of getActiveStoreInternal for session management
 */
export const getPublicActiveStore = query({
  args: { organizationId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    // Get the active store for the organization - no auth required for session management
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("isActive", true)
      )
      .first();

    return store || null;
  },
});
