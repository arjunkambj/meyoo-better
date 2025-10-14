import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { createNewUserData } from "../authHelpers";
import { createJob, PRIORITY } from "../engine/workpool";
import { optionalEnv } from "../utils/env";
import { buildDateSpan } from "../utils/date";
import { getOrgTimeInfo } from "../utils/orgDateRange";

const CONVEX_CLOUD_URL = optionalEnv("CONVEX_CLOUD_URL");

/**
 * Admin API
 * Administrative functions for system management
 */

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

async function loadUser(ctx: AnyCtx, userId: Id<"users">) {
  if ("db" in ctx) {
    return await ctx.db.get(userId);
  }

  return await ctx.runQuery(internal.meyoo.admin.getUserById, { userId });
}

async function loadMembership(
  ctx: AnyCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  if ("db" in ctx) {
    return await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId),
      )
      .first();
  }

  return await ctx.runQuery(
    internal.core.memberships.getMembershipForUserInternal,
    {
      orgId: organizationId,
      userId,
    },
  );
}

function isAdminMembership(
  membership: Doc<"memberships"> | null | undefined,
) {
  return membership?.role === "StoreOwner";
}

async function ensureAdminAccess(
  ctx: AnyCtx,
  organizationId?: Id<"organizations">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await loadUser(ctx, userId);
  if (!user) {
    throw new Error("User not found");
  }

  const targetOrgId =
    organizationId ??
    (user.organizationId ? (user.organizationId as Id<"organizations">) : null);

  if (!targetOrgId) {
    throw new Error("Admin access required");
  }

  const membership = await loadMembership(ctx, targetOrgId, user._id);
  if (!membership || !isAdminMembership(membership)) {
    throw new Error("Admin access required");
  }

  return { user, membership, organizationId: targetOrgId } as const;
}

const RESET_DEFAULT_BATCH_SIZE = 200;
const RESET_MAX_BATCH_SIZE = 500;
const RESET_MEMBER_BATCH_SIZE = 25;
const RESET_TICKET_BATCH_SIZE = 10;
const ANALYTICS_REBUILD_CHUNK_SIZE = 5;
const CUSTOMER_SNAPSHOT_MAX_DAYS = 365;

const ORG_SCOPED_TABLES = [
  "shopifyOrderItems",
  "shopifyTransactions",
  "shopifyRefunds",
  "shopifyFulfillments",
  "shopifyInventory",
  "shopifyInventoryTotals",
  "shopifyProductVariants",
  "shopifyProducts",
  "shopifyOrders",
  "shopifyCustomers",
  "shopifyStores",
  "shopifySessions",
  "shopifyAnalytics",
  "dailyMetrics",
  "inventoryProductSummaries",
  "inventoryOverviewSummaries",
  "customerMetricsSummaries",
  "customerOverviewSummaries",
  "integrationSessions",
  "metaAdAccounts",
  "metaInsights",
  "syncProfiles",
  "syncSessions",
  "globalCosts",
  "manualReturnRates",
  "variantCosts",
  "dashboards",
  "gdprRequests",
  "notifications",
  "billing",
] as const;

type OrgScopedTable = (typeof ORG_SCOPED_TABLES)[number];

const orgScopedTableValidator = v.union(
  ...ORG_SCOPED_TABLES.map((table) => v.literal(table)),
);

const normalizeBatchSize = (
  size: number | undefined,
  fallback: number,
  max: number,
): number => {
  if (typeof size !== "number" || Number.isNaN(size) || size <= 0) {
    return fallback;
  }

  return Math.min(Math.max(1, Math.floor(size)), max);
};

