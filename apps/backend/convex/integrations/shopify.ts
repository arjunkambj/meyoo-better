import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { ShopifyGraphQLClient } from "../../libs/shopify/ShopifyGraphQLClient";
import { createSimpleLogger } from "../../libs/logging/simple";
import { parseMoney } from "../../libs/utils/money";
import { internal } from "../_generated/api";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";

import {
  createIntegration,
  type DateRange,
  IntegrationError,
  type SyncResult,
  SyncUtils,
} from "./_base";
import { normalizeShopDomain } from "../utils/shop";
import { gid, toMs } from "../utils/shopify";

const logger = createSimpleLogger("Shopify");

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (typeof value === "number") return String(value);

  return undefined;
};

// Input types matching storeOrdersInternal validator (for type safety when calling)
type ShopifyOrderLineItemInput = {
  shopifyId: string;
  title: string;
  name?: string;
  quantity: number;
  sku?: string;
  shopifyVariantId?: string;
  shopifyProductId?: string;
  price: number;
  discountedPrice?: number;
  totalDiscount: number;
  fulfillableQuantity?: number;
  fulfillmentStatus?: string;
};

type ShopifyOrderInput = {
  shopifyId: string;
  orderNumber: string;
  name: string;
  customer?: {
    shopifyId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  email?: string;
  phone?: string;
  shopifyCreatedAt: number;
  updatedAt?: number;
  processedAt?: number;
  closedAt?: number;
  cancelledAt?: number;
  financialStatus?: string;
  fulfillmentStatus?: string;
  totalPrice: number;
  subtotalPrice: number;
  totalTax: number;
  totalDiscounts: number;
  totalShippingPrice: number;
  totalTip?: number;
  currency?: string;
  totalItems: number;
  totalQuantity: number;
  totalWeight?: number;
  tags?: string[];
  note?: string;
  riskLevel?: string;
  shippingAddress?: {
    country?: string;
    province?: string;
    city?: string;
    zip?: string;
  };
  lineItems: ShopifyOrderLineItemInput[];
};

/**
 * Shopify Integration
 * Handles real-time webhooks and data syncing
 */
export const shopify: any = createIntegration({
  name: "shopify",
  displayName: "Shopify",
  version: "1.0.0",
  icon: "mdi:shopify",

  /**
   * Sync operations
   */
  sync: {
    /**
     * Initial sync - fetch 60 days of historical data
     */
    initial: async (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        dateRange?: DateRange;
        credentials?: Record<string, unknown>;
      }
    ): Promise<SyncResult> => {
      const dateRange = args.dateRange || SyncUtils.getInitialDateRange(60);

      try {
        logger.info("Starting Shopify initial sync", {
          organizationId: args.organizationId,
          dateRange,
        });

        // Get Shopify store
        const store = await ctx.runQuery(
          internal.integrations.shopify.getActiveStoreInternal,
          {
            organizationId: args.organizationId,
          }
        );

        if (!store) {
          throw new IntegrationError(
            "No active Shopify store found",
            "STORE_NOT_FOUND",
            "shopify"
          );
        }

        // Initialize Shopify client
        const client = await initializeShopifyClient(store);

        let recordsProcessed = 0;
        const errors: string[] = [];

        // Sync products
        try {
          const products = await fetchProducts(client, dateRange);

          await ctx.runMutation(
            internal.integrations.shopify.storeProductsInternal,
            {
              organizationId: store.organizationId as Id<"organizations">,
              storeId: store._id,
              products,
            }
          );
          recordsProcessed += products.length;
        } catch (error) {
          errors.push(
            `Product sync failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Sync orders
        try {
          const orders = await fetchOrders(client, dateRange);

          await ctx.runMutation(
            internal.integrations.shopify.storeOrdersInternal,
            {
              organizationId: store.organizationId as Id<"organizations">,
              storeId: store._id,
              orders,
            }
          );
          recordsProcessed += orders.length;
        } catch (error) {
          errors.push(
            `Order sync failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Sync customers
        try {
          const customers = await fetchCustomers(client, dateRange);

          await ctx.runMutation(
            internal.integrations.shopify.storeCustomersInternal,
            {
              organizationId: store.organizationId as Id<"organizations">,
              customers,
            }
          );
          recordsProcessed += customers.length;
        } catch (error) {
          errors.push(
            `Customer sync failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        return SyncUtils.formatResult(
          errors.length === 0,
          recordsProcessed,
          recordsProcessed > 0,
          errors
        );
      } catch (error) {
        logger.error("Initial sync failed", error, {
          organizationId: args.organizationId,
        });

        return SyncUtils.formatResult(false, 0, false, [
          error instanceof Error ? error.message : String(error),
        ]);
      }
    },

    /**
     * Incremental sync - fetch recent updates
     */
    incremental: async (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        since?: string;
        credentials?: Record<string, unknown>;
      }
    ): Promise<SyncResult> => {
      try {
        logger.info("Starting Shopify incremental sync", {
          organizationId: args.organizationId,
          since: args.since,
        });

        const store = await ctx.runQuery(
          internal.integrations.shopify.getActiveStoreInternal,
          {
            organizationId: args.organizationId,
          }
        );

        if (!store) {
          throw new IntegrationError(
            "No active Shopify store found",
            "STORE_NOT_FOUND",
            "shopify"
          );
        }

        // Get last sync time
        const lastSync =
          args.since ||
          (await ctx.runQuery(
            internal.integrations.shopify.getLastSyncTimeInternal,
            {
              organizationId: args.organizationId as Id<"organizations">,
            }
          ));

        const client = await initializeShopifyClient(store);
        let recordsProcessed = 0;

        // Fetch updated orders
        logger.debug("Fetching orders since", { lastSync });
        const orders = await fetchOrdersSince(client, lastSync);

        logger.info("Orders fetched for incremental sync", {
          count: orders.length,
        });

        if (orders.length > 0) {
          await ctx.runMutation(
            internal.integrations.shopify.storeOrdersInternal,
            {
              organizationId: args.organizationId as Id<"organizations">,
              orders,
            }
          );
          recordsProcessed += orders.length;
          logger.info("Orders updated successfully", { count: orders.length });
        }

        // Fetch updated products
        logger.debug("Fetching products since", { lastSync });
        const products = await fetchProductsSince(client, lastSync);

        logger.info("Products fetched for incremental sync", {
          count: products.length,
        });

        if (products.length > 0) {
          await ctx.runMutation(
            internal.integrations.shopify.storeProductsInternal,
            {
              organizationId: args.organizationId as Id<"organizations">,
              products,
            }
          );
          recordsProcessed += products.length;
        }

        return SyncUtils.formatResult(
          true,
          recordsProcessed,
          recordsProcessed > 0
        );
      } catch (error) {
        return SyncUtils.formatResult(false, 0, false, [
          error instanceof Error ? error.message : String(error),
        ]);
      }
    },

    /**
     * Validate Shopify connection
     */
    validate: async (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        credentials?: Record<string, unknown>;
      }
    ): Promise<boolean> => {
      try {
        const store = await ctx.runQuery(
          internal.integrations.shopify.getActiveStoreInternal,
          {
            organizationId: args.organizationId,
          }
        );

        if (!store) return false;

        const client = await initializeShopifyClient(store);
        // Try to fetch shop info to validate connection
        const shop = await client.getShopInfo();

        const isValid = !!shop;

        logger.info("Shopify connection validation completed", {
          organizationId: args.organizationId,
          isValid,
          shopName: shop?.data?.shop?.name,
        });

        return isValid;
      } catch (error) {
        logger.error("Shopify connection validation failed", error, {
          organizationId: args.organizationId,
        });

        return false;
      }
    },
  },

  /**
   * Webhook handlers
   */
  webhooks: {
    /**
     * Order created webhook
     */
    "orders/create": async (ctx: any, payload: any) => {
      const order = parseOrderWebhook(payload);

      await ctx.runMutation(internal.integrations.shopify.storeOrdersInternal, {
        organizationId: payload.organizationId as Id<"organizations">,
        orders: [order as unknown as any],
      });
    },

    /**
     * Order updated webhook
     */
    "orders/updated": async (ctx: any, payload: any) => {
      const order = parseOrderWebhook(payload);

      await ctx.runMutation(internal.integrations.shopify.updateOrderInternal, {
        organizationId: payload.organizationId as string,
        order: order as Doc<"shopifyOrders">,
      });
    },

    /**
     * Product created webhook
     */
    "products/create": async (ctx: any, payload: any) => {
      const product = parseProductWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.storeProductsInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          products: [product as Doc<"shopifyProducts">],
        }
      );
    },

    /**
     * Product updated webhook
     */
    "products/update": async (ctx: any, payload: any) => {
      const product = parseProductWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateProductInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          product: product as Doc<"shopifyProducts">,
        }
      );
    },

    /**
     * App uninstalled webhook
     */
    "app/uninstalled": async (ctx: any, payload: any) => {
      const { shop_domain } = payload as { shop_domain: string };

      await ctx.runMutation(
        internal.integrations.shopify.handleAppUninstallInternal,
        {
          shopDomain: shop_domain,
        }
      );
    },

    /**
     * Order fulfilled webhook
     */
    "orders/fulfilled": async (ctx: any, payload: any) => {
      const order = parseOrderWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateOrderStatusInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          orderId: (order as Record<string, unknown>).shopifyId as string,
          fulfillmentStatus: "fulfilled",
        }
      );
    },

    /**
     * Order partially fulfilled webhook
     */
    "orders/partially_fulfilled": async (ctx: any, payload: any) => {
      const order = parseOrderWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateOrderStatusInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          orderId: (order as Record<string, unknown>).shopifyId as string,
          fulfillmentStatus: "partially_fulfilled",
        }
      );
    },

    /**
     * Order paid webhook
     */
    "orders/paid": async (ctx: any, payload: any) => {
      const order = parseOrderWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateOrderStatusInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          orderId: (order as Record<string, unknown>).shopifyId as string,
          financialStatus: "paid",
        }
      );
    },

    /**
     * Order cancelled webhook
     */
    "orders/cancelled": async (ctx: any, payload: any) => {
      const order = parseOrderWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateOrderStatusInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          orderId: (order as Record<string, unknown>).shopifyId as string,
          financialStatus: "cancelled",
          fulfillmentStatus: "cancelled",
        }
      );
    },

    /**
     * Customer delete webhook
     */
    "customers/delete": async (ctx: any, payload: any) => {
      const customer = parseCustomerWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.deleteCustomerInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          customerId: (customer as Record<string, unknown>).shopifyId as string,
        }
      );
    },

    /**
     * Customer enable webhook
     */
    "customers/enable": async (ctx: any, payload: any) => {
      const customer = parseCustomerWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateCustomerStatusInternal,
        {
          organizationId: payload.organizationId as Id<"organizations">,
          customerId: (customer as Record<string, unknown>).shopifyId as string,
          state: "enabled",
        }
      );
    },

    /**
     * Customer disable webhook
     */
    "customers/disable": async (ctx: any, payload: any) => {
      const customer = parseCustomerWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateCustomerStatusInternal,
        {
          organizationId: customer.organizationId as Id<"organizations">,
          customerId: String(customer.shopifyId),
          state: "disabled",
        }
      );
    },

    /**
     * Product delete webhook
     */
    "products/delete": async (ctx: any, payload: any) => {
      const { id, organizationId } = payload as {
        id: string;
        organizationId: Id<"organizations">;
      };

      await ctx.runMutation(
        internal.integrations.shopify.deleteProductInternal,
        {
          organizationId,
          productId: String(id),
        }
      );
    },

    /**
     * Inventory levels update webhook
     */
    "inventory_levels/update": async (ctx: any, payload: any) => {
      const { inventory_item_id, location_id, available, organizationId } =
        payload as Record<string, unknown>;

      await ctx.runMutation(
        internal.integrations.shopify.updateInventoryLevelInternal,
        {
          organizationId: organizationId as Id<"organizations">,
          inventoryItemId: String(inventory_item_id ?? ""),
          locationId: String(location_id ?? ""),
          available: Number(available ?? 0),
        }
      );
    },

    /**
     * Inventory item create webhook
     */
    "inventory_items/create": async (ctx: any, payload: any) => {
      const { id, sku, tracked, organizationId } = payload as Record<
        string,
        unknown
      >;

      await ctx.runMutation(
        internal.integrations.shopify.createInventoryItemInternal,
        {
          organizationId: organizationId as Id<"organizations">,
          inventoryItemId: String(id ?? ""),
          sku: (sku as string) || undefined,
          tracked: Boolean(tracked),
        }
      );
    },

    /**
     * Inventory item update webhook
     */
    "inventory_items/update": async (ctx: any, payload: any) => {
      const { id, sku, tracked, organizationId } = payload as Record<
        string,
        unknown
      >;

      await ctx.runMutation(
        internal.integrations.shopify.updateInventoryItemInternal,
        {
          organizationId: organizationId as Id<"organizations">,
          inventoryItemId: String(id ?? ""),
          sku: (sku as string) || undefined,
          tracked: Boolean(tracked),
        }
      );
    },

    /**
     * Inventory item delete webhook
     */
    "inventory_items/delete": async (ctx: any, payload: any) => {
      const { id, organizationId } = payload as Record<string, unknown>;

      await ctx.runMutation(
        internal.integrations.shopify.deleteInventoryItemInternal,
        {
          organizationId: organizationId as Id<"organizations">,
          inventoryItemId: String(id ?? ""),
        }
      );
    },

    /**
     * Fulfillment create webhook
     */
    "fulfillments/create": async (ctx: any, payload: any) => {
      const fulfillment = parseFulfillmentWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.storeFulfillmentInternal,
        {
          organizationId: fulfillment.organizationId as Id<"organizations">,
          fulfillment,
        }
      );
    },

    /**
     * Fulfillment update webhook
     */
    "fulfillments/update": async (ctx: any, payload: any) => {
      const fulfillment = parseFulfillmentWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateFulfillmentInternal,
        {
          organizationId: fulfillment.organizationId as Id<"organizations">,
          fulfillment,
        }
      );
    },

    /**
     * Shop update webhook
     */
    "shop/update": async (ctx: any, payload: any) => {
      const { id, domain, plan_name, organizationId } = payload as Record<
        string,
        unknown
      >;

      await ctx.runMutation(
        internal.integrations.shopify.updateShopDetailsInternal,
        {
          organizationId: organizationId as Id<"organizations">,
          shopId: String(id ?? ""),
          domain: String(domain ?? ""),
          planName: String(plan_name ?? ""),
        }
      );
    },

    /**
     * Collection create webhook
     */
    "collections/create": async (ctx: any, payload: any) => {
      const collection = parseCollectionWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.storeCollectionInternal,
        {
          organizationId: collection.organizationId as Id<"organizations">,
          collection,
        }
      );
    },

    /**
     * Collection update webhook
     */
    "collections/update": async (ctx: any, payload: any) => {
      const collection = parseCollectionWebhook(payload);

      await ctx.runMutation(
        internal.integrations.shopify.updateCollectionInternal,
        {
          organizationId: collection.organizationId as Id<"organizations">,
          collection,
        }
      );
    },

    /**
     * Collection delete webhook
     */
    "collections/delete": async (ctx: any, payload: any) => {
      const { id, organizationId } = payload as Record<string, unknown>;

      await ctx.runMutation(
        internal.integrations.shopify.deleteCollectionInternal,
        {
          organizationId: organizationId as Id<"organizations">,
          collectionId: String(id ?? ""),
        }
      );
    },
  },

  /**
   * Data queries
   */
  queries: {
    getStore: "getStore",
    getProducts: "getProducts",
    getOrders: "getOrders",
  },

  /**
   * Rate limiting
   */
  rateLimit: {
    requests: 40,
    window: 1000, // 40 requests per second
    concurrent: 10,
  },

  /**
   * Required environment variables
   */
  requiredEnvVars: ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "SHOPIFY_SCOPES"],

  /**
   * API cost (free with app)
   */
  apiCost: 0,
});

/**
 * Shopify Queries - Exported separately for Convex
 */
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
        costPerItem: v.optional(v.number()),
        inventoryItemId: v.optional(v.string()),
        taxable: v.optional(v.boolean()),
        taxRate: v.optional(v.number()),
        handlingPerUnit: v.optional(v.number()),
        paymentFeePercent: v.optional(v.number()),
        paymentFixedPerItem: v.optional(v.number()),
        paymentProvider: v.optional(v.string()),
        channel: v.optional(v.string()),
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
    const pageSize = args.pageSize || 20;

    // Get all variants for search/filter (we'll improve this with better indexes later)
    let allVariants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Get products for joining
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const productMap = new Map();

    for (const product of products) {
      productMap.set(product._id, product);
    }

    // Get default COGS percentage from onboarding costs if exists
    const defaultCOGS = (
      await ctx.db
        .query("costs")
        .withIndex("by_org_and_type", (q) =>
          q.eq("organizationId", orgId).eq("type", "product")
        )
        .collect()
    ).find(
      (c) =>
        c.isDefault &&
        c.calculation === "percentage" &&
        c.name === "Cost of Goods Sold"
    );

    // Deprecated: global default tax percentage no longer applied

    // Apply search filter if provided
    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase();

      allVariants = allVariants.filter((variant) => {
        const product = productMap.get(variant.productId);

        return (
          variant.title?.toLowerCase().includes(searchLower) ||
          variant.sku?.toLowerCase().includes(searchLower) ||
          variant.barcode?.toLowerCase().includes(searchLower) ||
          product?.title?.toLowerCase().includes(searchLower) ||
          product?.vendor?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Calculate pagination
    const totalItems = allVariants.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Get paginated data
    const paginatedVariants = allVariants.slice(startIndex, endIndex);

    // Join with product data and apply default costs
    // Load product-level cost components for tax percent
    const pcc = await ctx.db
      .query("productCostComponents")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    const pccByVariant = new Map<string, typeof pcc[0]>();
    for (const row of pcc) pccByVariant.set(row.variantId, row);

    const data = paginatedVariants.map((variant) => {
      const product = productMap.get(variant.productId);

      // Apply default COGS if no specific cost is set
      let costPerItem = variant.costPerItem;

      if (costPerItem === undefined && defaultCOGS?.value) {
        // Calculate cost as percentage of price
        costPerItem = (variant.price * defaultCOGS.value) / 100;
      }

      // Tax rate from product cost components when present
      const variantPcc = pccByVariant.get(variant._id);
      const taxRate = variantPcc?.taxPercent ?? variant.taxRate;
      const handlingPerUnit = variantPcc?.handlingPerUnit;
      const paymentFeePercent = variantPcc?.paymentFeePercent;
      const paymentFixedPerItem = variantPcc?.paymentFixedPerItem;
      const paymentProvider = variantPcc?.paymentProvider;
      const taxable = variant.taxable;

      // Calculate gross margin if we have cost
      let grossMargin = variant.grossMargin;
      let grossProfit = variant.grossProfit;

      if (costPerItem !== undefined && variant.price > 0) {
        grossProfit = variant.price - costPerItem;
        grossMargin = (grossProfit / variant.price) * 100;
      }

      return {
        ...variant,
        costPerItem,
        taxRate,
        taxable,
        handlingPerUnit,
        paymentFeePercent,
        paymentFixedPerItem,
        paymentProvider,
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
      costPerItem: v.optional(v.number()),
      inventoryItemId: v.optional(v.string()),
      taxable: v.optional(v.boolean()),
      taxRate: v.optional(v.number()),
      channel: v.optional(v.string()),
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

    // Join variant with product data
    return variants.map((variant) => {
      const product = productMap.get(variant.productId);

      return {
        ...variant,
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

export const getOrders = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("shopifyOrders"),
      _creationTime: v.number(),
      organizationId: v.string(),
      storeId: v.id("shopifyStores"),
      shopifyId: v.string(),
      orderNumber: v.string(),
      name: v.string(),
      customerId: v.optional(v.id("shopifyCustomers")),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      shopifyCreatedAt: v.number(),
      processedAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      closedAt: v.optional(v.number()),
      cancelledAt: v.optional(v.number()),
      totalPrice: v.number(),
      subtotalPrice: v.number(),
      totalTax: v.number(),
      totalDiscounts: v.number(),
      totalShippingPrice: v.number(),
      totalTip: v.optional(v.number()),
      financialStatus: v.optional(v.string()),
      fulfillmentStatus: v.optional(v.string()),
      orderStatus: v.optional(v.string()),
      totalItems: v.number(),
      totalQuantity: v.number(),
      totalWeight: v.optional(v.number()),
      totalWeightUnit: v.optional(v.string()),
      shippingAddress: v.optional(
        v.object({
          country: v.optional(v.string()),
          province: v.optional(v.string()),
          city: v.optional(v.string()),
          zip: v.optional(v.string()),
        })
      ),
      sourceUrl: v.optional(v.string()),
      landingSite: v.optional(v.string()),
      referringSite: v.optional(v.string()),
      utmSource: v.optional(v.string()),
      utmMedium: v.optional(v.string()),
      utmCampaign: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      note: v.optional(v.string()),
      riskLevel: v.optional(v.string()),
      syncedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

    const orgId = user.organizationId;

    // Use take() instead of collect() + slice for efficiency
    if (args.status) {
      // Need proper index for status filtering
      const allOrders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .take(1000); // Take reasonable limit first

      // Filter by status in memory for now (needs index in schema)
      return allOrders
        .filter((order) => order.financialStatus === args.status)
        .slice(0, args.limit || 100);
    }

    return await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .take(args.limit || 100);
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
 * Mark webhooks registration status for a store by domain (public)
 */
export const setWebhooksRegisteredByDomain = mutation({
  args: { shopDomain: v.string(), value: v.boolean() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const domain = normalizeShopDomain(args.shopDomain);
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", domain))
      .first();

    if (!store) throw new Error("Store not found");

    await ctx.db.patch(store._id, {
      webhooksRegistered: args.value,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Atomically check and register webhooks if not already registered
 * Returns true if webhooks need to be registered, false if already registered
 */
export const checkAndSetWebhooksRegistered = mutation({
  args: { shopDomain: v.string() },
  returns: v.object({
    shouldRegister: v.boolean(),
    alreadyRegistered: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const domain = normalizeShopDomain(args.shopDomain);
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", domain))
      .first();

    if (!store) {
      throw new Error("Store not found");
    }

    // Check if webhooks are already registered
    if (store.webhooksRegistered === true) {
      return {
        shouldRegister: false,
        alreadyRegistered: true,
      };
    }

    // Atomically set the flag to prevent race conditions
    await ctx.db.patch(store._id, {
      webhooksRegistered: true,
      updatedAt: Date.now(),
    });

    return {
      shouldRegister: true,
      alreadyRegistered: false,
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

/**
 * Get Shopify session by shop domain for billing verification
 */
export const getSessionByShopDomain = query({
  args: { shopDomain: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      shop: v.string(),
      accessToken: v.string(),
      scope: v.string(),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    // Get the store by shop domain
    const domain = normalizeShopDomain(args.shopDomain);
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", domain))
      .first();

    if (!store || !store.isActive) return null;

    return {
      shop: store.shopDomain,
      accessToken: store.accessToken,
      scope: store.scope || "",
      isActive: store.isActive,
    };
  },
});

// Internal queries and mutations for database access

export const getActiveStoreInternal = internalQuery({
  args: { organizationId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("isActive", true)
      )
      .first();
  },
});

export const getStoreByDomain = internalQuery({
  args: { shopDomain: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const domain = normalizeShopDomain(args.shopDomain);
    return await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", domain))
      .first();
  },
});

export const getLastSyncTimeInternal = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const lastSession = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("platform", "shopify"),
      )
      .order("desc")
      .first();

    return lastSession?.completedAt
      ? new Date(lastSession.completedAt).toISOString()
      : new Date(Date.now() - 86400000).toISOString(); // Default to 24 hours ago
  },
});

type ShopifyStoreLike = {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
};

async function initializeShopifyClient(
  store: ShopifyStoreLike
): Promise<ShopifyGraphQLClient> {
  // Initialize the actual Shopify GraphQL client
  return new ShopifyGraphQLClient({
    shopDomain: store.shopDomain,
    accessToken: store.accessToken,
    apiVersion: store.apiVersion,
  });
}

async function fetchProducts(
  client: ShopifyGraphQLClient,
  _dateRange: DateRange
): Promise<Array<Record<string, unknown>>> {
  const products: Array<Record<string, unknown>> = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  try {
    while (hasNextPage) {
      const response = await client.getProducts(250, cursor);

      if (response.data?.products?.edges) {
        for (const edge of response.data.products.edges) {
          const product = edge.node;

          // Parse product data
          const productData = {
            shopifyId: gid(product.id, "Product"),
            title: toOptionalString(product.title) ?? "",
            handle: toOptionalString(product.handle) ?? "",
            productType: toOptionalString(product.productType),
            vendor: toOptionalString(product.vendor),
            status: toOptionalString(product.status) ?? "",
            featuredImage: toOptionalString(product.featuredImage?.url),
            tags: product.tags || [],
            shopifyCreatedAt: toMs(product.createdAt) ?? Date.now(),
            shopifyUpdatedAt: toMs(product.updatedAt) ?? Date.now(),
            publishedAt: toMs(product.publishedAt) ?? null,
            variants: [] as Array<{
              shopifyId: string;
              title: string;
              sku?: string;
              barcode?: string;
              price: number;
              compareAtPrice: number | null;
              position: number;
              inventoryQuantity: number;
              taxable?: boolean;
              shopifyCreatedAt: number;
              shopifyUpdatedAt: number;
              option1?: string;
              option2?: string;
              option3?: string;
            }>,
          };

          // Parse variants
          if (product.variants?.edges) {
            for (const variantEdge of product.variants.edges) {
              const variant = variantEdge.node;

              productData.variants.push({
                shopifyId: gid(variant.id, "ProductVariant"),
                title: toOptionalString(variant.title) ?? "",
                sku: toOptionalString(variant.sku),
                barcode: toOptionalString(variant.barcode),
                price: parseFloat(variant.price || "0"),
                compareAtPrice: variant.compareAtPrice
                  ? parseFloat(variant.compareAtPrice)
                  : null,
                position: variant.position || 0,
                inventoryQuantity: variant.inventoryQuantity || 0,
                taxable: typeof variant.taxable === "boolean" ? variant.taxable : undefined,
                shopifyCreatedAt: toMs(variant.createdAt) ?? Date.now(),
                shopifyUpdatedAt: toMs(variant.updatedAt) ?? Date.now(),
                option1: toOptionalString(variant.selectedOptions?.[0]?.value),
                option2: toOptionalString(variant.selectedOptions?.[1]?.value),
                option3: toOptionalString(variant.selectedOptions?.[2]?.value),
              });
            }
          }

          products.push(productData);
        }

        hasNextPage = response.data.products.pageInfo?.hasNextPage || false;
        cursor = response.data.products.pageInfo?.endCursor || null;
      } else {
        hasNextPage = false;
      }
    }
  } catch (error) {
    logger.error("Failed to fetch products from Shopify", error);
    throw error;
  }

  return products;
}

async function fetchProductsSince(
  client: ShopifyGraphQLClient,
  since: string
): Promise<Array<Record<string, unknown>>> {
  // For incremental sync, we can add a query filter
  // For now, using the same implementation as fetchProducts
  return fetchProducts(client, { startDate: since });
}

async function fetchOrders(
  client: ShopifyGraphQLClient,
  dateRange: DateRange
): Promise<ShopifyOrderInput[]> {
  const orders: ShopifyOrderInput[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  try {
    // Build query string for date filtering if provided
    let query = "";

    if (dateRange?.startDate) {
      query = `created_at:>=${new Date(dateRange.startDate).toISOString()}`;
    }

    while (hasNextPage) {
      const response = await client.getOrders(50, cursor, query);

      if (response.data?.orders?.edges) {
        for (const edge of response.data.orders.edges) {
          const order = edge.node;

          // Parse order data
          const orderData: ShopifyOrderInput = {
            shopifyId: order.id.replace("gid://shopify/Order/", ""),
            orderNumber: order.name
              ? order.name.replace("#", "")
              : order.id.replace("gid://shopify/Order/", ""),
            name: order.name || "",
            email: toOptionalString((order as any).email),
            phone: toOptionalString((order as any).phone),
            shopifyCreatedAt: order.createdAt
              ? new Date(order.createdAt).getTime()
              : Date.now(),
            updatedAt: order.updatedAt
              ? new Date(order.updatedAt).getTime()
              : undefined,
            processedAt: order.processedAt
              ? new Date(order.processedAt).getTime()
              : undefined,
            closedAt: order.closedAt
              ? new Date(order.closedAt).getTime()
              : undefined,
            cancelledAt: order.cancelledAt
              ? new Date(order.cancelledAt).getTime()
              : undefined,
            financialStatus: order.displayFinancialStatus,
            fulfillmentStatus: order.displayFulfillmentStatus,
            totalPrice: parseMoney(
              (order as any).currentTotalPriceSet?.shopMoney?.amount
            ),
            subtotalPrice: parseMoney(
              (order as any).currentSubtotalPriceSet?.shopMoney?.amount
            ),
            totalTax: parseMoney(
              (order as any).currentTotalTaxSet?.shopMoney?.amount
            ),
            totalDiscounts: parseMoney(
              (order as any).currentTotalDiscountsSet?.shopMoney?.amount
            ),
            totalShippingPrice: parseMoney(
              (order as any).totalShippingPriceSet?.shopMoney?.amount
            ),
            totalTip: (order as any).totalTipReceivedSet
              ? parseMoney((order as any).totalTipReceivedSet.shopMoney?.amount)
              : undefined,
            totalItems: order.lineItems?.edges?.length || 0,
            totalQuantity:
              (order as any).subtotalLineItemsQuantity !== undefined
                ? Number((order as any).subtotalLineItemsQuantity)
                : 0,
            totalWeight: (order as any).totalWeight as number | undefined,
            tags: order.tags || [],
            note: toOptionalString(order.note),
            riskLevel: toOptionalString((order as any).risks?.[0]?.level),
            shippingAddress: order.shippingAddress
              ? {
                  country: toOptionalString(order.shippingAddress.country),
                  province: toOptionalString(order.shippingAddress.provinceCode),
                  city: toOptionalString(order.shippingAddress.city),
                  zip: toOptionalString(order.shippingAddress.zip),
                }
              : undefined,
            customer: order.customer
              ? {
                  shopifyId: gid(order.customer.id, "Customer"),
                  email: toOptionalString(order.customer.email),
                  firstName: toOptionalString(order.customer.firstName),
                  lastName: toOptionalString(order.customer.lastName),
                  phone: toOptionalString(order.customer.phone),
                }
              : undefined,
            lineItems: [] as ShopifyOrderLineItemInput[],
          };

          // Parse line items
          if (order.lineItems?.edges) {
            for (const itemEdge of order.lineItems.edges) {
              const item = itemEdge.node;

              orderData.lineItems.push({
                shopifyId: gid(item.id, "LineItem"),
                title:
                  toOptionalString(item.title) ??
                  toOptionalString((item as any).name) ??
                  "",
                name: toOptionalString((item as any).name),
                quantity: item.quantity || 0,
                sku: toOptionalString((item as any).sku),
                shopifyVariantId: gid(item.variant?.id, "ProductVariant"),
                shopifyProductId: gid((item.variant as any)?.product?.id, "Product"),
                price: parseMoney(item.originalUnitPriceSet?.shopMoney?.amount),
                discountedPrice: (item as any).discountedUnitPriceSet
                  ? parseMoney(
                      (item as any).discountedUnitPriceSet.shopMoney?.amount
                    )
                  : undefined,
                totalDiscount: parseMoney(
                  item.totalDiscountSet?.shopMoney?.amount
                ),
                fulfillmentStatus: toOptionalString((item as any).fulfillmentStatus),
              });
            }
          }

          orders.push(orderData);
        }

        hasNextPage = response.data.orders.pageInfo?.hasNextPage || false;
        cursor = response.data.orders.pageInfo?.endCursor || null;
      } else {
        hasNextPage = false;
      }
    }
  } catch (error) {
    logger.error("Failed to fetch orders from Shopify", error);
    throw error;
  }

  return orders;
}

async function fetchOrdersSince(
  client: ShopifyGraphQLClient,
  since: string
): Promise<ShopifyOrderInput[]> {
  // Use date query for incremental sync
  return fetchOrders(client, { startDate: since });
}

async function fetchCustomers(
  client: ShopifyGraphQLClient,
  _dateRange: DateRange
): Promise<Array<Record<string, unknown>>> {
  const customers: Array<Record<string, unknown>> = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  try {
    while (hasNextPage) {
      const response = await client.getCustomers(250, cursor);

      if (response.data?.customers?.edges) {
        for (const edge of response.data.customers.edges) {
          const customer = edge.node;

          customers.push({
            shopifyId: customer.id.replace("gid://shopify/Customer/", ""),
            email: toOptionalString((customer as any).email),
            firstName: toOptionalString((customer as any).firstName),
            lastName: toOptionalString((customer as any).lastName),
            phone: toOptionalString((customer as any).phone),
            acceptsMarketing: (customer as any).acceptsMarketing,
            totalSpent: parseMoney((customer as any).totalSpentV2?.amount),
            ordersCount: (customer as any).ordersCount || 0,
            tags: (customer as any).tags || [],
            note: toOptionalString((customer as any).note),
            createdAt: customer.createdAt
              ? new Date(customer.createdAt).getTime()
              : Date.now(),
            updatedAt: customer.updatedAt
              ? new Date(customer.updatedAt).getTime()
              : Date.now(),
          });
        }

        hasNextPage = response.data.customers.pageInfo?.hasNextPage || false;
        cursor = response.data.customers.pageInfo?.endCursor || null;
      } else {
        hasNextPage = false;
      }
    }
  } catch (error) {
    logger.error("Failed to fetch customers from Shopify", error);
    throw error;
  }

  return customers;
}

export const storeProductsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    // Prefer passing storeId when available to avoid race conditions
    storeId: v.optional(v.id("shopifyStores")),
    products: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.products || args.products.length === 0) {
      return null;
    }

    // Resolve the store to associate with these products
    let store: Doc<"shopifyStores"> | null = null;

    if (args.storeId) {
      store = await ctx.db.get(args.storeId);
    }

    if (!store) {
      store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization_and_active", (q) =>
          q
            .eq("organizationId", args.organizationId as Id<"organizations">)
            .eq("isActive", true)
        )
        .first();
    }

    if (!store) {
      throw new Error("No active Shopify store found");
    }

    // Step 1: Bulk fetch existing products
    const productShopifyIds = args.products.map((p) => p.shopifyId);
    const existingProducts = new Map();

    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_store", (q) => q.eq("storeId", store._id))
      .collect();

    for (const product of products) {
      if (productShopifyIds.includes(product.shopifyId)) {
        existingProducts.set(product.shopifyId, product);
      }
    }

    // Step 2: Collect all variants from all products
    const allVariants = [];
    const variantShopifyIds = new Set();
    const productIdMap = new Map();

    // Process products and collect variants
    for (const productData of args.products) {
      const variants = productData.variants || [];

      const productToStore = {
        organizationId: args.organizationId as Id<"organizations">,
        storeId: store._id,
        shopifyId: productData.shopifyId,
        title: toOptionalString(productData.title) ?? "",
        handle: toOptionalString(productData.handle) ?? "",
        productType: toOptionalString(productData.productType),
        vendor: toOptionalString(productData.vendor),
        status: toOptionalString(productData.status) ?? "",
        featuredImage: toOptionalString(productData.featuredImage),
        tags: productData.tags,
        totalVariants: variants.length,
        totalInventory: productData.totalInventory,
        shopifyCreatedAt: productData.shopifyCreatedAt,
        shopifyUpdatedAt: productData.shopifyUpdatedAt,
        publishedAt: productData.publishedAt,
        syncedAt: Date.now(),
      };

      const existing = existingProducts.get(productData.shopifyId);
      let productId: Id<"shopifyProducts">;

      if (existing) {
        await ctx.db.patch(existing._id, productToStore);
        productId = existing._id;
      } else {
        productId = await ctx.db.insert("shopifyProducts", productToStore);
      }

      productIdMap.set(productData.shopifyId, productId);

      // Collect variants for bulk processing
      for (const variant of variants) {
        variantShopifyIds.add(variant.shopifyId);
        allVariants.push({
          ...variant,
          productId,
          shopifyProductId: productData.shopifyId,
          organizationId: args.organizationId,
        });
      }
    }

    // Step 3: Bulk fetch existing variants
    const existingVariants = new Map();

    if (variantShopifyIds.size > 0) {
      const variants = await ctx.db.query("shopifyProductVariants").collect();

      for (const variant of variants) {
        if (variantShopifyIds.has(variant.shopifyId)) {
          existingVariants.set(variant.shopifyId, variant);
        }
      }
    }

    // Step 4: Process variants and collect inventory data
    const inventoryToStore = [];
    const variantIdMap = new Map();

    for (const variant of allVariants) {
      const variantToStore = {
        organizationId: args.organizationId as Id<"organizations">,
        productId: variant.productId,
        shopifyId: variant.shopifyId,
        shopifyProductId: variant.shopifyProductId,
        title: toOptionalString(variant.title) ?? "",
        sku: toOptionalString(variant.sku),
        barcode: toOptionalString(variant.barcode),
        position:
          typeof variant.position === "number" && Number.isFinite(variant.position)
            ? variant.position
            : 0,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        inventoryQuantity: variant.inventoryQuantity,
        available: typeof variant.available === "boolean" ? variant.available : undefined, // Add the available field
        inventoryItemId: toOptionalString(variant.inventoryItemId),
        costPerItem: variant.costPerItem,
        taxable: typeof variant.taxable === "boolean" ? variant.taxable : undefined,
        weight: variant.weight,
        weightUnit: toOptionalString(variant.weightUnit),
        option1: toOptionalString(variant.option1),
        option2: toOptionalString(variant.option2),
        option3: toOptionalString(variant.option3),
        shopifyCreatedAt: variant.shopifyCreatedAt,
        shopifyUpdatedAt: variant.shopifyUpdatedAt,
      };

      const existingVariant = existingVariants.get(variant.shopifyId);
      let variantId: Id<"shopifyProductVariants">;

      if (existingVariant) {
        await ctx.db.patch(existingVariant._id, variantToStore);
        variantId = existingVariant._id;
      } else {
        variantId = await ctx.db.insert(
          "shopifyProductVariants",
          variantToStore
        );
      }

      variantIdMap.set(variant.shopifyId, variantId);

      // Collect inventory levels for this variant
      if (variant.inventoryLevels && variant.inventoryLevels.length > 0) {
        for (const invLevel of variant.inventoryLevels) {
          inventoryToStore.push({
            organizationId: variant.organizationId,
            variantId,
            locationId: invLevel.locationId,
            locationName: invLevel.locationName,
            available: invLevel.available,
          });
        }
      }
    }

    // Step 5: Bulk process inventory levels
    if (inventoryToStore.length > 0) {
      // Create a map for quick lookup of existing inventory
      const inventoryKeys = inventoryToStore.map(
        (inv) => `${inv.variantId}-${inv.locationId}`
      );

      // Fetch all relevant inventory records at once
      const existingInventory = await ctx.db
        .query("shopifyInventory")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .collect();

      const existingInventoryMap = new Map();

      for (const inv of existingInventory) {
        const key = `${inv.variantId}-${inv.locationId}`;

        if (inventoryKeys.includes(key)) {
          existingInventoryMap.set(key, inv);
        }
      }

      // Process inventory updates
      for (const inventory of inventoryToStore) {
        const key = `${inventory.variantId}-${inventory.locationId}`;
        const existing = existingInventoryMap.get(key);

        const inventoryData = {
          ...inventory,
          updatedAt: Date.now(),
          syncedAt: Date.now(),
        };

        if (existing) {
          await ctx.db.patch(existing._id, inventoryData);
        } else {
          await (ctx.db.insert as any)("shopifyInventory", inventoryData);
        }
      }
    }

    logger.info(
      `Processed ${args.products.length} products with bulk operations`
    );

    return null;
  },
});

export const updateProductInternal = internalMutation({
  args: {
    organizationId: v.string(),
    product: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.product.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.product,
        syncedAt: Date.now(),
      });
    }

    return null;
  },
});

export const storeOrdersInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    // Prefer passing storeId when available to avoid race conditions
    storeId: v.optional(v.id("shopifyStores")),
    orders: v.array(
      v.object({
        shopifyId: v.string(),
        orderNumber: v.string(),
        name: v.string(),
        customer: v.optional(
          v.object({
            shopifyId: v.string(),
            email: v.optional(v.string()),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
            phone: v.optional(v.string()),
          })
        ),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        shopifyCreatedAt: v.number(),
        updatedAt: v.optional(v.number()),
        processedAt: v.optional(v.number()),
        closedAt: v.optional(v.number()),
        cancelledAt: v.optional(v.number()),
        financialStatus: v.optional(v.string()),
        fulfillmentStatus: v.optional(v.string()),
        totalPrice: v.number(),
        subtotalPrice: v.number(),
        totalTax: v.number(),
        totalDiscounts: v.number(),
        totalShippingPrice: v.number(),
        totalTip: v.optional(v.number()),
        currency: v.optional(v.string()),
        totalItems: v.number(),
        totalQuantity: v.number(),
        totalWeight: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
        note: v.optional(v.string()),
        riskLevel: v.optional(v.string()),
        shippingAddress: v.optional(
          v.object({
            country: v.optional(v.string()),
            province: v.optional(v.string()),
            city: v.optional(v.string()),
            zip: v.optional(v.string()),
          })
        ),
        lineItems: v.optional(
          v.array(
            v.object({
              shopifyId: v.string(),
              shopifyProductId: v.optional(v.string()),
              shopifyVariantId: v.optional(v.string()),
              title: v.string(),
              name: v.optional(v.string()),
              sku: v.optional(v.string()),
              quantity: v.number(),
              price: v.number(),
              totalDiscount: v.number(),
              discountedPrice: v.optional(v.number()),
              fulfillableQuantity: v.optional(v.number()),
              fulfillmentStatus: v.optional(v.string()),
            })
          )
        ),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.orders || args.orders.length === 0) {
      return null;
    }

    // Resolve the store to associate with these orders
    let store: Doc<"shopifyStores"> | null = null;

    if (args.storeId) {
      // Use provided storeId when available to avoid re-query races
      store = await ctx.db.get(args.storeId);
    }

    if (!store) {
      // Fallback to active store lookup by organization
      store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization_and_active", (q) =>
          q
            .eq("organizationId", args.organizationId as Id<"organizations">)
            .eq("isActive", true)
        )
        .first();
    }

    if (!store) {
      throw new Error("No active Shopify store found");
    }

    // Step 1: Collect all unique customers from orders
    const customerDataMap = new Map();

    for (const order of args.orders) {
      if (order.customer) {
        customerDataMap.set(order.customer.shopifyId, order.customer);
      }
    }

    // Step 2: Fetch only needed customers using precise index to minimize read set
    const customerShopifyIds = Array.from(customerDataMap.keys());
    const existingCustomers = new Map();

    for (const custShopifyId of customerShopifyIds) {
      const existing = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_shopify_id_store", (q) =>
          q.eq("shopifyId", custShopifyId).eq("storeId", store!._id)
        )
        .first();
      if (existing) existingCustomers.set(custShopifyId, existing);
    }

    // Step 3: Prepare customer inserts/updates
    const _customersToInsert = [];
    const customerIdMap = new Map();

    for (const [shopifyId, customerData] of customerDataMap) {
      const existing = existingCustomers.get(shopifyId);

      if (existing) {
        customerIdMap.set(shopifyId, existing._id);
        // Update existing customer if needed
        await ctx.db.patch(existing._id, {
          email: customerData.email || existing.email,
          firstName: customerData.firstName || existing.firstName,
          lastName: customerData.lastName || existing.lastName,
          phone: customerData.phone || existing.phone,
          shopifyUpdatedAt: Date.now(),
          syncedAt: Date.now(),
        });
      } else {
        // Prepare new customer for insert
        const newCustomerId = await ctx.db.insert("shopifyCustomers", {
          organizationId: args.organizationId as Id<"organizations">,
          storeId: store._id,
          shopifyId: shopifyId,
          email: customerData.email || undefined,
          firstName: customerData.firstName || undefined,
          lastName: customerData.lastName || undefined,
          phone: customerData.phone || undefined,
          totalSpent: 0,
          ordersCount: 0,
          shopifyCreatedAt: Date.now(),
          shopifyUpdatedAt: Date.now(),
          syncedAt: Date.now(),
        });

        customerIdMap.set(shopifyId, newCustomerId);
      }
    }

    // Step 4: Fetch only needed orders by shopifyId to minimize read set
    const orderShopifyIds = args.orders.map((o) => o.shopifyId);
    const existingOrders = new Map();

    for (const oid of orderShopifyIds) {
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) => q.eq("shopifyId", oid))
        .first();
      if (order && order.storeId === store._id) {
        existingOrders.set(oid, order);
      }
    }

    // Step 5: Process orders and collect line items
    const orderIdMap = new Map();
    const allLineItems = [];

    for (const orderData of args.orders) {
      const customerId = orderData.customer
        ? customerIdMap.get(orderData.customer.shopifyId)
        : undefined;

      const shippingAddress = orderData.shippingAddress
        ? {
            country: toOptionalString(orderData.shippingAddress.country),
            province: toOptionalString(orderData.shippingAddress.province),
            city: toOptionalString(orderData.shippingAddress.city),
            zip: toOptionalString(orderData.shippingAddress.zip),
          }
        : undefined;

      const tags = Array.isArray(orderData.tags)
        ? orderData.tags
            .map((tag) => toOptionalString(tag))
            .filter((tag): tag is string => Boolean(tag))
        : undefined;

      const orderToStore = {
        organizationId: args.organizationId as Id<"organizations">,
        storeId: store._id,
        shopifyId: orderData.shopifyId,
        orderNumber: orderData.orderNumber,
        name: orderData.name,
        customerId: customerId || undefined,
        email: toOptionalString(orderData.email),
        phone: toOptionalString(orderData.phone),
        shopifyCreatedAt: orderData.shopifyCreatedAt,
        updatedAt: orderData.updatedAt,
        processedAt: orderData.processedAt,
        closedAt: orderData.closedAt,
        cancelledAt: orderData.cancelledAt,
        financialStatus: toOptionalString(orderData.financialStatus),
        fulfillmentStatus: toOptionalString(orderData.fulfillmentStatus),
        totalPrice: orderData.totalPrice,
        subtotalPrice: orderData.subtotalPrice,
        totalTax: orderData.totalTax,
        totalDiscounts: orderData.totalDiscounts,
        totalShippingPrice: orderData.totalShippingPrice,
        totalTip: orderData.totalTip,
        currency: toOptionalString(orderData.currency), // Store the currency code
        totalItems: orderData.totalItems,
        totalQuantity: orderData.totalQuantity,
        totalWeight: orderData.totalWeight,
        tags,
        note: toOptionalString(orderData.note),
        riskLevel: toOptionalString(orderData.riskLevel),
        shippingAddress,
        syncedAt: Date.now(),
      };

      const existing = existingOrders.get(orderData.shopifyId);
      let orderId: Id<"shopifyOrders">;

      if (existing) {
        await ctx.db.patch(existing._id, orderToStore);
        orderId = existing._id;
      } else {
        // Re-check by shopifyId to avoid duplicates in concurrent writes
        const possible = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_shopify_id", (q) =>
            q.eq("shopifyId", orderData.shopifyId)
          )
          .collect();
        const existingForStore = possible.find((o) => o.storeId === store._id);

        if (existingForStore) {
          await ctx.db.patch(existingForStore._id, orderToStore);
          orderId = existingForStore._id as Id<"shopifyOrders">;
        } else {
          orderId = await ctx.db.insert("shopifyOrders", orderToStore);
        }
      }

      orderIdMap.set(orderData.shopifyId, orderId);

      // Collect line items for bulk processing
      if (orderData.lineItems) {
        for (const item of orderData.lineItems) {
          allLineItems.push({
            ...item,
            orderId,
            orderShopifyId: orderData.shopifyId,
          });
        }
      }
    }

    // Step 6: Bulk process line items if any
    if (allLineItems.length > 0) {
      // Collect unique product and variant IDs
      const productShopifyIds = new Set();
      const variantShopifyIds = new Set();

      for (const item of allLineItems) {
        if (item.shopifyProductId) productShopifyIds.add(item.shopifyProductId);
        if (item.shopifyVariantId) variantShopifyIds.add(item.shopifyVariantId);
      }

      // Bulk fetch products
      const productIdMap = new Map();

      if (productShopifyIds.size > 0) {
        for (const pid of productShopifyIds) {
          const product = await ctx.db
            .query("shopifyProducts")
            .withIndex("by_shopify_id_store", (q) =>
              q.eq("shopifyId", pid as string).eq("storeId", store._id)
            )
            .first();
          if (product) productIdMap.set(pid, product._id);
        }
      }

      // Bulk fetch variants
      const variantIdMap = new Map();

      if (variantShopifyIds.size > 0) {
        for (const vid of variantShopifyIds) {
          const variant = await ctx.db
            .query("shopifyProductVariants")
            .withIndex("by_shopify_id", (q) => q.eq("shopifyId", vid as string))
            .first();
          if (variant) variantIdMap.set(vid, variant._id);
        }
      }

      // Bulk fetch existing line items
      const lineItemShopifyIds = allLineItems.map((item) => item.shopifyId);
      const existingLineItems = new Map();
      for (const liId of lineItemShopifyIds) {
        const li = await ctx.db
          .query("shopifyOrderItems")
          .withIndex("by_shopify_id", (q) => q.eq("shopifyId", liId))
          .first();
        if (li) existingLineItems.set(liId, li);
      }

      // Process line items
      for (const item of allLineItems) {
        const itemToStore = {
          organizationId: args.organizationId as Id<"organizations">,
          orderId: item.orderId,
          shopifyId: item.shopifyId,
          shopifyProductId: item.shopifyProductId,
          shopifyVariantId: item.shopifyVariantId,
          productId: item.shopifyProductId
            ? productIdMap.get(item.shopifyProductId)
            : undefined,
          variantId: item.shopifyVariantId
            ? variantIdMap.get(item.shopifyVariantId)
            : undefined,
          title: toOptionalString(item.title) ?? "",
          variantTitle: toOptionalString(item.name),
          sku: toOptionalString(item.sku),
          quantity: item.quantity,
          price: item.price,
          totalDiscount: item.discountedPrice
            ? item.price - item.discountedPrice
            : 0,
          fulfillableQuantity: item.fulfillableQuantity ?? 0,
          fulfillmentStatus: toOptionalString(item.fulfillmentStatus),
        };

        const existingItem = existingLineItems.get(item.shopifyId);

        if (existingItem) {
          await ctx.db.patch(existingItem._id, itemToStore);
        } else {
          // Re-check to avoid duplicates in concurrent writes
          const maybeItem = await ctx.db
            .query("shopifyOrderItems")
            .withIndex("by_shopify_id", (q) =>
              q.eq("shopifyId", item.shopifyId)
            )
            .first();

          if (maybeItem) {
            await ctx.db.patch(maybeItem._id, itemToStore);
          } else {
            await ctx.db.insert("shopifyOrderItems", itemToStore);
          }
        }
      }
    }

    logger.info(`Processed ${args.orders.length} orders with bulk operations`);

    // Calculate customer metrics for affected customers
    const uniqueCustomerIds = new Set<Id<"shopifyCustomers">>();

    for (const order of args.orders) {
      if (order.customer) {
        const customerId = customerIdMap.get(order.customer.shopifyId);

        if (customerId) {
          uniqueCustomerIds.add(customerId);
        }
      }
    }

    if (uniqueCustomerIds.size > 0) {
      try {
        await ctx.runMutation(
          internal.analytics.customerCalculations.calculateCustomerMetrics,
          {
            organizationId: args.organizationId,
            customerIds: Array.from(uniqueCustomerIds),
          }
        );
        logger.info(
          `Calculated metrics for ${uniqueCustomerIds.size} customers`
        );
      } catch (error) {
        logger.error("Failed to calculate customer metrics", error);
      }
    }

    return null;
  },
});

export const storeCustomersInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customers: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.customers || args.customers.length === 0) {
      return null;
    }

    // Bulk fetch existing customers
    const customerShopifyIds = args.customers.map((c) => c.shopifyId || c.id);
    const existingCustomers = new Map();

    // Fetch all customers that might need updating
    const customers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    for (const customer of customers) {
      if (customerShopifyIds.includes(customer.shopifyId)) {
        existingCustomers.set(customer.shopifyId, customer);
      }
    }

    // Process customers in bulk
    for (const customer of args.customers) {
      const shopifyId = customer.shopifyId || customer.id;
      const existing = existingCustomers.get(shopifyId);

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...customer,
          syncedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("shopifyCustomers", customer);
      }
    }

    logger.info(
      `Processed ${args.customers.length} customers with bulk operations`
    );

    return null;
  },
});

export const updateOrderInternal = internalMutation({
  args: {
    organizationId: v.string(),
    order: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.order.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.order,
        syncedAt: Date.now(),
      });
    }

    return null;
  },
});

export const storeTransactionsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    transactions: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const transaction of args.transactions) {
      // Find the order first
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", transaction.shopifyOrderId)
        )
        .first();

      if (!order) {
        logger.warn("Order not found for transaction", {
          orderId: transaction.shopifyOrderId,
          transactionId: transaction.shopifyId,
        });
        continue;
      }

      // Check if transaction already exists
      const existing = await ctx.db
        .query("shopifyTransactions")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", transaction.shopifyId)
        )
        .first();

      const transactionData = {
        organizationId: args.organizationId as Id<"organizations">,
        orderId: order._id,
        shopifyId: transaction.shopifyId,
        shopifyOrderId: transaction.shopifyOrderId,
        kind: transaction.kind,
        status: transaction.status,
        gateway: transaction.gateway,
        amount: transaction.amount,
        fee: transaction.fee,
        paymentId: transaction.paymentId,
        paymentDetails: transaction.paymentDetails,
        shopifyCreatedAt: transaction.shopifyCreatedAt,
        processedAt: transaction.processedAt,
      };

      if (existing) {
        await ctx.db.patch(existing._id, transactionData);
      } else {
        await ctx.db.insert("shopifyTransactions", transactionData);
      }
    }

    return null;
  },
});

export const storeRefundsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    refunds: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const refund of args.refunds) {
      // Find the order first
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", refund.shopifyOrderId)
        )
        .first();

      if (!order) {
        logger.warn("Order not found for refund", {
          orderId: refund.shopifyOrderId,
          refundId: refund.shopifyId,
        });
        continue;
      }

      // Check if refund already exists
      const existing = await ctx.db
        .query("shopifyRefunds")
        .withIndex("by_shopify_id", (q) => q.eq("shopifyId", refund.shopifyId))
        .first();

      const refundData = {
        organizationId: args.organizationId as Id<"organizations">,
        orderId: order._id,
        shopifyId: refund.shopifyId,
        shopifyOrderId: refund.shopifyOrderId,
        note: refund.note,
        userId: refund.userId,
        totalRefunded: refund.totalRefunded,
        refundLineItems: refund.refundLineItems,
        shopifyCreatedAt: refund.shopifyCreatedAt,
        processedAt: refund.processedAt,
      };

      if (existing) {
        await ctx.db.patch(existing._id, refundData);
      } else {
        await ctx.db.insert("shopifyRefunds", refundData);
      }
    }

    return null;
  },
});

export const storeFulfillmentsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fulfillments: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const fulfillment of args.fulfillments) {
      // Find the order first
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", fulfillment.shopifyOrderId)
        )
        .first();

      if (!order) {
        logger.warn("Order not found for fulfillment", {
          orderId: fulfillment.shopifyOrderId,
          fulfillmentId: fulfillment.shopifyId,
        });
        continue;
      }

      // Check if fulfillment already exists
      const existing = await ctx.db
        .query("shopifyFulfillments")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", fulfillment.shopifyId)
        )
        .first();

      const fulfillmentData = {
        organizationId: args.organizationId as Id<"organizations">,
        orderId: order._id,
        shopifyId: fulfillment.shopifyId,
        shopifyOrderId: fulfillment.shopifyOrderId,
        status: fulfillment.status,
        shipmentStatus: fulfillment.shipmentStatus,
        trackingCompany: fulfillment.trackingCompany,
        trackingNumbers: fulfillment.trackingNumbers,
        trackingUrls: fulfillment.trackingUrls,
        locationId: fulfillment.locationId,
        service: fulfillment.service,
        lineItems: fulfillment.lineItems,
        shopifyCreatedAt: fulfillment.shopifyCreatedAt,
        shopifyUpdatedAt: fulfillment.shopifyUpdatedAt,
        syncedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, fulfillmentData);
      } else {
        await ctx.db.insert("shopifyFulfillments", fulfillmentData);
      }
    }

    return null;
  },
});

/**
 * Upsert a customer from webhook payload (minimal fields)
 */
export const upsertCustomerFromWebhook = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    customer: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shopifyId = String(args.customer.id);
    const existing = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id_store", (q) =>
        q.eq("shopifyId", shopifyId).eq("storeId", args.storeId),
      )
      .first();

    const doc = {
      organizationId: args.organizationId as Id<"organizations">,
      storeId: args.storeId as Id<"shopifyStores">,
      shopifyId,
      email: (args.customer.email as string) || undefined,
      phone: (args.customer.phone as string) || undefined,
      firstName: (args.customer.first_name as string) || undefined,
      lastName: (args.customer.last_name as string) || undefined,
      ordersCount: existing?.ordersCount ?? 0,
      totalSpent: existing?.totalSpent ?? 0,
      tags:
        typeof args.customer.tags === "string"
          ? (args.customer.tags as string).split(",").map((t) => t.trim()).filter(Boolean)
          : Array.isArray(args.customer.tags)
            ? (args.customer.tags as string[])
            : [],
      shopifyCreatedAt: Date.parse(String(args.customer.created_at || Date.now())),
      shopifyUpdatedAt: Date.parse(String(args.customer.updated_at || Date.now())),
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("shopifyCustomers", doc);
    }

    return null;
  },
});

/**
 * Delete a product and its variants/inventory by Shopify ID
 */
export const deleteProductByShopifyIdInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    shopifyId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.shopifyId))
      .first();
    if (!product) return null;

    // Delete variants and inventory
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();

    for (const vdoc of variants) {
      // Delete inventory rows for this variant
      const invRows = await ctx.db
        .query("shopifyInventory")
        .withIndex("by_variant", (q) => q.eq("variantId", vdoc._id))
        .collect();
      for (const inv of invRows) await ctx.db.delete(inv._id);
      await ctx.db.delete(vdoc._id);
    }

    await ctx.db.delete(product._id);
    return null;
  },
});

/**
 * Delete an order and related child records by Shopify ID
 */
export const deleteOrderByShopifyIdInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    shopifyId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.shopifyId))
      .first();
    if (!order) return null;

    const items = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const it of items) await ctx.db.delete(it._id);

    const txs = await ctx.db
      .query("shopifyTransactions")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const t of txs) await ctx.db.delete(t._id);

    const ref = await ctx.db
      .query("shopifyRefunds")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const r of ref) await ctx.db.delete(r._id);

    const f = await ctx.db
      .query("shopifyFulfillments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const ff of f) await ctx.db.delete(ff._id);

    await ctx.db.delete(order._id);
    return null;
  },
});

// Type for webhook payloads - simplified as we just pass through the data
type WebhookPayload = Record<string, unknown>;

function parseOrderWebhook(payload: WebhookPayload): WebhookPayload {
  // Parse Shopify order webhook payload
  return payload;
}

function parseProductWebhook(payload: WebhookPayload): WebhookPayload {
  // Parse Shopify product webhook payload
  return payload;
}

function parseCustomerWebhook(payload: WebhookPayload): WebhookPayload {
  // Parse Shopify customer webhook payload
  return payload;
}

function parseFulfillmentWebhook(
  payload: WebhookPayload
): Record<string, unknown> {
  // Parse Shopify fulfillment webhook payload
  return {
    organizationId: payload.organizationId,
    shopifyId: String(payload.id),
    shopifyOrderId: String(payload.order_id),
    status: payload.status,
    trackingCompany: payload.tracking_company,
    trackingNumbers: payload.tracking_numbers || [],
    trackingUrls: payload.tracking_urls || [],
    lineItems: payload.line_items || [],
    shopifyCreatedAt: Date.parse(payload.created_at as string),
    shopifyUpdatedAt: payload.updated_at
      ? Date.parse(payload.updated_at as string)
      : undefined,
  };
}

function parseCollectionWebhook(
  payload: WebhookPayload
): Record<string, unknown> {
  // Parse Shopify collection webhook payload
  return {
    organizationId: payload.organizationId,
    shopifyId: String(payload.id),
    title: payload.title,
    handle: payload.handle,
    bodyHtml: payload.body_html,
    sortOrder: payload.sort_order,
    publishedAt: payload.published_at
      ? Date.parse(String(payload.published_at))
      : undefined,
    shopifyCreatedAt: Date.parse(String(payload.created_at)),
    shopifyUpdatedAt: Date.parse(String(payload.updated_at)),
  };
}

export const handleAppUninstallInternal = internalMutation({
  args: {
    shopDomain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // This function ONLY marks the store as inactive
    // The full cleanup is handled by handleAppUninstalled which is called separately
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
      .first();

    if (store) {
      await ctx.db.patch(store._id, {
        isActive: false,
        uninstalledAt: Date.now(),
      });
      
      logger.info("Marked Shopify store as inactive", {
        storeId: store._id,
        shopDomain: args.shopDomain,
        organizationId: store.organizationId,
      });
    } else {
      logger.warn("Store not found for uninstall", {
        shopDomain: args.shopDomain,
      });
    }

    return null;
  },
});

export const updateOrderStatusInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    orderId: v.string(),
    fulfillmentStatus: v.optional(v.string()),
    financialStatus: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.orderId))
      .first();

    if (order) {
      const updates: {
        updatedAt: number;
        fulfillmentStatus?: string;
        financialStatus?: string;
      } = { updatedAt: Date.now() };

      if (args.fulfillmentStatus)
        updates.fulfillmentStatus = args.fulfillmentStatus;
      if (args.financialStatus) updates.financialStatus = args.financialStatus;

      await ctx.db.patch(order._id, updates);
    }

    return null;
  },
});

export const deleteCustomerInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.customerId))
      .first();

    if (customer) {
      await ctx.db.delete(customer._id);
    }

    return null;
  },
});

export const updateCustomerStatusInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customerId: v.string(),
    state: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.customerId))
      .first();

    if (customer) {
      await ctx.db.patch(customer._id, {
        state: args.state,
        shopifyUpdatedAt: Date.now(),
      });
    }

    return null;
  },
});

export const deleteProductInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    productId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.productId))
      .first();

    if (product) {
      await ctx.db.delete(product._id);
    }

    return null;
  },
});

export const updateInventoryLevelInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    inventoryItemId: v.string(),
    locationId: v.string(),
    available: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update inventory levels in product variants
    // Note: This would need to be implemented with proper inventory tracking
    // For now, we'll update the totalInventory field on products
    const _products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    // This is a simplified implementation
    // In production, you'd need to track inventory per variant and location
    // production: avoid noisy inventory logs

    return null;
  },
});

export const createInventoryItemInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    inventoryItemId: v.string(),
    sku: v.optional(v.string()),
    tracked: v.boolean(),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    // Inventory items are typically part of product variants
    // This would update the variant with the new inventory item
    return null;
  },
});

export const updateInventoryItemInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    inventoryItemId: v.string(),
    sku: v.optional(v.string()),
    tracked: v.boolean(),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    // Update inventory item details in product variants
    return null;
  },
});

export const deleteInventoryItemInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    inventoryItemId: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    // Remove inventory item from product variants
    return null;
  },
});

export const storeFulfillmentInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fulfillment: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shopifyFulfillments")
      .withIndex("by_shopify_id", (q) =>
        q.eq("shopifyId", args.fulfillment.shopifyId)
      )
      .first();

    if (!existing) {
      await (ctx.db.insert as any)("shopifyFulfillments", {
        ...args.fulfillment,
        syncedAt: Date.now(),
      });
    }

    return null;
  },
});

export const updateFulfillmentInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fulfillment: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shopifyFulfillments")
      .withIndex("by_shopify_id", (q) =>
        q.eq("shopifyId", args.fulfillment.shopifyId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.fulfillment,
        syncedAt: Date.now(),
      });
    } else {
      await (ctx.db.insert as any)("shopifyFulfillments", {
        ...args.fulfillment,
        syncedAt: Date.now(),
      });
    }

    return null;
  },
});

export const updateShopDetailsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    shopId: v.string(),
    domain: v.string(),
    planName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("isActive", true)
      )
      .first();

    if (store) {
      await ctx.db.patch(store._id, {
        shopDomain: args.domain,
        // Note: planName is not in the schema, would need to add it if required
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

export const storeCollectionInternal = internalMutation({
  args: {
    organizationId: v.string(),
    collection: v.any(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    // production: avoid noisy collection logs

    return null;
  },
});

export const updateCollectionInternal = internalMutation({
  args: {
    organizationId: v.string(),
    collection: v.any(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    // production: avoid noisy collection logs

    return null;
  },
});

export const deleteCollectionInternal = internalMutation({
  args: {
    organizationId: v.string(),
    collectionId: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    // production: avoid noisy collection logs

    return null;
  },
});

/**
 * Webhook handlers namespace
 * These are called by the webhook processor
 */
export const webhooks = {
  /**
   * Handle order webhooks
   */
  handleOrderWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { topic, payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      // Process based on topic
      switch (topic) {
        case "orders/create":
        case "orders/updated":
          await ctx.runMutation(
            internal.integrations.shopify.storeOrdersInternal,
            {
              organizationId,
              orders: [payload],
            }
          );
          break;

        case "orders/cancelled":
          await ctx.runMutation(
            internal.integrations.shopify.updateOrderInternal,
            {
              organizationId,
              order: {
                ...payload,
                cancelledAt: payload.cancelled_at,
                financialStatus: "cancelled",
              },
            }
          );
          break;
      }

      return null;
    },
  }),

  /**
   * Handle product webhooks
   */
  handleProductWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { topic, payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      switch (topic) {
        case "products/create":
        case "products/update":
          await ctx.runMutation(
            internal.integrations.shopify.storeProductsInternal,
            {
              organizationId,
              products: [payload],
            }
          );
          break;

        case "products/delete": {
          // Mark product as deleted
          const product = await ctx.db
            .query("shopifyProducts")
            .withIndex("by_shopify_id", (q) => q.eq("shopifyId", payload.id))
            .first();

          if (product) {
            await ctx.db.patch(product._id, {
              status: "deleted",
              syncedAt: Date.now(),
            });
          }
          break;
        }
      }

      return null;
    },
  }),

  /**
   * Handle customer webhooks
   */
  handleCustomerWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      await ctx.runMutation(
        internal.integrations.shopify.storeCustomersInternal,
        {
          organizationId,
          customers: [payload],
        }
      );

      return null;
    },
  }),

  /**
   * Handle refund webhooks
   */
  handleRefundWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      // Find the order first to get the orderId
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) => q.eq("shopifyId", payload.order_id))
        .first();

      if (!order) {
        throw new Error(`Order not found for refund: ${payload.order_id}`);
      }

      // Store refund in separate table as per schema
      await ctx.db.insert("shopifyRefunds", {
        organizationId,
        orderId: order._id,
        shopifyId: payload.id,
        shopifyOrderId: payload.order_id,
        note: payload.note,
        userId: payload.user_id,
        totalRefunded: parseFloat(payload.amount || "0"),
        refundLineItems:
          payload.refund_line_items?.map(
            (item: {
              line_item_id: string;
              quantity: number;
              subtotal: string;
            }) => ({
              lineItemId: item.line_item_id,
              quantity: item.quantity,
              subtotal: parseFloat(item.subtotal || "0"),
            })
          ) || [],
        shopifyCreatedAt: payload.created_at,
        processedAt: payload.processed_at,
      });

      return null;
    },
  }),

  /**
   * Handle app uninstall
   */
  handleAppUninstall: internalMutation({
    args: {
      shopDomain: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      await ctx.runMutation(
        internal.integrations.shopify.handleAppUninstallInternal,
        {
          shopDomain: args.shopDomain,
        }
      );

      return null;
    },
  }),

  /**
   * Handle customer data request (GDPR compliance)
   */
  handleCustomerDataRequest: mutation({
    args: {
      shopDomain: v.string(),
      customerId: v.string(),
      ordersRequested: v.optional(v.array(v.string())),
    },
    returns: v.object({
      success: v.boolean(),
      customerData: v.any(),
    }),
    handler: async (ctx, args) => {
      try {
        // Find the organization by shop domain
        const store = await ctx.db
          .query("shopifyStores")
          .withIndex("by_shop_domain", (q) =>
            q.eq("shopDomain", args.shopDomain)
          )
          .first();

        if (!store) {
          throw new Error(`Store not found for domain: ${args.shopDomain}`);
        }

        // Get customer data
        const customer = await ctx.db
          .query("shopifyCustomers")
          .withIndex("by_shopify_id_store", (q) =>
            q.eq("shopifyId", args.customerId).eq("storeId", store._id)
          )
          .first();

        // Get customer orders by email if customer exists
        const allOrders = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_store", (q) => q.eq("storeId", store._id))
          .collect();

        const orders = customer?.email
          ? allOrders.filter((o) => o.email === customer.email)
          : [];

        // Compile customer data for GDPR request
        const customerData = {
          customer: customer || null,
          orders: orders,
          requestedAt: Date.now(),
          shopDomain: args.shopDomain,
        };

        // Log the data request for compliance tracking
        await ctx.db.insert("gdprRequests", {
          organizationId: store.organizationId,
          shopDomain: args.shopDomain,
          customerId: args.customerId,
          requestType: "customer_data_request",
          status: "completed",
          requestData: customerData,
          processedAt: Date.now(),
        });

        return {
          success: true,
          customerData,
        };
      } catch (error) {
        logger.error("Customer data request failed", error, {
          customerId: args.customerId,
          shopDomain: args.shopDomain,
        });

        return {
          success: false,
          customerData: null,
        };
      }
    },
  }),

  /**
   * Handle customer redact request (GDPR compliance)
   */
  handleCustomerRedact: mutation({
    args: {
      shopDomain: v.string(),
      customerId: v.string(),
      ordersToRedact: v.optional(v.array(v.string())),
    },
    returns: v.object({
      success: v.boolean(),
      redactedRecords: v.number(),
    }),
    handler: async (ctx, args) => {
      try {
        // Find the organization by shop domain
        const store = await ctx.db
          .query("shopifyStores")
          .withIndex("by_shop_domain", (q) =>
            q.eq("shopDomain", args.shopDomain)
          )
          .first();

        if (!store) {
          throw new Error(`Store not found for domain: ${args.shopDomain}`);
        }

        let redactedRecords = 0;

        // Redact customer data
        const customer = await ctx.db
          .query("shopifyCustomers")
          .withIndex("by_shopify_id_store", (q) =>
            q.eq("shopifyId", args.customerId).eq("storeId", store._id)
          )
          .first();

        if (customer) {
          await ctx.db.patch(customer._id, {
            // Redact personal information
            email: "[REDACTED]",
            firstName: "[REDACTED]",
            lastName: "[REDACTED]",
            phone: "[REDACTED]",
            // Keep business-relevant data for analytics
            totalSpent: customer.totalSpent,
            ordersCount: customer.ordersCount,
          });
          redactedRecords++;
        }

        // Redact customer data from orders but keep business metrics
        const allOrders = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_store", (q) => q.eq("storeId", store._id))
          .collect();

        const orders = customer?.email
          ? allOrders.filter((o) => o.email === customer.email)
          : [];

        for (const order of orders) {
          await ctx.db.patch(order._id, {
            // Redact personal information
            email: "[REDACTED]",
            shippingAddress: {
              // Redact all address fields as per schema
              country: "[REDACTED]",
              province: "[REDACTED]",
              city: "[REDACTED]",
              zip: "[REDACTED]",
            },
            // Keep business-relevant data
            totalPrice: order.totalPrice,
            subtotalPrice: order.subtotalPrice,
            totalTax: order.totalTax,
          });
          redactedRecords++;
        }

        // Log the redaction for compliance tracking
        await ctx.db.insert("gdprRequests", {
          organizationId: store.organizationId,
          shopDomain: args.shopDomain,
          customerId: args.customerId,
          requestType: "customer_redact",
          status: "completed",
          requestData: {
            customerId: args.customerId,
            ordersToRedact: args.ordersToRedact,
            redactedRecords,
          },
          processedAt: Date.now(),
        });

        return {
          success: true,
          redactedRecords,
        };
      } catch (error) {
        logger.error("Customer redaction failed", error, {
          customerId: args.customerId,
          shopDomain: args.shopDomain,
        });

        return {
          success: false,
          redactedRecords: 0,
        };
      }
    },
  }),

  /**
   * Handle shop redact request (GDPR compliance)
   */
  handleShopRedact: mutation({
    args: {
      shopDomain: v.string(),
    },
    returns: v.object({
      success: v.boolean(),
      message: v.string(),
    }),
    handler: async (ctx, args) => {
      try {
        // Find the organization by shop domain
        const store = await ctx.db
          .query("shopifyStores")
          .withIndex("by_shop_domain", (q) =>
            q.eq("shopDomain", args.shopDomain)
          )
          .first();

        if (!store) {
          return {
            success: true,
            message: "Shop data not found - no action needed",
          };
        }

        // Mark store as uninstalled and redacted
        await ctx.db.patch(store._id, {
          isActive: false,
          uninstalledAt: Date.now(),
        });

        // Mark integration session as inactive
        const sessions = await ctx.db
          .query("integrationSessions")
          .withIndex("by_org_and_platform", (q) =>
            q
              .eq("organizationId", store.organizationId as Id<"organizations">)
              .eq("platform", "shopify")
          )
          .collect();

        for (const session of sessions) {
          await ctx.db.patch(session._id, {
            isActive: false,
          });
        }

        // Log the shop redaction
        await ctx.db.insert("gdprRequests", {
          organizationId: store.organizationId,
          shopDomain: args.shopDomain,
          customerId: "shop",
          requestType: "shop_redact",
          status: "completed",
          requestData: {
            shopDomain: args.shopDomain,
            action: "shop_uninstalled_and_redacted",
          },
          processedAt: Date.now(),
        });

        return {
          success: true,
          message: "Shop data marked as redacted successfully",
        };
      } catch (error) {
        logger.error("Shop redaction failed", error, {
          shopDomain: args.shopDomain,
        });

        return {
          success: false,
          message: `Shop redaction failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  }),
};

/**
 * Internal helper to get session by ID
 */
export const getSessionByIdInternal = internalQuery({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shopifySessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

/**
 * Internal helper to create a session
 */
export const createSessionInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    sessionId: v.string(),
    visitorToken: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    referrerSource: v.optional(v.string()),
    referrerDomain: v.optional(v.string()),
    landingPage: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    utmTerm: v.optional(v.string()),
    pageViews: v.number(),
    hasConverted: v.boolean(),
    conversionValue: v.optional(v.number()),
    deviceType: v.optional(v.string()),
    country: v.optional(v.string()),
    region: v.optional(v.string()),
    city: v.optional(v.string()),
    syncedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("shopifySessions", {
      ...args,
      organizationId: args.organizationId as Id<"organizations">,
    });
  },
});

/**
 * Internal helper to update order with session data
 */
export const updateOrderSessionInternal = internalMutation({
  args: {
    orderId: v.string(),
    sessionId: v.string(),
    visitorToken: v.optional(v.string()),
    sessionSource: v.optional(v.string()),
    sessionLandingPage: v.optional(v.string()),
    sessionPageViews: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find the order by Shopify ID
    const order = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.orderId))
      .first();

    if (order) {
      await ctx.db.patch(order._id, {
        sessionId: args.sessionId,
        visitorToken: args.visitorToken,
        sessionSource: args.sessionSource,
        sessionLandingPage: args.sessionLandingPage,
        sessionPageViews: args.sessionPageViews,
      });
    }
  },
});

/**
 * Get orders with attribution fields for a date range
 */
export const getOrdersWithAttribution = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const start = new Date(args.startDate).getTime();
    const end = new Date(args.endDate).getTime() + 24 * 60 * 60 * 1000;

    // Use org+createdAt index when available
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .gte("shopifyCreatedAt", start)
          .lt("shopifyCreatedAt", end)
      )
      .collect();

    // Return only fields used by the consumer to avoid large payloads
    return orders.map((o) => ({
      _id: o._id,
      shopifyCreatedAt: o.shopifyCreatedAt,
      totalPrice: o.totalPrice,
      sourceUrl: o.sourceUrl,
      landingSite: o.landingSite,
      utmSource: o.utmSource,
      utmMedium: o.utmMedium,
      utmCampaign: o.utmCampaign,
      shippingAddress: o.shippingAddress,
    }));
  },
});

