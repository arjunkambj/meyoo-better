import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { DEFAULT_DASHBOARD_CONFIG } from "@repo/types";
import { ShopifyGraphQLClient } from "../../libs/shopify/ShopifyGraphQLClient";
import { createSimpleLogger } from "../../libs/logging/simple";
import { roundMoney } from "../../libs/utils/money";
import { internal } from "../_generated/api";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { createIntegration, type SyncResult } from "./_base";
import { normalizeShopDomain } from "../utils/shop";
import { msToDateString, type MsToDateOptions } from "../utils/date";
import { toStringArray, toMs } from "../utils/shopify";
import { createNewUserData } from "../authHelpers";

const logger = createSimpleLogger("Shopify");

const BULK_OPS = {
  INSERT_SIZE: 100,
  UPDATE_SIZE: 50,
  LOOKUP_SIZE: 200,
} as const;

const ORDER_WEBHOOK_RETRY_DELAY_MS = 5_000;
const ORDER_WEBHOOK_MAX_RETRIES = 5;
const ANALYTICS_REBUILD_DEBOUNCE_MS = 10_000;

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (values.length === 0) return [];

  const size = Math.max(1, chunkSize);
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

type ContextWithDb = {
  db?: QueryCtx["db"] | MutationCtx["db"];
  runQuery?: MutationCtx["runQuery"];
};

function toUniqueStringArray(ids: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const value of ids) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    seen.add(trimmed);
  }
  return Array.from(seen);
}

async function fetchExistingProductsByShopifyIds(
  ctx: MutationCtx,
  storeId: Id<"shopifyStores">,
  ids: Iterable<string>,
): Promise<Map<string, Doc<"shopifyProducts">>> {
  const result = new Map<string, Doc<"shopifyProducts">>();
  const targets = toUniqueStringArray(ids);

  if (targets.length === 0) {
    return result;
  }

  for (const batch of chunkArray(targets, BULK_OPS.LOOKUP_SIZE)) {
    const matches = await Promise.all(
      batch.map((shopifyId) =>
        ctx.db
          .query("shopifyProducts")
          .withIndex("by_shopify_id_store", (q) =>
            q.eq("shopifyId", shopifyId).eq("storeId", storeId),
          )
          .first(),
      ),
    );

    matches.forEach((doc, index) => {
      const shopifyId = batch[index]!;
      if (doc) {
        result.set(shopifyId, doc);
      }
    });
  }

  return result;
}

async function fetchExistingVariantsByShopifyIds(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  ids: Iterable<string>,
): Promise<Map<string, Doc<"shopifyProductVariants">>> {
  const result = new Map<string, Doc<"shopifyProductVariants">>();
  const targets = toUniqueStringArray(ids);

  if (targets.length === 0) {
    return result;
  }

  for (const batch of chunkArray(targets, BULK_OPS.LOOKUP_SIZE)) {
    const matches = await Promise.all(
      batch.map((shopifyId) =>
        ctx.db
          .query("shopifyProductVariants")
          .withIndex("by_organization_shopify_id", (q) =>
            q.eq("organizationId", organizationId).eq("shopifyId", shopifyId),
          )
          .first(),
      ),
    );

    matches.forEach((doc, index) => {
      const shopifyId = batch[index]!;
      if (doc) {
        result.set(shopifyId, doc);
      }
    });
  }

  return result;
}

export async function hasCompletedInitialShopifySync(
  ctx: ContextWithDb,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  if (ctx?.db?.query) {
    const onboarding = await (ctx.db.query("onboarding") as any)
      .withIndex("by_organization", (q: any) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    if (!onboarding) {
      return true;
    }

    return Boolean(onboarding.isInitialSyncComplete);
  }

  if (typeof ctx?.runQuery === "function") {
    const onboardingRecords = (await ctx.runQuery(
      internal.webhooks.processor.getOnboardingByOrganization as any,
      { organizationId },
    )) as unknown;

    const onboarding = Array.isArray(onboardingRecords)
      ? onboardingRecords[0]
      : onboardingRecords;

    if (!onboarding) {
      return true;
    }

    return Boolean((onboarding as Record<string, unknown>).isInitialSyncComplete);
  }

  logger.warn("Unable to determine initial sync status - missing db/runQuery", {
    organizationId,
  });
  return true;
}

export const getInitialSyncStatusInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await hasCompletedInitialShopifySync(
      ctx,
      args.organizationId as Id<"organizations">,
    );
  },
});

export const getOrderByShopifyIdInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    shopifyId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.shopifyId))
      .first();

    if (!order) return null;
    if (order.organizationId !== args.organizationId) return null;
    return order;
  },
});

export const getCustomerByShopifyIdInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    shopifyId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id_store", (q) =>
        q.eq("shopifyId", args.shopifyId).eq("storeId", args.storeId),
      )
      .first();

    if (!customer) return null;
    if (customer.organizationId !== args.organizationId) return null;
    return customer;
  },
});

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (typeof value === "number") return String(value);

  return undefined;
};

const ORDER_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyOrders">> = [
  "orderNumber",
  "name",
  "customerId",
  "email",
  "phone",
  "shopifyCreatedAt",
  "updatedAt",
  "processedAt",
  "closedAt",
  "cancelledAt",
  "financialStatus",
  "fulfillmentStatus",
  "totalPrice",
  "subtotalPrice",
  "totalDiscounts",
  "totalTip",
  "currency",
  "totalItems",
  "totalQuantity",
  "totalWeight",
  "tags",
  "note",
  "shippingAddress",
];

const LINE_ITEM_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyOrderItems">> = [
  "shopifyProductId",
  "shopifyVariantId",
  "productId",
  "variantId",
  "title",
  "variantTitle",
  "sku",
  "quantity",
  "price",
  "totalDiscount",
  "fulfillableQuantity",
  "fulfillmentStatus",
];

const TRANSACTION_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyTransactions">> = [
  "orderId",
  "shopifyOrderId",
  "kind",
  "status",
  "gateway",
  "amount",
  "fee",
  "paymentId",
  "shopifyCreatedAt",
  "processedAt",
];

const REFUND_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyRefunds">> = [
  "orderId",
  "shopifyOrderId",
  "note",
  "userId",
  "totalRefunded",
  "refundLineItems",
  "shopifyCreatedAt",
  "processedAt",
];

const CUSTOMER_WEBHOOK_COMPARE_FIELDS: ReadonlyArray<
  keyof Doc<"shopifyCustomers">
> = ["email", "phone", "firstName", "lastName"];

const valuesMatch = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }

  if (a && typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b ?? null);
  }

  if (b && typeof b === "object") {
    return JSON.stringify(a ?? null) === JSON.stringify(b);
  }

  return a === b;
};

