
import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { createIntegration, type SyncResult } from "../core/integrationBase";
import { initializeShopifyClient } from "./client";
import { toStringArray } from "../utils/shopify";
import { logger } from "./shared";
import { toOptionalString } from "./processingUtils";

export const shopify: any = createIntegration({
  name: "shopify",
  displayName: "Shopify",
  version: "1.0.0",
  icon: "mdi:shopify",

  sync: {
    initial: async (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        dateRange?: { daysBack?: number };
        credentials?: Record<string, unknown>;
      },
    ): Promise<SyncResult> => {
      const daysBack = args.dateRange?.daysBack ?? 60;
      const response = (await ctx.runAction(
        internal.shopify.sync.initial,
        {
          organizationId: args.organizationId as Id<"organizations">,
          dateRange: { daysBack },
        },
      )) as {
        success: boolean;
        recordsProcessed: number;
        dataChanged: boolean;
        errors?: string[];
        batchStats?: {
          batchesScheduled?: number;
          ordersQueued?: number;
        };
      };

      return {
        success: response.success,
        recordsProcessed: response.recordsProcessed,
        dataChanged: response.dataChanged,
        errors: response.errors,
        metadata: {
          batchesScheduled: response.batchStats?.batchesScheduled ?? 0,
          ordersQueued: response.batchStats?.ordersQueued ?? 0,
        },
      } satisfies SyncResult;
    },

    incremental: async (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        since?: string;
        credentials?: Record<string, unknown>;
      },
    ): Promise<SyncResult> => {
      const sinceMs = args.since ? Date.parse(args.since) : undefined;
      const response = (await ctx.runAction(
        internal.shopify.sync.incremental,
        {
          organizationId: args.organizationId as Id<"organizations">,
          since: Number.isFinite(sinceMs) ? sinceMs : undefined,
        },
      )) as {
        success: boolean;
        recordsProcessed: number;
        dataChanged: boolean;
        errors?: string[];
      };

      return {
        success: response.success,
        recordsProcessed: response.recordsProcessed,
        dataChanged: response.dataChanged,
        errors: response.success
          ? response.errors
          : response.errors ?? ["Incremental sync failed"],
      } satisfies SyncResult;
    },

    validate: async (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        credentials?: Record<string, unknown>;
      },
    ): Promise<boolean> => {
      try {
        const store = await ctx.runQuery(
          internal.shopify.internalQueries.getActiveStoreInternal,
          {
            organizationId: args.organizationId,
          },
        );

        if (!store) {
          return false;
        }

        const client = await initializeShopifyClient(store);
        const shopInfo = await client.getShopInfo();
        const isValid = Boolean(shopInfo?.data?.shop);

        logger.info("Shopify connection validation completed", {
          organizationId: args.organizationId,
          valid: isValid,
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

      await ctx.runMutation(internal.shopify.orderMutations.storeOrdersInternal, {
        organizationId: payload.organizationId as Id<"organizations">,
        orders: [order as unknown as any],
      });
    },

    /**
     * Product created webhook
     */
    "products/create": async (ctx: any, payload: any) => {
      const product = parseProductWebhook(payload);

      await ctx.runMutation(
        internal.shopify.productMutations.storeProductsInternal,
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
        internal.shopify.productMutations.updateProductInternal,
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
        internal.shopify.lifecycle.handleAppUninstallInternal,
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
        internal.shopify.orderMutations.updateOrderStatusInternal,
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
        internal.shopify.orderMutations.updateOrderStatusInternal,
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
        internal.shopify.orderMutations.updateOrderStatusInternal,
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
        internal.shopify.orderMutations.updateOrderStatusInternal,
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
        internal.shopify.customerMutations.deleteCustomerInternal,
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
        internal.shopify.customerMutations.updateCustomerStatusInternal,
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
        internal.shopify.customerMutations.updateCustomerStatusInternal,
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
        internal.shopify.productMutations.deleteProductInternal,
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
        internal.shopify.inventoryMutations.updateInventoryLevelInternal,
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
        internal.shopify.inventoryMutations.createInventoryItemInternal,
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
        internal.shopify.inventoryMutations.updateInventoryItemInternal,
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
        internal.shopify.inventoryMutations.deleteInventoryItemInternal,
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
        internal.shopify.orderMutations.storeFulfillmentInternal,
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
        internal.shopify.shopMutations.updateShopDetailsInternal,
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
        internal.shopify.collectionMutations.storeCollectionInternal,
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
        internal.shopify.collectionMutations.updateCollectionInternal,
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
        internal.shopify.collectionMutations.deleteCollectionInternal,
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


type WebhookPayload = Record<string, unknown>;

function parseOrderWebhook(payload: WebhookPayload): WebhookPayload {
  return payload;
}

function parseProductWebhook(payload: WebhookPayload): WebhookPayload {
  return payload;
}

function parseCustomerWebhook(payload: WebhookPayload): WebhookPayload {
  return payload;
}

function parseFulfillmentWebhook(payload: WebhookPayload): Record<string, unknown> {
  const trackingNumbers =
    payload.tracking_numbers == null
      ? []
      : toStringArray(payload.tracking_numbers);
  const trackingUrls =
    payload.tracking_urls == null ? [] : toStringArray(payload.tracking_urls);
  const shipmentStatus = toOptionalString(payload.shipment_status);
  const trackingCompany = toOptionalString(payload.tracking_company);
  const locationId = toOptionalString(payload.location_id);
  const service = toOptionalString(payload.service);

  return {
    organizationId: payload.organizationId,
    shopifyId: String(payload.id),
    shopifyOrderId: String(payload.order_id),
    status: payload.status,
    shipmentStatus,
    trackingCompany,
    ...(trackingNumbers !== undefined ? { trackingNumbers } : {}),
    ...(trackingUrls !== undefined ? { trackingUrls } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(service !== undefined ? { service } : {}),
    lineItems: payload.line_items || [],
    shopifyCreatedAt: payload.created_at
      ? Date.parse(String(payload.created_at))
      : Date.now(),
    shopifyUpdatedAt: payload.updated_at
      ? Date.parse(String(payload.updated_at))
      : undefined,
  };
}

function parseCollectionWebhook(payload: WebhookPayload): Record<string, unknown> {
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
    shopifyCreatedAt: payload.created_at
      ? Date.parse(String(payload.created_at))
      : Date.now(),
    shopifyUpdatedAt: payload.updated_at
      ? Date.parse(String(payload.updated_at))
      : Date.now(),
  };
}