/**
 * Internal GDPR handler for customer data request
 */
export const handleGDPRDataRequest = internalMutation({
  args: {
    organizationId: v.string(),
    shopDomain: v.string(),
    customerId: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    ordersRequested: v.array(v.string()),
    dataRequestId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Find the store
      const store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
        .first();

      if (!store) {
        throw new Error(`Store not found for domain: ${args.shopDomain}`);
      }

      // Get customer data
      const customer = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_shopify_id_store", (q) =>
          q.eq("shopifyId", args.customerId).eq("storeId", store._id)
        )
        .first();

      // Get requested orders
      const allOrders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_store", (q) => q.eq("storeId", store._id))
        .collect();

      const orders =
        args.ordersRequested.length > 0
          ? allOrders.filter((o) => args.ordersRequested.includes(o.shopifyId))
          : customer?.email
            ? allOrders.filter((o) => o.email === customer.email)
            : [];

      // Compile customer data
      const customerData = {
        customer: customer || null,
        orders: orders,
        requestedAt: Date.now(),
        shopDomain: args.shopDomain,
        dataRequestId: args.dataRequestId,
      };

      // Log the data request for compliance
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_data_request",
        status: "completed",
        requestData: customerData,
        processedAt: Date.now(),
      });

      logger.info("GDPR customer data request processed", {
        customerId: args.customerId,
        orderCount: orders.length,
      });

      return null;
    } catch (error) {
      logger.error("GDPR customer data request failed", error, {
        customerId: args.customerId,
        shopDomain: args.shopDomain,
      });

      // Log failed request
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_data_request",
        status: "failed",
        requestData: {
          error: error instanceof Error ? error.message : String(error),
        },
        processedAt: Date.now(),
      });

      throw error;
    }
  },
});