const hasOrderMeaningfulChange = (
  existing: Doc<"shopifyOrders">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of ORDER_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

const hasOrderItemMeaningfulChange = (
  existing: Doc<"shopifyOrderItems">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of LINE_ITEM_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

const hasTransactionMeaningfulChange = (
  existing: Doc<"shopifyTransactions">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of TRANSACTION_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

const hasRefundMeaningfulChange = (
  existing: Doc<"shopifyRefunds">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of REFUND_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

const hasCustomerWebhookChange = (
  existing: Doc<"shopifyCustomers">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of CUSTOMER_WEBHOOK_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

const DELETE_BATCH_SIZE = 200;

const ORGANIZATION_TABLES = [
  "shopifyProductVariants",
  "shopifyOrderItems",
  "shopifyTransactions",
  "shopifyRefunds",
  "shopifyFulfillments",
  "shopifyInventory",
  "shopifyInventoryTotals",
  "metaAdAccounts",
  "metaInsights",
  "shopifyAnalytics",
  "globalCosts",
  "manualReturnRates",
  "variantCosts",
  "dailyMetrics",
  "integrationSessions",
  "syncSessions",
  "syncProfiles",
  "integrationStatus",
  "usage",
  "invoices",
  "integrationRequests",
  "gdprRequests",
  "invites",
  "notifications",
] as const;

type OrganizationDataTable = (typeof ORGANIZATION_TABLES)[number];

const STORE_TABLES = [
  "shopifyProducts",
  "shopifyOrders",
  "shopifyCustomers",
  "shopifySessions",
] as const;

type StoreDataTable = (typeof STORE_TABLES)[number];

const organizationTableValidator = v.union(
  v.literal("shopifyProductVariants"),
  v.literal("shopifyOrderItems"),
  v.literal("shopifyTransactions"),
  v.literal("shopifyRefunds"),
  v.literal("shopifyFulfillments"),
  v.literal("shopifyInventory"),
  v.literal("shopifyInventoryTotals"),
  v.literal("metaAdAccounts"),
  v.literal("metaInsights"),
  v.literal("shopifyAnalytics"),
  v.literal("globalCosts"),
  v.literal("manualReturnRates"),
  v.literal("variantCosts"),
  v.literal("dailyMetrics"),
  v.literal("integrationSessions"),
  v.literal("syncSessions"),
  v.literal("syncProfiles"),
  v.literal("integrationStatus"),
  v.literal("usage"),
  v.literal("invoices"),
  v.literal("integrationRequests"),
  v.literal("gdprRequests"),
  v.literal("invites"),
  v.literal("notifications"),
);

const ORGANIZATION_TABLE_INDEXES: Record<OrganizationDataTable, string> = {
  shopifyProductVariants: "by_organization",
  shopifyOrderItems: "by_organization",
  shopifyTransactions: "by_organization",
  shopifyRefunds: "by_organization",
  shopifyFulfillments: "by_organization",
  shopifyInventory: "by_organization",
  shopifyInventoryTotals: "by_organization",
  metaAdAccounts: "by_organization",
  metaInsights: "by_organization",
  shopifyAnalytics: "by_organization",
  globalCosts: "by_organization",
  manualReturnRates: "by_organization",
  variantCosts: "by_organization",
  dailyMetrics: "by_organization",
  integrationSessions: "by_organization",
  syncSessions: "by_organization",
  syncProfiles: "by_organization",
  integrationStatus: "by_organization",
  usage: "by_org_month",
  invoices: "by_organization",
  integrationRequests: "by_organization",
  gdprRequests: "by_organization",
  invites: "by_organization",
  notifications: "by_organization",
};

const storeTableValidator = v.union(
  v.literal("shopifyProducts"),
  v.literal("shopifyOrders"),
  v.literal("shopifyCustomers"),
  v.literal("shopifySessions"),
);

type BatchDeleteResult = {
  deleted: number;
  hasMore: boolean;
};

const normalizeBatchSize = (size?: number): number => {
  if (typeof size !== "number" || Number.isNaN(size) || size <= 0) {
    return DELETE_BATCH_SIZE;
  }

  return Math.min(Math.max(1, Math.floor(size)), 500);
};

const scheduleOrganizationBatch = async (
  ctx: any,
  args: {
    table: OrganizationDataTable;
    organizationId: Id<"organizations">;
    cursor?: string | null;
    batchSize: number;
  },
): Promise<void> => {
  await ctx.scheduler.runAfter(
    0,
    internal.integrations.shopify.deleteOrganizationDataBatch,
    {
      table: args.table,
      organizationId: args.organizationId,
      cursor: args.cursor ?? undefined,
      batchSize: args.batchSize,
    },
  );
};

const scheduleStoreBatch = async (
  ctx: any,
  args: {
    table: StoreDataTable;
    storeId: Id<"shopifyStores">;
    cursor?: string | null;
    batchSize: number;
  },
): Promise<void> => {
  await ctx.scheduler.runAfter(
    0,
    internal.integrations.shopify.deleteStoreDataBatch,
    {
      table: args.table,
      storeId: args.storeId,
      cursor: args.cursor ?? undefined,
      batchSize: args.batchSize,
    },
  );
};

export const deleteOrganizationDataBatch = internalMutation({
  args: {
    table: organizationTableValidator,
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args): Promise<BatchDeleteResult> => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const table = args.table as OrganizationDataTable;

    const indexName =
      ORGANIZATION_TABLE_INDEXES[table] ?? ("by_organization" as const);

    const query = (ctx.db.query(table) as any).withIndex(
      indexName as any,
      (q: any) => q.eq("organizationId", args.organizationId),
    );

    const page = await query.paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    });

    for (const record of page.page) {
      await ctx.db.delete(record._id);
    }

    if (!page.isDone) {
      await scheduleOrganizationBatch(ctx, {
        table,
        organizationId: args.organizationId,
        cursor: page.continueCursor,
        batchSize,
      });
    }

    return {
      deleted: page.page.length,
      hasMore: !page.isDone,
    };
  },
});

export const deleteStoreDataBatch = internalMutation({
  args: {
    table: storeTableValidator,
    storeId: v.id("shopifyStores"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args): Promise<BatchDeleteResult> => {
    const batchSize = normalizeBatchSize(args.batchSize);
    const table = args.table as StoreDataTable;

    const query = (ctx.db.query(table) as any).withIndex(
      "by_store" as any,
      (q: any) => q.eq("storeId", args.storeId),
    );

    const page = await query.paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    });

    for (const record of page.page) {
      await ctx.db.delete(record._id);
    }

    if (!page.isDone) {
      await scheduleStoreBatch(ctx, {
        table,
        storeId: args.storeId,
        cursor: page.continueCursor,
        batchSize,
      });
    }

    return {
      deleted: page.page.length,
      hasMore: !page.isDone,
    };
  },
});

export const deleteDashboardsBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    ownerId: v.optional(v.id("users")),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args): Promise<BatchDeleteResult> => {
    const batchSize = normalizeBatchSize(args.batchSize);

    const query = ctx.db
      .query("dashboards")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    const page = await query.paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    });

    for (const dashboard of page.page) {
      await ctx.db.delete(dashboard._id);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.shopify.deleteDashboardsBatch,
        {
          organizationId: args.organizationId,
          ownerId: args.ownerId,
          cursor: page.continueCursor,
          batchSize,
        },
      );
    } else if (args.ownerId) {
      // Recreate the default dashboard once the cleanup is complete
      const existingDefault = await ctx.db
        .query("dashboards")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .first();

      if (!existingDefault) {
        await ctx.db.insert("dashboards", {
          organizationId: args.organizationId,
          name: "Main Dashboard",
          type: "main",
          isDefault: true,
          visibility: "private",
          createdBy: args.ownerId,
          updatedAt: Date.now(),
          config: {
            kpis: [...DEFAULT_DASHBOARD_CONFIG.kpis],
            widgets: [...DEFAULT_DASHBOARD_CONFIG.widgets],
          },
        });
      }
    }

    return {
      deleted: page.page.length,
      hasMore: !page.isDone,
    };
  },
});