const chunkArray = <T>(items: readonly T[], size: number): T[][] => {
  const chunkSize = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

export const deleteOrgRecordsBatch = internalMutation({
  args: {
    table: orgScopedTableValidator,
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(
      args.batchSize,
      RESET_DEFAULT_BATCH_SIZE,
      RESET_MAX_BATCH_SIZE,
    );

    const page = await (ctx.db.query(args.table) as any)
      .withIndex("by_organization", (q: any) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });

    for (const record of page.page) {
      await ctx.db.delete(record._id);
    }

    return {
      deleted: page.page.length,
      hasMore: !page.isDone,
      cursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});

export const deleteTicketsBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deletedTickets: v.number(),
    deletedResponses: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(
      args.batchSize,
      RESET_TICKET_BATCH_SIZE,
      RESET_MAX_BATCH_SIZE,
    );

    let cursor: string | null = args.cursor ?? null;
    let deletedTickets = 0;
    let deletedResponses = 0;

    while (true) {
      const page = await ctx.db
        .query("tickets")
        .withIndex("by_created", (q) => q.gte("createdAt", 0))
        .paginate({
          numItems: batchSize,
          cursor,
        });

      cursor = page.isDone ? null : page.continueCursor;

      for (const ticket of page.page) {
        if (ticket.organizationId !== args.organizationId) {
          continue;
        }

        const responses = await ctx.db
          .query("ticketResponses")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();

        for (const response of responses) {
          await ctx.db.delete(response._id);
          deletedResponses++;
        }

        await ctx.db.delete(ticket._id);
        deletedTickets++;

        if (deletedTickets >= batchSize) {
          break;
        }
      }

      if (deletedTickets >= batchSize || page.isDone) {
        break;
      }
    }

    return {
      deletedTickets,
      deletedResponses,
      hasMore: cursor !== null,
      cursor: cursor ?? undefined,
    };
  },
});

export const deleteIntegrationSessionsByPlatformBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    platform: v.union(v.literal("shopify"), v.literal("meta")),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(
      args.batchSize,
      RESET_DEFAULT_BATCH_SIZE,
      RESET_MAX_BATCH_SIZE,
    );

    const page = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_and_platform", (q) =>
        q.eq("organizationId", args.organizationId).eq("platform", args.platform),
      )
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });

    for (const session of page.page) {
      await ctx.db.delete(session._id);
    }

    return {
      deleted: page.page.length,
      hasMore: !page.isDone,
      cursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});

export const resetMembersBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(
      args.batchSize,
      RESET_MEMBER_BATCH_SIZE,
      RESET_MAX_BATCH_SIZE,
    );

    const page = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });

    let updated = 0;

    for (const member of page.page) {
      const resetTimestamp = Date.now();
      const onboardingResetData = {
        completedSteps: [],
        setupDate: new Date(resetTimestamp).toISOString(),
        firecrawlSeededAt: undefined,
        firecrawlSeededUrl: undefined,
        firecrawlSummary: undefined,
        firecrawlPageCount: undefined,
        firecrawlSeedingStatus: undefined,
        firecrawlLastAttemptAt: undefined,
      };

      // Mark any existing memberships as removed so the user leaves the organization
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", args.organizationId).eq("userId", member._id),
        )
        .collect();

      for (const membership of memberships) {
        if (membership.status !== "removed") {
          await ctx.db.patch(membership._id, {
            status: "removed",
            updatedAt: resetTimestamp,
          });
        }
      }

      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", member._id).eq("organizationId", args.organizationId),
        )
        .first();

      if (onboarding) {
        await ctx.db.patch(onboarding._id, {
          onboardingStep: 1,
          isCompleted: false,
          hasShopifyConnection: false,
          hasShopifySubscription: false,
          hasMetaConnection: false,
          hasGoogleConnection: false,
          isInitialSyncComplete: false,
          isProductCostSetup: false,
          isExtraCostSetup: false,
          onboardingData: onboardingResetData,
          updatedAt: resetTimestamp,
        });
      }

      // Recreate the user in a fresh personal organization similar to leave/remove flows
      await createNewUserData(ctx as unknown as MutationCtx, member._id, {
        name: member.name || null,
        email: member.email || null,
      });

      await ctx.db.patch(member._id, {
        appDeletedAt: resetTimestamp,
        updatedAt: Date.now(),
      });

      updated++;
    }

    return {
      updated,
      hasMore: !page.isDone,
      cursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});

export const resetShopifyMembersBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(
      args.batchSize,
      RESET_MEMBER_BATCH_SIZE,
      RESET_MAX_BATCH_SIZE,
    );

    const page = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });

    let updated = 0;

    for (const member of page.page) {
      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", member._id).eq("organizationId", args.organizationId),
        )
        .first();

      if (onboarding) {
        await ctx.db.patch(onboarding._id, {
          hasShopifyConnection: false,
          hasShopifySubscription: false,
          isProductCostSetup: false,
          isExtraCostSetup: false,
          hasMetaConnection: false,
          hasGoogleConnection: false,
          updatedAt: Date.now(),
        });
      }

      await ctx.db.patch(member._id, {
        updatedAt: Date.now(),
      });

      updated++;
    }

    return {
      updated,
      hasMore: !page.isDone,
      cursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});

