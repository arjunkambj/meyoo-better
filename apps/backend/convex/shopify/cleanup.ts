
import { DEFAULT_DASHBOARD_CONFIG } from "@repo/types";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { logger } from "./shared";

export const DELETE_BATCH_SIZE = 200;

export const ORGANIZATION_TABLES = [
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

export type OrganizationDataTable = (typeof ORGANIZATION_TABLES)[number];

export const STORE_TABLES = [
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
    internal.shopify.cleanup.deleteOrganizationDataBatch,
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
    internal.shopify.cleanup.deleteStoreDataBatch,
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
      await ctx.scheduler.runAfter(0, internal.shopify.cleanup.deleteDashboardsBatch, {
        organizationId: args.organizationId,
        ownerId: args.ownerId,
        cursor: page.continueCursor,
        batchSize,
      });
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
        internal.shopify.cleanup.deleteShopifyStoreIfEmpty,
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