export const deleteShopifyStoreIfEmpty = internalMutation({
  args: {
    storeId: v.id("shopifyStores"),
    organizationId: v.id("organizations"),
    attempt: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.boolean(),
    rescheduled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 0;

    const hasOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .take(1);

    const hasProducts = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .take(1);

    const hasCustomers = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .take(1);

    const hasSessions = await ctx.db
      .query("shopifySessions")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .take(1);

    const remaining =
      hasOrders.length > 0 ||
      hasProducts.length > 0 ||
      hasCustomers.length > 0 ||
      hasSessions.length > 0;

    if (remaining) {
      if (attempt >= 5) {
        logger.warn("Store cleanup deferred after max attempts", {
          storeId: args.storeId,
          organizationId: args.organizationId,
        });

        return { deleted: false, rescheduled: false };
      }

      const delayMs = Math.min(60_000, 2 ** attempt * 1_000);

      await ctx.scheduler.runAfter(
        delayMs,
        internal.integrations.shopify.deleteShopifyStoreIfEmpty,
        {
          storeId: args.storeId,
          organizationId: args.organizationId,
          attempt: attempt + 1,
        },
      );

      return { deleted: false, rescheduled: true };
    }

    await ctx.db.delete(args.storeId);

    logger.info("Deleted Shopify store after dependent data removal", {
      storeId: args.storeId,
      organizationId: args.organizationId,
    });

    return { deleted: true, rescheduled: false };
  },
});