export const resetMetaMembersBatch = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.number(),
    hasMore: v.boolean(),
    cursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const batchSize = normalizeBatchSize(
      args.batchSize,
      RESET_MEMBER_BATCH_SIZE,
      RESET_MAX_BATCH_SIZE,
    );

    const page = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate({
        numItems: batchSize,
        cursor: args.cursor ?? null,
      });

    let updated = 0;

    for (const member of page.page) {
      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", member._id).eq("organizationId", args.organizationId),
        )
        .first();

      if (onboarding) {
        await ctx.db.patch(onboarding._id, {
          hasMetaConnection: false,
          updatedAt: Date.now(),
        });
      }

      await ctx.db.patch(member._id, {
        isOnboarded: true,
        updatedAt: Date.now(),
      });

      updated++;
    }

    return {
      updated,
      hasMore: !page.isDone,
      cursor: page.isDone ? undefined : page.continueCursor,
    };
  },
});

/**
 * Internal query to get user by ID
 */
export const getUserById = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    return user;
  },
});

/**
 * Reset Meta data for an organization and update user flags
 */
export const resetMetaData = action({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    success: v.boolean(),
    deletedCounts: v.object({
      metaAdAccounts: v.number(),
      metaCampaigns: v.number(),
      metaAds: v.number(),
      metaInsights: v.number(),
      integrationSessions: v.number(),
      webhookLogs: v.number(),
      usersUpdated: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await ensureAdminAccess(ctx, args.organizationId);

    if (CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    const counts = {
      metaAdAccounts: 0,
      metaCampaigns: 0,
      metaAds: 0,
      metaInsights: 0,
      integrationSessions: 0,
      usersUpdated: 0,
    } satisfies Record<string, number>;

    const webhookLogs = 0;

    const deleteTableWithCount = async (
      table: OrgScopedTable,
      key: keyof typeof counts,
    ) => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteOrgRecordsBatch,
          {
            table,
            organizationId: args.organizationId,
            batchSize: RESET_DEFAULT_BATCH_SIZE,
            cursor,
          },
        );

        counts[key] += result.deleted;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    const deleteIntegrationSessions = async () => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteIntegrationSessionsByPlatformBatch,
          {
            organizationId: args.organizationId,
            platform: "meta",
            batchSize: RESET_DEFAULT_BATCH_SIZE,
            cursor,
          },
        );

        counts.integrationSessions += result.deleted;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    const resetMembers = async () => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.resetMetaMembersBatch,
          {
            organizationId: args.organizationId,
            batchSize: RESET_MEMBER_BATCH_SIZE,
            cursor,
          },
        );

        counts.usersUpdated += result.updated;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    await deleteTableWithCount("metaAdAccounts", "metaAdAccounts");
    await deleteTableWithCount("metaInsights", "metaInsights");

    await deleteIntegrationSessions();
    await resetMembers();

    return {
      success: true,
      deletedCounts: {
        metaAdAccounts: counts.metaAdAccounts,
        metaCampaigns: counts.metaCampaigns,
        metaAds: counts.metaAds,
        metaInsights: counts.metaInsights,
        integrationSessions: counts.integrationSessions,
        webhookLogs,
        usersUpdated: counts.usersUpdated,
      },
    };
  },
});

/**
 * Recalculate analytics aggregates for an organization.
 * Rebuilds daily metric snapshots for the requested lookback period using the new dailyMetrics table.
 */