/**
 * Internal GDPR handler for customer redact
 */
export const handleGDPRRedact = internalMutation({
  args: {
    organizationId: v.string(),
    shopDomain: v.string(),
    customerId: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    ordersToRedact: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Find the store
      const store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
        .first();

      if (!store) {
        throw new Error(`Store not found for domain: ${args.shopDomain}`);
      }

      let redactedRecords = 0;

      // Delete customer data
      const customer = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_shopify_id_store", (q) =>
          q.eq("shopifyId", args.customerId).eq("storeId", store._id)
        )
        .first();

      if (customer) {
        await ctx.db.delete(customer._id);
        redactedRecords++;
      }

      // Redact personal information from orders
      const allOrders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_store", (q) => q.eq("storeId", store._id))
        .collect();

      const ordersToUpdate =
        args.ordersToRedact.length > 0
          ? allOrders.filter((o) => args.ordersToRedact.includes(o.shopifyId))
          : customer?.email
            ? allOrders.filter((o) => o.email === customer.email)
            : [];

      for (const order of ordersToUpdate) {
        // Redact personal information
        await ctx.db.patch(order._id, {
          email: "REDACTED",
          phone: "REDACTED",
          // Note: We're not redacting address fields as they're not in the schema
          // In a production app, you would include address redaction if those fields exist
        });
        redactedRecords++;
      }

      // Log the redact request for compliance
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_redact",
        status: "completed",
        requestData: { redactedRecords, ordersRedacted: ordersToUpdate.length },
        processedAt: Date.now(),
      });

      logger.info("GDPR customer redact completed", {
        customerId: args.customerId,
        redactedRecords,
      });

      return null;
    } catch (error) {
      logger.error("GDPR customer redact failed", error, {
        customerId: args.customerId,
        shopDomain: args.shopDomain,
      });

      // Log failed request
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_redact",
        status: "failed",
        requestData: {
          error: error instanceof Error ? error.message : String(error),
        },
        processedAt: Date.now(),
      });

      throw error;
    }
  },
});