/**
 * Shopify Integration
 * Handles real-time webhooks and data syncing
 */
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
        internal.integrations.shopifySync.initial,
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
        internal.integrations.shopifySync.incremental,
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
          internal.integrations.shopify.getActiveStoreInternal,
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

      await ctx.runMutation(internal.integrations.shopify.storeOrdersInternal, {
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

export const updateStoreLastSyncInternal = internalMutation({
  args: {
    storeId: v.id("shopifyStores"),
    timestamp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);

    if (!store) {
      throw new Error(`Shopify store not found: ${args.storeId}`);
    }

    await ctx.db.patch(args.storeId, {
      lastSyncAt: args.timestamp,
      updatedAt: Date.now(),
    });

    return null;
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

export const storeProductsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    // Prefer passing storeId when available to avoid race conditions
    storeId: v.optional(v.id("shopifyStores")),
    syncSessionId: v.optional(v.id("syncSessions")),
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

    if (!store || store.isActive === false) {
      logger.warn("Skipping Shopify product sync because store is inactive", {
        organizationId: String(args.organizationId),
        storeId: args.storeId,
      });

      if (args.syncSessionId) {
        try {
          await ctx.runMutation(internal.jobs.helpers.patchSyncSessionMetadata, {
            sessionId: args.syncSessionId,
            metadata: {
              stageStatus: { products: "failed" },
              lastBatchError: "Shopify store inactive or uninstalled",
              failureReason: "shopify_store_inactive",
              partialSync: true,
            } as any,
          });

          await ctx.runMutation(internal.jobs.helpers.updateSyncSession, {
            sessionId: args.syncSessionId,
            status: "failed",
            error: "Shopify store inactive or uninstalled",
            completedAt: Date.now(),
          });
        } catch (metadataError) {
          logger.warn(
            "Failed to mark sync session as failed after Shopify store uninstall",
            metadataError,
          );
        }
      }

      try {
        await ctx.runMutation(
          internal.core.onboarding.triggerMonitorIfOnboardingComplete,
          {
            organizationId: args.organizationId,
            limit: 1,
            reason: "shopify_store_inactive",
          },
        );
      } catch (monitorError) {
        logger.warn(
          "monitorInitialSyncs failed after detecting inactive Shopify store",
          monitorError,
        );
      }

      return null;
    }

    // Step 1: Bulk fetch existing products without scanning the entire collection
    const existingProducts = await fetchExistingProductsByShopifyIds(
      ctx,
      store._id,
      args.products.map((product) => product.shopifyId),
    );

    // Step 2: Collect all variants from all products
    const allVariants = [];
    const variantShopifyIds = new Set<string>();
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
    const existingVariants = await fetchExistingVariantsByShopifyIds(
      ctx,
      args.organizationId as Id<"organizations">,
      variantShopifyIds,
    );

    // Step 4: Process variants and collect inventory data
    const inventoryToStore = [];
    const variantTotalsToStore = new Map<
      Id<"shopifyProductVariants">,
      { available: number; incoming: number; committed: number }
    >();
    const touchedVariantIds = new Set<Id<"shopifyProductVariants">>();
    const variantIdMap = new Map();

    const accumulateVariantTotals = (
      variantId: Id<"shopifyProductVariants">,
      available: number,
      incoming: number,
      committed: number,
    ) => {
      const current = variantTotalsToStore.get(variantId) ?? {
        available: 0,
        incoming: 0,
        committed: 0,
      };

      current.available += available;
      current.incoming += incoming;
      current.committed += committed;

      variantTotalsToStore.set(variantId, current);
    };

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
      touchedVariantIds.add(variantId);

      const inventoryLevels = Array.isArray(variant.inventoryLevels)
        ? variant.inventoryLevels
        : [];

      if (inventoryLevels.length > 0) {
        for (const invLevel of inventoryLevels) {
          const available =
            typeof invLevel.available === "number" ? invLevel.available : 0;
          const incoming =
            typeof invLevel.incoming === "number" ? invLevel.incoming : 0;
          const committed =
            typeof invLevel.committed === "number" ? invLevel.committed : 0;

          inventoryToStore.push({
            organizationId: variant.organizationId,
            variantId,
            locationId: invLevel.locationId,
            available,
            incoming,
            committed,
          });

          accumulateVariantTotals(variantId, available, incoming, committed);
        }
      } else {
        const available =
          typeof variant.inventoryQuantity === "number"
            ? variant.inventoryQuantity
            : 0;
        inventoryToStore.push({
          organizationId: variant.organizationId,
          variantId,
          locationId: "default",
          available,
          incoming: 0,
          committed: 0,
        });

        accumulateVariantTotals(variantId, available, 0, 0);
      }
    }

    // Step 5: Bulk process inventory levels
    if (inventoryToStore.length > 0) {
      // Create a map for quick lookup of existing inventory
      const inventoryKeys = inventoryToStore.map(
        (inv) => `${inv.variantId}-${inv.locationId}`
      );
      const inventoryKeySet = new Set(inventoryKeys);

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

        if (inventoryKeySet.has(key)) {
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

      for (const existing of existingInventory) {
        if (!touchedVariantIds.has(existing.variantId)) continue;

        const key = `${existing.variantId}-${existing.locationId}`;

        if (!inventoryKeySet.has(key)) {
          await ctx.db.delete(existing._id);
        }
      }
    }

    if (variantTotalsToStore.size > 0) {
      const now = Date.now();
      await Promise.all(
        Array.from(variantTotalsToStore.entries()).map(
          async ([variantId, totals]) => {
            const existingTotals = await ctx.db
              .query("shopifyInventoryTotals")
              .withIndex("by_variant", (q) => q.eq("variantId", variantId))
              .first();

            const totalPayload = {
              organizationId: args.organizationId as Id<"organizations">,
              variantId,
              available: totals.available,
              incoming: totals.incoming,
              committed: totals.committed,
              updatedAt: now,
              syncedAt: now,
            };

            if (existingTotals) {
              await ctx.db.patch(existingTotals._id, totalPayload);
            } else {
              await (ctx.db.insert as any)(
                "shopifyInventoryTotals",
                totalPayload,
              );
            }
          },
        ),
      );
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
    shouldScheduleAnalytics: v.optional(v.boolean()),
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
            shopifyCreatedAt: v.optional(v.number()),
            shopifyUpdatedAt: v.optional(v.number()),
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
        totalDiscounts: v.number(),
        totalTip: v.optional(v.number()),
        currency: v.optional(v.string()),
        totalItems: v.number(),
        totalQuantity: v.number(),
        totalWeight: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
        note: v.optional(v.string()),
        syncedAt: v.optional(v.number()),
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
    const organizationId = args.organizationId as Id<"organizations">;
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

    const organization = await ctx.db.get(organizationId);
    const dateFormattingOptions: MsToDateOptions | undefined = organization?.timezone
      ? { timezone: organization.timezone }
      : undefined;

    // Step 1: Collect all unique customers from orders
    const customerDataMap = new Map<string, {
      shopifyId: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      shopifyCreatedAt?: number;
      shopifyUpdatedAt?: number;
    }>();
    const changedOrders = new Set<string>();
    const orderCreatedAtMap = new Map<string, number>();
    const customerEarliestOrderCreatedAt = new Map<string, number>();

    for (const order of args.orders) {
      if (order.customer) {
        const customerId = order.customer.shopifyId;
        const existing = customerDataMap.get(customerId);
        const nextCustomer = { ...order.customer };

        if (existing) {
          if (nextCustomer.email === undefined) nextCustomer.email = existing.email;
          if (nextCustomer.firstName === undefined) nextCustomer.firstName = existing.firstName;
          if (nextCustomer.lastName === undefined) nextCustomer.lastName = existing.lastName;
          if (nextCustomer.phone === undefined) nextCustomer.phone = existing.phone;
          if (nextCustomer.shopifyCreatedAt === undefined) {
            nextCustomer.shopifyCreatedAt = existing.shopifyCreatedAt;
          }
          if (nextCustomer.shopifyUpdatedAt === undefined) {
            nextCustomer.shopifyUpdatedAt = existing.shopifyUpdatedAt;
          }
        }

        customerDataMap.set(customerId, nextCustomer);

        const createdAt = order.shopifyCreatedAt;
        if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
          const prev = customerEarliestOrderCreatedAt.get(customerId);
          if (prev === undefined || createdAt < prev) {
            customerEarliestOrderCreatedAt.set(customerId, createdAt);
          }
        }
      }
    }

    // Step 2: Fetch only needed customers using precise index to minimize read set
    const customerShopifyIds = Array.from(customerDataMap.keys());
    const existingCustomers = new Map();

    for (const batch of chunkArray(
      customerShopifyIds,
      BULK_OPS.LOOKUP_SIZE,
    )) {
      const results = await Promise.all(
        batch.map((custShopifyId) =>
          ctx.db
            .query("shopifyCustomers")
            .withIndex("by_shopify_id_store", (q) =>
              q.eq("shopifyId", custShopifyId).eq("storeId", store!._id)
            )
            .first(),
        ),
      );

      results.forEach((existing, idx) => {
        if (existing) {
          existingCustomers.set(batch[idx]!, existing);
        }
      });
    }

    // Step 3: Prepare customer inserts/updates
    const _customersToInsert = [];
    const customerIdMap = new Map();

    for (const [shopifyId, customerData] of customerDataMap) {
      const existing = existingCustomers.get(shopifyId);
      const fallbackCustomerCreatedAt = customerEarliestOrderCreatedAt.get(shopifyId);
      const normalizedCreatedAtSource =
        typeof customerData.shopifyCreatedAt === "number" && Number.isFinite(customerData.shopifyCreatedAt)
          ? customerData.shopifyCreatedAt
          : fallbackCustomerCreatedAt;
      const resolvedCreatedAt =
        typeof normalizedCreatedAtSource === "number" && Number.isFinite(normalizedCreatedAtSource)
          ? normalizedCreatedAtSource
          : Date.now();

      const normalizedUpdatedAtSource =
        typeof customerData.shopifyUpdatedAt === "number" && Number.isFinite(customerData.shopifyUpdatedAt)
          ? customerData.shopifyUpdatedAt
          : undefined;
      const resolvedUpdatedAt = Math.max(
        resolvedCreatedAt,
        normalizedUpdatedAtSource ?? fallbackCustomerCreatedAt ?? resolvedCreatedAt,
      );

      if (existing) {
        customerIdMap.set(shopifyId, existing._id);

        const candidate = {
          email: Object.prototype.hasOwnProperty.call(customerData, "email")
            ? toOptionalString(customerData.email)
            : existing.email,
          firstName: Object.prototype.hasOwnProperty.call(customerData, "firstName")
            ? toOptionalString(customerData.firstName)
            : existing.firstName,
          lastName: Object.prototype.hasOwnProperty.call(customerData, "lastName")
            ? toOptionalString(customerData.lastName)
            : existing.lastName,
          phone: Object.prototype.hasOwnProperty.call(customerData, "phone")
            ? toOptionalString(customerData.phone)
            : existing.phone,
        };

        let needsPatch = hasCustomerWebhookChange(existing, candidate);
        const timestampUpdates: Partial<Doc<"shopifyCustomers">> = {};

        if (
          existing.shopifyCreatedAt === undefined ||
          Math.abs(existing.shopifyCreatedAt - resolvedCreatedAt) > 500
        ) {
          timestampUpdates.shopifyCreatedAt = resolvedCreatedAt;
          needsPatch = true;
        }

        const existingUpdatedAt = existing.shopifyUpdatedAt ?? existing.shopifyCreatedAt ?? 0;
        if (Math.abs(existingUpdatedAt - resolvedUpdatedAt) > 500) {
          timestampUpdates.shopifyUpdatedAt = resolvedUpdatedAt;
          needsPatch = true;
        }

        if (needsPatch) {
          await ctx.db.patch(existing._id, {
            ...candidate,
            ...timestampUpdates,
            syncedAt: Date.now(),
          });
        }
      } else {
        const now = Date.now();
        const newCustomerId = await ctx.db.insert("shopifyCustomers", {
          organizationId: args.organizationId as Id<"organizations">,
          storeId: store._id,
          shopifyId,
          email: customerData.email || undefined,
          firstName: customerData.firstName || undefined,
          lastName: customerData.lastName || undefined,
          phone: customerData.phone || undefined,
          totalSpent: 0,
          ordersCount: 0,
          shopifyCreatedAt: resolvedCreatedAt,
          shopifyUpdatedAt: resolvedUpdatedAt,
          syncedAt: now,
        });

        customerIdMap.set(shopifyId, newCustomerId);
      }
    }

    // Step 4: Fetch only needed orders by shopifyId to minimize read set
    const orderShopifyIds = args.orders.map((o) => o.shopifyId);
    const existingOrders = new Map();

    for (const batch of chunkArray(orderShopifyIds, BULK_OPS.LOOKUP_SIZE)) {
      const results = await Promise.all(
        batch.map((oid) =>
          ctx.db
            .query("shopifyOrders")
            .withIndex("by_shopify_id", (q) => q.eq("shopifyId", oid))
            .first(),
        ),
      );

      results.forEach((order, idx) => {
        if (order && order.storeId === store._id) {
          existingOrders.set(batch[idx]!, order);
        }
      });
    }

    // Step 5: Process orders and collect line items
    const orderIdMap = new Map();
    const allLineItems = [];

    for (const orderData of args.orders) {
      orderCreatedAtMap.set(orderData.shopifyId, orderData.shopifyCreatedAt);
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
        organizationId,
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
        totalDiscounts: orderData.totalDiscounts,
        totalTip: orderData.totalTip,
        currency: toOptionalString(orderData.currency), // Store the currency code
        totalItems: orderData.totalItems,
        totalQuantity: orderData.totalQuantity,
        totalWeight: orderData.totalWeight,
        tags,
        note: toOptionalString(orderData.note),
        shippingAddress,
        syncedAt: orderData.syncedAt ?? Date.now(),
      };

      const existing = existingOrders.get(orderData.shopifyId);
      let orderId: Id<"shopifyOrders">;
      let orderWasMutated = false;

      if (existing) {
        if (hasOrderMeaningfulChange(existing, orderToStore)) {
          await ctx.db.patch(existing._id, orderToStore);
          orderWasMutated = true;
        }
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
          if (hasOrderMeaningfulChange(existingForStore, orderToStore)) {
            await ctx.db.patch(existingForStore._id, orderToStore);
            orderWasMutated = true;
          }
          orderId = existingForStore._id as Id<"shopifyOrders">;
        } else {
          orderId = await ctx.db.insert("shopifyOrders", orderToStore);
          orderWasMutated = true;
        }
      }

      if (orderWasMutated) {
        changedOrders.add(orderData.shopifyId);
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
      const variantShopifyIds = new Set<string>();

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
      for (const batch of chunkArray(
        lineItemShopifyIds,
        BULK_OPS.LOOKUP_SIZE,
      )) {
        const results = await Promise.all(
          batch.map((liId) =>
            ctx.db
              .query("shopifyOrderItems")
              .withIndex("by_shopify_id", (q) => q.eq("shopifyId", liId))
              .first(),
          ),
        );

        results.forEach((li, idx) => {
          if (li) {
            existingLineItems.set(batch[idx]!, li);
          }
        });
      }

      // Process line items
      for (const item of allLineItems) {
        const totalDiscount = roundMoney(
          typeof item.totalDiscount === "number" ? item.totalDiscount : 0,
        );

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
          totalDiscount,
          fulfillableQuantity: item.fulfillableQuantity ?? item.quantity ?? 0,
          fulfillmentStatus: toOptionalString(item.fulfillmentStatus),
        };

        const existingItem = existingLineItems.get(item.shopifyId);
        let itemChanged = false;

        if (existingItem) {
          if (hasOrderItemMeaningfulChange(existingItem, itemToStore)) {
            await ctx.db.patch(existingItem._id, itemToStore);
            itemChanged = true;
          }
        } else {
          // Re-check to avoid duplicates in concurrent writes
          const maybeItem = await ctx.db
            .query("shopifyOrderItems")
            .withIndex("by_shopify_id", (q) =>
              q.eq("shopifyId", item.shopifyId)
            )
            .first();

          if (maybeItem) {
            if (hasOrderItemMeaningfulChange(maybeItem, itemToStore)) {
              await ctx.db.patch(maybeItem._id, itemToStore);
              itemChanged = true;
            }
          } else {
            await ctx.db.insert("shopifyOrderItems", itemToStore);
            itemChanged = true;
          }
        }

        if (itemChanged) {
          changedOrders.add(item.orderShopifyId);
        }
      }
    }

    if (changedOrders.size === 0) {
      logger.info("Skipped analytics rebuild (no order changes detected)", {
        organizationId: String(organizationId),
        ordersReceived: args.orders.length,
      });
      return null;
    }

    logger.info(`Processed ${args.orders.length} orders with bulk operations`, {
      mutatedOrders: changedOrders.size,
    });

    const affectedDates = new Set<string>();
    for (const shopifyId of changedOrders) {
      const createdAt = orderCreatedAtMap.get(shopifyId);
      if (!createdAt) continue;
      const date = msToDateString(createdAt, dateFormattingOptions);
      if (date) {
        affectedDates.add(date);
      }
    }

    const canSchedule =
      args.shouldScheduleAnalytics !== undefined
        ? args.shouldScheduleAnalytics
        : await hasCompletedInitialShopifySync(ctx, organizationId);

    if (canSchedule && affectedDates.size > 0) {
      const dates = Array.from(affectedDates);
      await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
        organizationId,
        dates,
        debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
        scope: "shopify.storeOrders",
      });
    }

    return null;
  },
});