export const recalculateAnalytics = action({
  args: {
    daysBack: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.object({
    success: v.boolean(),
    processed: v.number(),
    updated: v.number(),
    skipped: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    processed: number;
    updated: number;
    skipped: number;
    message: string;
  }> => {
    const { user, organizationId } = await ensureAdminAccess(
      ctx,
      args.organizationId,
    );

    const daysBack = Math.max(1, Math.floor(args.daysBack ?? 60));
    const timeInfo = await getOrgTimeInfo(ctx, organizationId);
    const dateOptions = timeInfo.timeZone
      ? { timezone: timeInfo.timeZone }
      : typeof timeInfo.offsetMinutes === "number"
        ? { offsetMinutes: timeInfo.offsetMinutes }
        : undefined;
    const dates = buildDateSpan(daysBack, undefined, dateOptions);

    if (dates.length === 0) {
      return {
        success: true,
        processed: 0,
        updated: 0,
        skipped: 0,
        message: "No dates to rebuild.",
      };
    }

    const bounds = await ctx.runQuery(
      internal.engine.analytics.getAvailableDateBounds,
      {
        organizationId,
      },
    );

    const filteredDates = dates.filter((date) => {
      const withinLowerBound = !bounds.earliest || date >= bounds.earliest;
      const withinUpperBound = !bounds.latest || date <= bounds.latest;
      return withinLowerBound && withinUpperBound;
    });

    if (filteredDates.length === 0) {
      return {
        success: true,
        processed: 0,
        updated: 0,
        skipped: 0,
        message:
          bounds.earliest && bounds.latest
            ? `No analytics sources found between ${bounds.earliest} and ${bounds.latest}.`
            : "No analytics source data available yet.",
      };
    }

    const startedAt = Date.now();
    const chunks = chunkArray(filteredDates, ANALYTICS_REBUILD_CHUNK_SIZE);
    const jobIds: string[] = [];

    for (const chunk of chunks) {
      const jobId = await createJob(
        ctx,
        "analytics:rebuildDaily",
        PRIORITY.LOW,
        {
          organizationId,
          dates: chunk,
        },
        {
          context: {
            scope: "admin.recalculateAnalytics",
            requestedBy: String(user._id),
            chunkSize: chunk.length,
            totalDates: filteredDates.length,
            requestedDates: dates.length,
            earliestAvailable: bounds.earliest,
            latestAvailable: bounds.latest,
          },
        },
      );

      jobIds.push(jobId);
    }

    const duration = Date.now() - startedAt;
    const jobCount = jobIds.length;

    const snapshotWindow = Math.max(1, Math.min(daysBack, 90));

    try {
      await ctx.runMutation(
        internal.engine.inventory.rebuildInventorySnapshot,
        {
          organizationId,
          analysisWindowDays: snapshotWindow,
        },
      );
    } catch (error) {
      console.warn(
        `[DEV_TOOLS] Failed to rebuild inventory snapshot for org ${organizationId}:`,
        error,
      );
    }

    try {
      await ctx.runMutation(
        internal.engine.customers.rebuildCustomerSnapshot,
        {
          organizationId,
          analysisWindowDays: Math.max(
            1,
            Math.min(daysBack, CUSTOMER_SNAPSHOT_MAX_DAYS),
          ),
        },
      );
    } catch (error) {
      console.warn(
        `[DEV_TOOLS] Failed to rebuild customer snapshot for org ${organizationId}:`,
        error,
      );
    }

    // Mark analytics as completed in onboarding so cron stops checking this org
    try {
      const onboardingRecord = await ctx.runQuery(
        internal.core.onboarding.getOnboardingByOrganization,
        { organizationId },
      );

      if (onboardingRecord) {
        await ctx.runMutation(internal.core.onboarding.markAnalyticsCompleted, {
          onboardingId: onboardingRecord._id,
          triggeredBy: "manual_devtools",
          jobCount,
        });

        console.log(
          `[DEV_TOOLS] Marked analytics as completed for org ${organizationId} - cron will stop monitoring`,
        );
      }
    } catch (error) {
      // Non-critical - log and continue
      console.warn(
        `[DEV_TOOLS] Failed to mark analytics completed for org ${organizationId}:`,
        error,
      );
    }

    return {
      success: true,
      processed: filteredDates.length,
      updated: 0,
      skipped: 0,
      message: `Queued ${jobCount} analytics rebuild job${jobCount === 1 ? "" : "s"} for ${filteredDates.length} day${filteredDates.length === 1 ? "" : "s"} in ${duration}ms (requested ${dates.length}). Progress will update as jobs complete.`,
    };
  },
});

/**
 * Delete precomputed analytics snapshots for an organization.
 */
export const deleteAnalyticsMetrics = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.object({
    success: v.boolean(),
    deleted: v.number(),
    tables: v.record(v.string(), v.number()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    deleted: number;
    tables: Record<string, number>;
  }> => {
    const { organizationId } = await ensureAdminAccess(
      ctx,
      args.organizationId,
    );

    if (CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot delete analytics data in production");
    }

    const tablesToClear: OrgScopedTable[] = [
      "dailyMetrics",
      "inventoryProductSummaries",
      "inventoryOverviewSummaries",
      "customerMetricsSummaries",
      "customerOverviewSummaries",
    ];
    let totalDeleted = 0;
    const perTable: Record<string, number> = {};

    for (const table of tablesToClear) {
      let hasMore = true;
      let cursor: string | undefined;
      let tableDeleted = 0;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteOrgRecordsBatch,
          {
            table,
            organizationId,
            cursor,
            batchSize: RESET_DEFAULT_BATCH_SIZE,
          },
        );

        tableDeleted += result.deleted;
        totalDeleted += result.deleted;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }

      perTable[table] = tableDeleted;
    }

    return {
      success: true,
      deleted: totalDeleted,
      tables: perTable,
    };
  },
});