/**
 * Internal GDPR handler for shop redact
 */
export const handleGDPRShopRedact = internalMutation({
  args: {
    organizationId: v.string(),
    shopId: v.string(),
    shopDomain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      logger.info(
        "GDPR shop redact requested - performing complete data reset",
        {
          organizationId: args.organizationId,
          shopDomain: args.shopDomain,
        }
      );

      // Call the comprehensive app uninstall handler for complete data reset
      // This will delete all integration data and reset user state
      // We'll call the internal mutation directly
      await ctx.runMutation(
        internal.integrations.shopify.handleAppUninstalled,
        {
          organizationId: args.organizationId,
          shopDomain: args.shopDomain,
        }
      );

      // Log the GDPR shop redact for compliance
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: "shop", // Special identifier for shop redaction
        requestType: "shop_redact",
        status: "completed",
        requestData: {
          message: "Complete data reset performed via app uninstall handler",
          timestamp: Date.now(),
        },
        processedAt: Date.now(),
      });

      logger.info("GDPR shop redact completed - all data reset", {
        shopDomain: args.shopDomain,
      });

      return null;
    } catch (error) {
      logger.error("GDPR shop redact failed", error, {
        shopDomain: args.shopDomain,
      });

      // Log failed request
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: "shop",
        requestType: "shop_redact",
        status: "failed",
        requestData: {
          error: error instanceof Error ? error.message : String(error),
        },
        processedAt: Date.now(),
      });

      throw error;
    }
  },
});