type CustomerAddress = {
  country?: string;
  province?: string;
  city?: string;
  zip?: string;
};

type NormalizedCustomer = {
  organizationId: Id<"organizations">;
  storeId: Id<"shopifyStores">;
  shopifyId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  ordersCount: number;
  totalSpent: number;
  state?: string;
  verifiedEmail?: boolean;
  taxExempt?: boolean;
  defaultAddress?: CustomerAddress;
  tags?: string[];
  note?: string;
  shopifyCreatedAt: number;
  shopifyUpdatedAt: number;
  syncedAt: number;
};

const normalizeCustomerAddress = (value: unknown): CustomerAddress | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const maybeAddress = value as Record<string, unknown>;
  const address: CustomerAddress = {
    country: toOptionalString(maybeAddress.country),
    province: toOptionalString(maybeAddress.province ?? maybeAddress.provinceCode),
    city: toOptionalString(maybeAddress.city),
    zip: toOptionalString(maybeAddress.zip ?? maybeAddress.zipCode),
  };

  return Object.values(address).some((part) => part !== undefined) ? address : undefined;
};

const normalizeCustomerPayload = (
  raw: Record<string, unknown>,
  organizationId: Id<"organizations">,
  now: number,
): NormalizedCustomer | null => {
  const storeId = raw.storeId as Id<"shopifyStores"> | undefined;
  const shopifyId = toOptionalString(raw.shopifyId ?? raw.id);

  if (!storeId || !shopifyId) {
    return null;
  }

  const ordersCount = Number.isFinite(raw.ordersCount)
    ? Number(raw.ordersCount)
    : 0;
  const totalSpent = Number.isFinite(raw.totalSpent)
    ? Number(raw.totalSpent)
    : 0;

  const tags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[])
        .map((tag) => toOptionalString(tag))
        .filter((tag): tag is string => Boolean(tag))
        .sort()
    : undefined;

  return {
    organizationId,
    storeId,
    shopifyId,
    email: toOptionalString(raw.email),
    phone: toOptionalString(raw.phone),
    firstName: toOptionalString(raw.firstName),
    lastName: toOptionalString(raw.lastName),
    ordersCount,
    totalSpent,
    state: toOptionalString(raw.state),
    verifiedEmail:
      typeof raw.verifiedEmail === "boolean" ? raw.verifiedEmail : undefined,
    taxExempt:
      typeof raw.taxExempt === "boolean" ? raw.taxExempt : undefined,
    defaultAddress: normalizeCustomerAddress(raw.defaultAddress),
    tags,
    note: toOptionalString(raw.note),
    shopifyCreatedAt: Number.isFinite(raw.shopifyCreatedAt)
      ? Number(raw.shopifyCreatedAt)
      : now,
    shopifyUpdatedAt: Number.isFinite(raw.shopifyUpdatedAt)
      ? Number(raw.shopifyUpdatedAt)
      : now,
    syncedAt: raw.syncedAt && Number.isFinite(raw.syncedAt)
      ? Number(raw.syncedAt)
      : now,
  };
};