/**
 * Reset Shopify data for an organization and update user flags
 */
export const resetShopifyData = action({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    success: v.boolean(),
    deletedCounts: v.object({
      stores: v.number(),
      orders: v.number(),
      orderItems: v.number(),
      refunds: v.number(),
      transactions: v.number(),
      fulfillments: v.number(),
      products: v.number(),
      variants: v.number(),
      inventory: v.number(),
      inventorySummaries: v.number(),
      customerSummaries: v.number(),
      customers: v.number(),
      metafields: v.number(),
      webhookLogs: v.number(),
      integrationSessions: v.number(),
      billingReset: v.boolean(),
      usersUpdated: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await ensureAdminAccess(ctx, args.organizationId);

    if (CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    const counts: {
      stores: number;
      orders: number;
      orderItems: number;
      refunds: number;
      transactions: number;
      fulfillments: number;
      products: number;
      variants: number;
      inventory: number;
      inventorySummaries: number;
      customerSummaries: number;
      customers: number;
      integrationSessions: number;
      usersUpdated: number;
    } = {
      stores: 0,
      orders: 0,
      orderItems: 0,
      refunds: 0,
      transactions: 0,
      fulfillments: 0,
      products: 0,
      variants: 0,
      inventory: 0,
      inventorySummaries: 0,
      customerSummaries: 0,
      customers: 0,
      integrationSessions: 0,
      usersUpdated: 0,
    };

    let billingReset = false;

    const deleteTableWithCount = async (
      table: OrgScopedTable,
      key: keyof typeof counts,
    ) => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteOrgRecordsBatch,
          {
            table,
            organizationId: args.organizationId,
            batchSize: RESET_DEFAULT_BATCH_SIZE,
            cursor,
          },
        );

        counts[key] += result.deleted;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    const deleteIntegrationSessions = async () => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteIntegrationSessionsByPlatformBatch,
          {
            organizationId: args.organizationId,
            platform: "shopify",
            batchSize: RESET_DEFAULT_BATCH_SIZE,
            cursor,
          },
        );

        counts.integrationSessions += result.deleted;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    const resetMembers = async () => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.resetShopifyMembersBatch,
          {
            organizationId: args.organizationId,
            batchSize: RESET_MEMBER_BATCH_SIZE,
            cursor,
          },
        );

        counts.usersUpdated += result.updated;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    const deleteBilling = async () => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteOrgRecordsBatch,
          {
            table: "billing",
            organizationId: args.organizationId,
            batchSize: RESET_DEFAULT_BATCH_SIZE,
            cursor,
          },
        );

        if (result.deleted > 0) {
          billingReset = true;
        }

        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    // Delete child tables before parent tables to avoid dangling references
    await deleteTableWithCount("shopifyOrderItems", "orderItems");
    await deleteTableWithCount("shopifyRefunds", "refunds");
    await deleteTableWithCount("shopifyTransactions", "transactions");
    await deleteTableWithCount("shopifyFulfillments", "fulfillments");
    await deleteTableWithCount("shopifyInventory", "inventory");
    await deleteTableWithCount("shopifyInventoryTotals", "inventory");
    await deleteTableWithCount(
      "inventoryProductSummaries",
      "inventorySummaries",
    );
    await deleteTableWithCount(
      "inventoryOverviewSummaries",
      "inventorySummaries",
    );
    await deleteTableWithCount("shopifyProductVariants", "variants");
    await deleteTableWithCount("shopifyProducts", "products");
    await deleteTableWithCount("shopifyOrders", "orders");
    await deleteTableWithCount("shopifyCustomers", "customers");
    await deleteTableWithCount(
      "customerMetricsSummaries",
      "customerSummaries",
    );
    await deleteTableWithCount(
      "customerOverviewSummaries",
      "customerSummaries",
    );
    await deleteTableWithCount("shopifyStores", "stores");

    await deleteIntegrationSessions();
    await resetMembers();
    await deleteBilling();

    return {
      success: true,
      deletedCounts: {
        stores: counts.stores,
        orders: counts.orders,
        orderItems: counts.orderItems,
        refunds: counts.refunds,
        transactions: counts.transactions,
        fulfillments: counts.fulfillments,
        products: counts.products,
        variants: counts.variants,
        inventory: counts.inventory,
        inventorySummaries: counts.inventorySummaries,
        customerSummaries: counts.customerSummaries,
        customers: counts.customers,
        metafields: 0,
        webhookLogs: 0,
        integrationSessions: counts.integrationSessions,
        billingReset,
        usersUpdated: counts.usersUpdated,
      },
    };
  },
});