/**
 * Handle app uninstallation - Complete data reset except billing
 * This deletes ALL integration data and resets user to fresh state
 */
export const handleAppUninstalled = internalMutation({
  args: {
    organizationId: v.string(),
    shopDomain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      logger.info("Processing app uninstall", {
        organizationId: args.organizationId,
        shopDomain: args.shopDomain,
      });

      // STEP 1: IMMEDIATELY RESET USER STATE TO NEW USER
      // This ensures users are marked as new even if deletion fails
      logger.info("Resetting user state to new user FIRST", {
        organizationId: args.organizationId,
      });

      const users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const user of users) {
        // Reset onboarding record - ensure all integrations are marked as disconnected
        const onboarding = await ctx.db
          .query("onboarding")
          .withIndex("by_user_organization", (q) =>
            q
              .eq("userId", user._id)
              .eq("organizationId", user.organizationId as Id<"organizations">)
          )
          .first();

        if (onboarding) {
          // Complete reset of onboarding state
          await ctx.db.patch(onboarding._id, {
            // Reset all connection flags
            hasShopifyConnection: false,
            hasShopifySubscription: false,
            hasMetaConnection: false,
            hasGoogleConnection: false,
            
            // Reset sync and setup flags
            isInitialSyncComplete: false,
            isProductCostSetup: false,
            isExtraCostSetup: false,
            
            // Reset completion status
            isCompleted: false,
            onboardingStep: 1,
            
            // Clear all onboarding data
            onboardingData: {
              completedSteps: [],
              setupDate: new Date().toISOString(),
            },
            
            updatedAt: Date.now(),
          });
        } else {
          // Create a fresh onboarding record if it doesn't exist
          await ctx.db.insert("onboarding", {
            userId: user._id,
            organizationId: user.organizationId as Id<"organizations">,
            hasShopifyConnection: false,
            hasShopifySubscription: false,
            hasMetaConnection: false,
            hasGoogleConnection: false,
            isInitialSyncComplete: false,
            isProductCostSetup: false,
            isExtraCostSetup: false,
            isCompleted: false,
            onboardingStep: 1,
            onboardingData: {
              completedSteps: [],
              setupDate: new Date().toISOString(),
            },
            updatedAt: Date.now(),
          });
        }

        // Reset user state
        await ctx.db.patch(user._id, {
          // Reset onboarding flag
          isOnboarded: false,

          // Set app deleted timestamp
          appDeletedAt: Date.now(),

          // Update timestamp
          updatedAt: Date.now(),
        });
      }

      // STEP 2: RESET ORGANIZATION STATE
      const orgId = users[0]?.organizationId;
      if (orgId) {
        const organization = await ctx.db.get(orgId);
        if (organization) {
          await ctx.db.patch(organization._id, {
            // Reset organization trial flags when app is uninstalled
            isTrialActive: false,
            hasTrialExpired: false,
            isPremium: false,

            // Update timestamp
            updatedAt: Date.now(),
          });

          // Delete existing billing record to ensure reinstall goes through billing step
          const billingRecord = await ctx.db
            .query("billing")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organization._id)
            )
            .first();

          if (billingRecord) {
            await ctx.db.delete(billingRecord._id);
          }
        }
      }

      logger.info("User and organization state reset completed", {
        organizationId: args.organizationId,
        usersReset: users.length,
      });

      // STEP 3: NOW PROCEED WITH DATA DELETION
      const deletedCounts = {
        // Shopify data
        shopifyStores: 0,
        shopifyProducts: 0,
        shopifyProductVariants: 0,
        shopifyOrders: 0,
        shopifyOrderItems: 0,
        shopifyCustomers: 0,
        shopifyTransactions: 0,
        shopifyRefunds: 0,
        shopifyFulfillments: 0,
        shopifyInventory: 0,
        shopifySessions: 0,
        // Meta data
        metaAdAccounts: 0,
        metaInsights: 0,
        // Analytics data
        analytics: 0,
        // Cost data
        costs: 0,
        // Sync data
        syncData: 0,
        // Integration data
        integrationSessions: 0,
        // Dashboards
        dashboards: 0,
        // Team data
        invites: 0,
        organizationSeats: 0,
        notifications: 0,
      };

      // Delete all Shopify data
      // Find and delete all Shopify stores
      const stores = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const store of stores) {
        // Delete products for this store
        const products = await ctx.db
          .query("shopifyProducts")
          .withIndex("by_store", (q) => q.eq("storeId", store._id))
          .collect();

        for (const product of products) {
          await ctx.db.delete(product._id);
          deletedCounts.shopifyProducts++;
        }

        // Delete orders for this store
        const orders = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_store", (q) => q.eq("storeId", store._id))
          .collect();

        for (const order of orders) {
          await ctx.db.delete(order._id);
          deletedCounts.shopifyOrders++;
        }

        // Delete customers for this store
        const customers = await ctx.db
          .query("shopifyCustomers")
          .withIndex("by_store", (q) => q.eq("storeId", store._id))
          .collect();

        for (const customer of customers) {
          await ctx.db.delete(customer._id);
          deletedCounts.shopifyCustomers++;
        }

        // Delete the store itself
        await ctx.db.delete(store._id);
        deletedCounts.shopifyStores++;
      }

      // Delete product variants
      const variants = await ctx.db
        .query("shopifyProductVariants")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const variant of variants) {
        await ctx.db.delete(variant._id);
        deletedCounts.shopifyProductVariants++;
      }

      // Delete order items
      const orderItems = await ctx.db
        .query("shopifyOrderItems")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const item of orderItems) {
        await ctx.db.delete(item._id);
        deletedCounts.shopifyOrderItems++;
      }

      // Delete transactions
      const transactions = await ctx.db
        .query("shopifyTransactions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const transaction of transactions) {
        await ctx.db.delete(transaction._id);
        deletedCounts.shopifyTransactions++;
      }

      // Delete refunds
      const refunds = await ctx.db
        .query("shopifyRefunds")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const refund of refunds) {
        await ctx.db.delete(refund._id);
        deletedCounts.shopifyRefunds++;
      }

      // Fulfillments, inventory, sessions trimmed in schema

      // 2. Delete all Meta data
      const metaAccounts = await ctx.db
        .query("metaAdAccounts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const account of metaAccounts) {
        await ctx.db.delete(account._id);
        deletedCounts.metaAdAccounts++;
      }

      const metaInsights = await ctx.db
        .query("metaInsights")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const insight of metaInsights) {
        await ctx.db.delete(insight._id);
        deletedCounts.metaInsights++;
      }

      // 5. Delete all analytics data
      const analyticsTables = [
        "metricsDaily",
        "metricsWeekly",
        "metricsMonthly",
        "productMetrics",
        "customerMetrics",
        "realtimeMetrics",
      ];

      for (const tableName of analyticsTables) {
        // Use relaxed typing here because we're iterating dynamic tables that all share a
        // common "by_organization" index, but TS cannot prove that across the union.
        const records = await (ctx.db.query as any)(tableName as any)
          .withIndex("by_organization" as any, (q: any) =>
            q.eq("organizationId", args.organizationId as Id<"organizations">)
          )
          .collect();

        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCounts.analytics++;
        }
      }

      // 6. Delete all cost data
      const costs = await ctx.db
        .query("costs")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const cost of costs) {
        await ctx.db.delete(cost._id);
        deletedCounts.costs++;
      }

      const costCategories = await ctx.db
        .query("costCategories")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const category of costCategories) {
        await ctx.db.delete(category._id);
      }

      // Remove product-level cost components
      const productComponents = await ctx.db
        .query("productCostComponents")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();
      for (const row of productComponents) {
        await ctx.db.delete(row._id);
      }

      // historicalCostDefaults removed (legacy)

      // Sync orchestration tables trimmed in schema

      // Rate limits trimmed in schema

      // 7. Delete ALL integration sessions (Shopify, Meta, Google)
      // This ensures complete disconnection from all platforms
      const integrationSessions = await ctx.db
        .query("integrationSessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const session of integrationSessions) {
        // Log which platform sessions are being deleted for debugging
        logger.info("Deleting integration session", {
          platform: session.platform,
          accountId: session.accountId,
          organizationId: args.organizationId,
        });
        
        await ctx.db.delete(session._id);
        deletedCounts.integrationSessions++;
      }

      // 8. Delete sync sessions
      const syncSessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const session of syncSessions) {
        await ctx.db.delete(session._id);
      }

      // 9. Delete dashboards (except default)
      const dashboards = await ctx.db
        .query("dashboards")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const dashboard of dashboards) {
        await ctx.db.delete(dashboard._id);
        deletedCounts.dashboards++;
      }

      // Metric widgets and preferences trimmed in schema

      // 11. Delete team invitations
      const invites = await ctx.db
        .query("invites")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const invite of invites) {
        await ctx.db.delete(invite._id);
        deletedCounts.invites++;
      }

      // Seats moved to memberships; nothing to delete here

      // 13. Delete organization notifications
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      for (const notification of notifications) {
        await ctx.db.delete(notification._id);
        deletedCounts.notifications++;
      }

      // 14. Create fresh default dashboard
      // Organization state was already reset at the beginning
      if (orgId) {
        const organization = await ctx.db.get(orgId);
        
        if (organization) {
          // Create a fresh default dashboard (align with web defaults)
          const owner = users.find((u) => u._id === organization.ownerId);

          if (owner) {
            await ctx.db.insert("dashboards", {
              organizationId: organization._id,
              name: "Main Dashboard",
              type: "main",
              isDefault: true,
              visibility: "private",
              createdBy: owner._id,
              updatedAt: Date.now(),
              config: {
                kpis: [
                  // Default KPIs - ordered for new users
                  "netProfit",
                  "revenue",
                  "netProfitMargin",
                  "orders",
                  "avgOrderValue",
                  "blendedRoas", // MER
                  "totalAdSpend",
                  "shopifyConversionRate",
                  "repeatCustomerRate",
                  "moMRevenueGrowth",
                ],
                widgets: [
                  // Essential widgets for new users
                  "adSpendSummary",
                  "customerSummary",
                  "orderSummary",
                ],
              },
            });
          }
        }
      }

      // Audit logs trimmed in schema

      logger.info(
        "App uninstall completed - users reset FIRST, then data deleted",
        {
          organizationId: args.organizationId as Id<"organizations">,
          shopDomain: args.shopDomain,
          deletedCounts,
          usersReset: users.length,
          executionOrder: "1. Reset users/org, 2. Delete data",
          integrationsCleared: ["shopify", "meta"],
        }
      );

      return null;
    } catch (error) {
      logger.error("App uninstall handler failed", error, {
        organizationId: args.organizationId,
        shopDomain: args.shopDomain,
      });

      // Try to get a user for audit log
      const users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId as Id<"organizations">)
        )
        .collect();

      // Audit logs trimmed in schema

      throw error;
    }
  },
});