const addressesEqual = (
  a: CustomerAddress | undefined,
  b: CustomerAddress | undefined,
) => {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.country === b.country &&
    a.province === b.province &&
    a.city === b.city &&
    a.zip === b.zip
  );
};

const arraysEqual = (a: string[] | undefined, b: string[] | undefined) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
};

const hasCustomerChanges = (
  existing: Doc<"shopifyCustomers">,
  next: NormalizedCustomer,
) => {
  return (
    existing.email !== next.email ||
    existing.phone !== next.phone ||
    existing.firstName !== next.firstName ||
    existing.lastName !== next.lastName ||
    existing.ordersCount !== next.ordersCount ||
    existing.totalSpent !== next.totalSpent ||
    existing.state !== next.state ||
    existing.verifiedEmail !== next.verifiedEmail ||
    existing.taxExempt !== next.taxExempt ||
    !addressesEqual(existing.defaultAddress, next.defaultAddress) ||
    !arraysEqual(existing.tags, next.tags) ||
    existing.note !== next.note ||
    existing.shopifyCreatedAt !== next.shopifyCreatedAt ||
    existing.shopifyUpdatedAt !== next.shopifyUpdatedAt
  );
};

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

    const organizationId = args.organizationId as Id<"organizations">;
    const now = Date.now();

    const customersByStore = new Map<Id<"shopifyStores">, NormalizedCustomer[]>();

    for (const raw of args.customers) {
      const normalized = normalizeCustomerPayload(raw, organizationId, now);

      if (!normalized) {
        logger.warn("Skipping Shopify customer without storeId or shopifyId", {
          organizationId: String(organizationId),
          raw,
        });
        continue;
      }

      const list = customersByStore.get(normalized.storeId) ?? [];
      list.push(normalized);
      customersByStore.set(normalized.storeId, list);
    }

    let inserted = 0;
    let updated = 0;

    for (const [storeId, customers] of customersByStore.entries()) {
      const existingByShopifyId = new Map<string, Doc<"shopifyCustomers">>();

      for (const batch of chunkArray(
        customers.map((customer) => customer.shopifyId),
        BULK_OPS.LOOKUP_SIZE,
      )) {
        const results = await Promise.all(
          batch.map((shopifyId) =>
            ctx.db
              .query("shopifyCustomers")
              .withIndex("by_shopify_id_store", (q) =>
                q.eq("shopifyId", shopifyId).eq("storeId", storeId)
              )
              .first(),
          ),
        );

        results.forEach((doc, index) => {
          if (doc) {
            existingByShopifyId.set(batch[index]!, doc);
          }
        });
      }

      for (const customer of customers) {
        const existing = existingByShopifyId.get(customer.shopifyId);

        if (existing) {
          if (hasCustomerChanges(existing, customer)) {
            await ctx.db.patch(existing._id, {
              ...customer,
              syncedAt: now,
            });
            updated += 1;
          }
        } else {
          await ctx.db.insert("shopifyCustomers", customer);
          inserted += 1;
        }
      }
    }

    logger.info("Processed Shopify customers", {
      organizationId: String(organizationId),
      received: args.customers.length,
      inserted,
      updated,
    });

    return null;
  },
});

export const storeTransactionsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    transactions: v.array(v.any()),
    shouldScheduleAnalytics: v.optional(v.boolean()),
    retryCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organizationId = args.organizationId as Id<"organizations">;
    const organization = await ctx.db.get(organizationId);
    const dateFormattingOptions: MsToDateOptions | undefined = organization?.timezone
      ? { timezone: organization.timezone }
      : undefined;
    const affectedDates = new Set<string>();
    const retryTransactions: Array<(typeof args.transactions)[number]> = [];
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
          retryCount: args.retryCount ?? 0,
        });
        retryTransactions.push(transaction);
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
        organizationId,
        orderId: order._id,
        shopifyId: transaction.shopifyId,
        shopifyOrderId: transaction.shopifyOrderId,
        kind: transaction.kind,
        status: transaction.status,
        gateway: transaction.gateway,
        amount: transaction.amount,
        fee: transaction.fee,
        paymentId: transaction.paymentId,
        shopifyCreatedAt: transaction.shopifyCreatedAt,
        processedAt: transaction.processedAt,
      };

      let transactionMutated = false;

      if (existing) {
        if (hasTransactionMeaningfulChange(existing, transactionData)) {
          await ctx.db.patch(existing._id, transactionData);
          transactionMutated = true;
        }
      } else {
        await ctx.db.insert("shopifyTransactions", transactionData);
        transactionMutated = true;
      }

      if (transactionMutated) {
        const date = msToDateString(transaction.shopifyCreatedAt, dateFormattingOptions);
        if (date) {
          affectedDates.add(date);
        }
      }
    }

    if (retryTransactions.length > 0) {
      const attempt = (args.retryCount ?? 0) + 1;
      if (attempt <= ORDER_WEBHOOK_MAX_RETRIES) {
        await ctx.scheduler.runAfter(
          ORDER_WEBHOOK_RETRY_DELAY_MS,
          internal.integrations.shopify.storeTransactionsInternal,
          {
            organizationId: args.organizationId,
            transactions: retryTransactions as any,
            shouldScheduleAnalytics: args.shouldScheduleAnalytics,
            retryCount: attempt,
          },
        );
      } else {
        logger.error("Exceeded retry attempts for Shopify transactions", {
          organizationId: args.organizationId,
          transactions: retryTransactions.map((tx) => tx.shopifyId),
        });
      }
    }

    if (affectedDates.size > 0) {
      const canSchedule =
        args.shouldScheduleAnalytics !== undefined
          ? args.shouldScheduleAnalytics
          : await hasCompletedInitialShopifySync(ctx, organizationId);

      if (canSchedule) {
        const dates = Array.from(affectedDates);
        await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
          organizationId,
          dates,
          debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
          scope: "shopify.storeTransactions",
        });
      }
    }

    if (affectedDates.size === 0 && retryTransactions.length === 0) {
      return null;
    }

    return null;
  },
});