/**
 * Reset everything for an organization: wipe most org-scoped data and reset users to initial state.
 * Keeps organizationId, but sets onboarding to false and clears integration flags.
 */
export const resetEverything = action({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    success: v.boolean(),
    deleted: v.number(),
    usersUpdated: v.number(),
  }),
  handler: async (ctx, args) => {
    await ensureAdminAccess(ctx, args.organizationId);

    if (CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    let deleted = 0;
    let usersUpdated = 0;

    const deleteTable = async (
      table: OrgScopedTable,
      batchSize = RESET_DEFAULT_BATCH_SIZE,
    ) => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteOrgRecordsBatch,
          {
            table,
            organizationId: args.organizationId,
            batchSize,
            cursor,
          },
        );

        deleted += result.deleted;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    const deleteTickets = async () => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.deleteTicketsBatch,
          {
            organizationId: args.organizationId,
            cursor,
            batchSize: RESET_TICKET_BATCH_SIZE,
          },
        );

        deleted += result.deletedTickets + result.deletedResponses;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    const resetMembers = async () => {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const result = await ctx.runMutation(
          internal.meyoo.admin.resetMembersBatch,
          {
            organizationId: args.organizationId,
            cursor,
            batchSize: RESET_MEMBER_BATCH_SIZE,
          },
        );

        usersUpdated += result.updated;
        hasMore = result.hasMore;
        cursor = result.cursor;
      }
    };

    // Shopify data: delete child tables before parents to avoid dangling references
    for (const table of [
      "shopifyOrderItems",
      "shopifyTransactions",
      "shopifyRefunds",
      "shopifyFulfillments",
      "shopifyInventory",
      "shopifyInventoryTotals",
      "inventoryProductSummaries",
      "inventoryOverviewSummaries",
      "shopifyProductVariants",
      "shopifyProducts",
      "shopifyOrders",
      "shopifyCustomers",
      "customerMetricsSummaries",
      "customerOverviewSummaries",
      "shopifySessions",
      "shopifyAnalytics",
      "shopifyStores",
    ] satisfies OrgScopedTable[]) {
      await deleteTable(table);
    }

    // Meta integrations
    for (const table of ["metaAdAccounts", "metaInsights"] satisfies OrgScopedTable[]) {
      await deleteTable(table);
    }

    await deleteTable("integrationSessions");

    // Sync and scheduling state
    for (const table of ["syncProfiles", "syncSessions"] satisfies OrgScopedTable[]) {
      await deleteTable(table);
    }

    // Cost tracking and analytics tables
    for (const table of [
      "globalCosts",
      "manualReturnRates",
      "variantCosts",
      "dailyMetrics",
    ] satisfies OrgScopedTable[]) {
      await deleteTable(table);
    }

    // Dashboard and compliance data
    for (const table of ["dashboards", "gdprRequests"] satisfies OrgScopedTable[]) {
      await deleteTable(table);
    }

    // Notifications and billing history
    await deleteTable("notifications");
    await deleteTable("billing");

    // Tickets and responses
    await deleteTickets();

    // Reset users and onboarding state
    await resetMembers();

    return {
      success: true,
      deleted,
      usersUpdated,
    };
  },
});