export const storeRefundsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    refunds: v.array(v.any()),
    shouldScheduleAnalytics: v.optional(v.boolean()),
    retryCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organizationId = args.organizationId as Id<"organizations">;
    const organization = await ctx.db.get(organizationId);
    const dateFormattingOptions: MsToDateOptions | undefined = organization?.timezone
      ? { timezone: organization.timezone }
      : undefined;
    const affectedDates = new Set<string>();
    const retryRefunds: Array<(typeof args.refunds)[number]> = [];
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
          retryCount: args.retryCount ?? 0,
        });
        retryRefunds.push(refund);
        continue;
      }

      // Check if refund already exists
      const existing = await ctx.db
        .query("shopifyRefunds")
        .withIndex("by_shopify_id", (q) => q.eq("shopifyId", refund.shopifyId))
        .first();

      const refundData = {
        organizationId,
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

      let refundMutated = false;

      if (existing) {
        if (hasRefundMeaningfulChange(existing, refundData)) {
          await ctx.db.patch(existing._id, refundData);
          refundMutated = true;
        }
      } else {
        await ctx.db.insert("shopifyRefunds", refundData);
        refundMutated = true;
      }

      if (refundMutated) {
        const date = msToDateString(refund.shopifyCreatedAt, dateFormattingOptions);
        if (date) {
          affectedDates.add(date);
        }
      }
    }

    if (retryRefunds.length > 0) {
      const attempt = (args.retryCount ?? 0) + 1;
      if (attempt <= ORDER_WEBHOOK_MAX_RETRIES) {
        await ctx.scheduler.runAfter(
          ORDER_WEBHOOK_RETRY_DELAY_MS,
          internal.integrations.shopify.storeRefundsInternal,
          {
            organizationId: args.organizationId,
            refunds: retryRefunds as any,
            shouldScheduleAnalytics: args.shouldScheduleAnalytics,
            retryCount: attempt,
          },
        );
      } else {
        logger.error("Exceeded retry attempts for Shopify refunds", {
          organizationId: args.organizationId,
          refunds: retryRefunds.map((refund) => refund.shopifyId),
        });
      }
    }

    if (affectedDates.size > 0) {
      const canSchedule =
        args.shouldScheduleAnalytics !== undefined
          ? args.shouldScheduleAnalytics
          : await hasCompletedInitialShopifySync(ctx, organizationId);

      if (canSchedule) {
        const dates = Array.from(affectedDates);
        await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
          organizationId,
          dates,
          debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
          scope: "shopify.storeRefunds",
        });
      }
    }

    if (affectedDates.size === 0 && retryRefunds.length === 0) {
      return null;
    }

    return null;
  },
});

export const storeFulfillmentsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fulfillments: v.array(v.any()),
    retryCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const retryFulfillments: Array<(typeof args.fulfillments)[number]> = [];
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
          retryCount: args.retryCount ?? 0,
        });
        retryFulfillments.push(fulfillment);
        continue;
      }

      // Check if fulfillment already exists
      const existing = await ctx.db
        .query("shopifyFulfillments")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", fulfillment.shopifyId)
        )
        .first();

      const trackingNumbers =
        toStringArray(fulfillment.trackingNumbers) ??
        toStringArray(existing?.trackingNumbers) ??
        [];
      const trackingUrls =
        toStringArray(fulfillment.trackingUrls) ??
        toStringArray(existing?.trackingUrls) ??
        [];

      const fulfillmentData = {
        organizationId: args.organizationId as Id<"organizations">,
        orderId: order._id,
        shopifyId: fulfillment.shopifyId,
        shopifyOrderId: fulfillment.shopifyOrderId,
        status: fulfillment.status,
        shipmentStatus: toOptionalString(fulfillment.shipmentStatus),
        trackingCompany: toOptionalString(fulfillment.trackingCompany),
        trackingNumbers,
        trackingUrls,
        locationId: toOptionalString(fulfillment.locationId),
        service: toOptionalString(fulfillment.service),
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

    if (retryFulfillments.length > 0) {
      const attempt = (args.retryCount ?? 0) + 1;
      if (attempt <= ORDER_WEBHOOK_MAX_RETRIES) {
        await ctx.scheduler.runAfter(
          ORDER_WEBHOOK_RETRY_DELAY_MS,
          internal.integrations.shopify.storeFulfillmentsInternal,
          {
            organizationId: args.organizationId,
            fulfillments: retryFulfillments as any,
            retryCount: attempt,
          },
        );
      } else {
        logger.error("Exceeded retry attempts for Shopify fulfillments", {
          organizationId: args.organizationId,
          fulfillments: retryFulfillments.map((fulfillment) => fulfillment.shopifyId),
        });
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
      email: toOptionalString(args.customer.email),
      phone: toOptionalString(args.customer.phone),
      firstName: toOptionalString(args.customer.first_name),
      lastName: toOptionalString(args.customer.last_name),
      ordersCount: existing?.ordersCount ?? 0,
      totalSpent: existing?.totalSpent ?? 0,
      tags:
        typeof args.customer.tags === "string"
          ? (args.customer.tags as string).split(",").map((t) => t.trim()).filter(Boolean)
          : Array.isArray(args.customer.tags)
            ? (args.customer.tags as string[]).map((t) => String(t).trim()).filter(Boolean)
            : [],
      shopifyCreatedAt: toMs(args.customer.created_at) ?? Date.now(),
      shopifyUpdatedAt: toMs(args.customer.updated_at) ?? Date.now(),
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

      const totalsDoc = await ctx.db
        .query("shopifyInventoryTotals")
        .withIndex("by_variant", (q) => q.eq("variantId", vdoc._id))
        .first();
      if (totalsDoc) {
        await ctx.db.delete(totalsDoc._id);
      }

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
  handler: async (_ctx, _args) => {
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
  handler: async (_ctx, _args) => {
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
  handler: async (_ctx, _args) => {
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
          await ctx.runMutation(
            internal.integrations.shopify.storeOrdersInternal,
            {
              organizationId,
              orders: [payload],
            }
          );
          break;

        case "orders/cancelled": {
          const orderIdentifier = payload.shopifyId ?? payload.id;

          if (!orderIdentifier) {
            throw new Error("Order ID not found in payload");
          }

          await ctx.runMutation(
            internal.integrations.shopify.updateOrderStatusInternal,
            {
              organizationId,
              orderId: String(orderIdentifier),
              financialStatus: "cancelled",
              fulfillmentStatus: "cancelled",
            }
          );
          break;
        }
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
 * Upsert Shopify analytics aggregates (sessions, traffic sources, etc.)
 */
export const storeAnalyticsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    entries: v.array(
      v.object({
        date: v.string(),
        trafficSource: v.string(),
        sessions: v.number(),
        visitors: v.optional(v.number()),
        pageViews: v.optional(v.number()),
        bounceRate: v.optional(v.number()),
        conversionRate: v.optional(v.number()),
        conversions: v.optional(v.number()),
        dataSource: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const entry of args.entries) {
      const normalizedSource = entry.trafficSource || "unknown";

      const existing = await ctx.db
        .query("shopifyAnalytics")
        .withIndex("by_store_date_source", (q) =>
          q
            .eq("storeId", args.storeId)
            .eq("date", entry.date)
            .eq("trafficSource", normalizedSource)
        )
        .first();

      const baseUpdate: Record<string, unknown> = {
        sessions: entry.sessions,
        syncedAt: Date.now(),
      };

      if (entry.dataSource !== undefined) {
        baseUpdate.dataSource = entry.dataSource;
      }

      if (entry.visitors !== undefined) baseUpdate.visitors = entry.visitors;
      if (entry.pageViews !== undefined) baseUpdate.pageViews = entry.pageViews;
      if (entry.bounceRate !== undefined)
        baseUpdate.bounceRate = entry.bounceRate;
      if (entry.conversionRate !== undefined)
        baseUpdate.conversionRate = entry.conversionRate;
      if (entry.conversions !== undefined)
        baseUpdate.conversions = entry.conversions;

      if (existing) {
        await ctx.db.patch(existing._id, baseUpdate as any);
      } else {
        await ctx.db.insert("shopifyAnalytics", {
          organizationId: args.organizationId,
          storeId: args.storeId,
          date: entry.date,
          trafficSource: normalizedSource,
          sessions: entry.sessions,
          visitors: entry.visitors,
          pageViews: entry.pageViews,
          bounceRate: entry.bounceRate,
          conversionRate: entry.conversionRate,
          conversions: entry.conversions,
          dataSource: entry.dataSource ?? "shopify_analytics",
          syncedAt: Date.now(),
        });
      }
    }

    return null;
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

      const organizationId = args.organizationId as Id<"organizations">;

      const users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId)
        )
        .collect();

      for (const user of users) {
        const uninstallTimestamp = Date.now();
          const onboardingResetData = {
            completedSteps: [],
            setupDate: new Date(uninstallTimestamp).toISOString(),
            firecrawlSeededAt: undefined,
            firecrawlSeededUrl: undefined,
            firecrawlSummary: undefined,
            firecrawlPageCount: undefined,
            firecrawlSeedingStatus: undefined,
            firecrawlLastAttemptAt: undefined,
          };

        try {
          // Mark existing memberships as removed so the user no longer belongs to the org
          const memberships = await ctx.db
            .query("memberships")
            .withIndex("by_org_user", (q) =>
              q
                .eq("organizationId", organizationId)
                .eq("userId", user._id),
            )
            .collect();

          for (const membership of memberships) {
            if (membership.status !== "removed") {
              await ctx.db.patch(membership._id, {
                status: "removed",
                updatedAt: uninstallTimestamp,
              });
            }
          }

          // Reset onboarding record so any residual data is cleared before cleanup
          const onboarding = await ctx.db
            .query("onboarding")
            .withIndex("by_user_organization", (q) =>
              q
                .eq("userId", user._id)
                .eq("organizationId", user.organizationId as Id<"organizations">),
            )
            .first();

          if (onboarding) {
            await ctx.db.patch(onboarding._id, {
              hasShopifyConnection: false,
              hasShopifySubscription: false,
              hasMetaConnection: false,
              hasGoogleConnection: false,
              isInitialSyncComplete: false,
              isProductCostSetup: false,
              isExtraCostSetup: false,
              isCompleted: false,
              onboardingStep: 1,
              onboardingData: onboardingResetData,
              updatedAt: uninstallTimestamp,
            });
          } else {
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
              onboardingData: onboardingResetData,
              createdAt: uninstallTimestamp,
              updatedAt: uninstallTimestamp,
            });
          }

          // Move the user into a fresh personal organization so they can re-onboard later
          await createNewUserData(ctx as unknown as MutationCtx, user._id, {
            name: user.name || null,
            email: user.email || null,
          });

          // Record uninstall timestamp on the user for audit purposes
          await ctx.db.patch(user._id, {
            appDeletedAt: uninstallTimestamp,
            updatedAt: Date.now(),
          });

          logger.info("Detached user from organization after uninstall", {
            organizationId: args.organizationId,
            userId: user._id,
          });
        } catch (error) {
          logger.error("Failed to detach user during uninstall", error, {
            organizationId: args.organizationId,
            userId: user._id,
          });
        }
      }

      // STEP 2: RESET ORGANIZATION STATE
      const organization = await ctx.db.get(organizationId);
      if (organization) {
        await ctx.db.patch(organization._id, {
          isPremium: false,
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

      logger.info("User and organization state reset completed", {
        organizationId: args.organizationId,
        usersReset: users.length,
      });

      // STEP 3: SCHEDULE DATA CLEANUP IN BATCHES
      const storeJobsPerTable: Record<string, number> = {};
      const organizationJobsPerTable: Record<string, number> = {};

      const stores = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId)
        )
        .collect();

      let storeCleanupJobs = 0;

      for (const store of stores) {
        for (const table of STORE_TABLES) {
          await ctx.scheduler.runAfter(
            0,
            internal.integrations.shopify.deleteStoreDataBatch,
            {
              table,
              storeId: store._id,
              batchSize: DELETE_BATCH_SIZE,
            },
          );

          storeCleanupJobs += 1;
          storeJobsPerTable[table] = (storeJobsPerTable[table] ?? 0) + 1;
        }

        await ctx.scheduler.runAfter(
          0,
          internal.integrations.shopify.deleteShopifyStoreIfEmpty,
          {
            storeId: store._id,
            organizationId,
          },
        );

        storeCleanupJobs += 1;
      }

      let organizationCleanupJobs = 0;

      for (const table of ORGANIZATION_TABLES) {
        await ctx.scheduler.runAfter(
          0,
          internal.integrations.shopify.deleteOrganizationDataBatch,
          {
            table,
            organizationId,
            batchSize: DELETE_BATCH_SIZE,
          },
        );

        organizationCleanupJobs += 1;
        organizationJobsPerTable[table] =
          (organizationJobsPerTable[table] ?? 0) + 1;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.integrations.shopify.deleteDashboardsBatch,
        {
          organizationId,
          ownerId: organization?.ownerId as Id<"users"> | undefined,
          batchSize: DELETE_BATCH_SIZE,
        },
      );

      organizationCleanupJobs += 1;
      organizationJobsPerTable.dashboards =
        (organizationJobsPerTable.dashboards ?? 0) + 1;

      logger.info("App uninstall cleanup scheduled", {
        organizationId: args.organizationId,
        shopDomain: args.shopDomain,
        usersReset: users.length,
        storeCount: stores.length,
        storeCleanupJobs,
        organizationCleanupJobs,
        storeJobsPerTable,
        organizationJobsPerTable,
      });

      return null;
    } catch (error) {
      logger.error("App uninstall handler failed", error, {
        organizationId: args.organizationId,
        shopDomain: args.shopDomain,
      });

      // Try to get a user for audit log
      throw error;
    }
  },
});
