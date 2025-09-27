import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { optionalEnv } from "../utils/env";

const CONVEX_CLOUD_URL = optionalEnv("CONVEX_CLOUD_URL");

/**
 * Admin API
 * Administrative functions for system management
 */

/**
 * Check if user is admin
 */
function isAdmin(user: { role?: string }): boolean {
  if (!user.role) return false;

  return (
    user.role === "StoreOwner" ||
    user.role === "MeyooFounder" ||
    user.role === "MeyooTeam"
  );
}

const RESET_DEFAULT_BATCH_SIZE = 200;
const RESET_MAX_BATCH_SIZE = 500;
const RESET_MEMBER_BATCH_SIZE = 25;
const RESET_TICKET_BATCH_SIZE = 10;

const ORG_SCOPED_TABLES = [
  "metricsDaily",
  "metricsWeekly",
  "metricsMonthly",
  "productMetrics",
  "customerMetrics",
  "realtimeMetrics",
  "shopifyOrderItems",
  "shopifyTransactions",
  "shopifyRefunds",
  "shopifyFulfillments",
  "shopifyInventory",
  "shopifyProductVariants",
  "shopifyProducts",
  "shopifyOrders",
  "shopifyCustomers",
  "shopifyStores",
  "shopifySessions",
  "shopifyAnalytics",
  "integrationSessions",
  "metaAdAccounts",
  "metaInsights",
  "syncProfiles",
  "syncSessions",
  "costs",
  "costCategories",
  "productCostComponents",
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
          onboardingData: {
            completedSteps: [],
            setupDate: new Date().toISOString(),
          },
          updatedAt: Date.now(),
        });
      }

      await ctx.db.patch(member._id, {
        isOnboarded: false,
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
 * Recalculate analytics for an organization
 * Admin function to trigger analytics recalculation
 */
export const recalculateAnalytics = action({
  args: {
    daysBack: v.optional(v.number()), // Number of days to recalculate (default 30)
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    metricsCalculated: number;
    duration: number;
    message: string;
  }> => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.meyoo.admin.getUserById, {
      userId,
    });

    if (!user || !user.organizationId) {
      throw new Error("User not found or no organization");
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(startDate.getDate() - (args.daysBack || 30));

    // production: avoid noisy admin logs

    // Trigger analytics calculation
    const result = await ctx.runAction(
      internal.engine.analytics.calculateAnalytics,
      {
        organizationId: user.organizationId,
        dateRange: {
          startDate: startDate.toISOString().substring(0, 10),
          endDate: endDate.toISOString().substring(0, 10),
        },
      },
    );

    return {
      success: result.success,
      metricsCalculated: result.metricsCalculated,
      duration: result.duration,
      message: `Analytics recalculated for ${result.metricsCalculated} days in ${result.duration}ms`,
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
 * Get system statistics
 */
export const getSystemStats = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      totalUsers: v.number(),
      totalOrganizations: v.number(),
      totalSyncs: v.number(),
      totalOrders: v.number(),
      activeSyncs: v.number(),
      failedSyncs: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      return null;
    }

    // Get system-wide statistics
    const [users, organizations, syncSessions, orders] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db
        .query("users")
        .collect()
        .then(
          (users) =>
            new Set(
              users
                .filter((u) => u.organizationId !== null)
                .map((u) => u.organizationId),
            ).size,
        ),
      ctx.db.query("syncSessions").collect(),
      ctx.db.query("shopifyOrders").collect(),
    ]);

    return {
      totalUsers: users.length,
      totalOrganizations: organizations,
      totalSyncs: syncSessions.length,
      totalOrders: orders.length,
      activeSyncs: syncSessions.filter((s) => s.status === "syncing").length,
      failedSyncs: syncSessions.filter((s) => s.status === "failed").length,
    };
  },
});

/**
 * Get organizations list
 */
export const getOrganizations = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      plan: v.string(),
      createdAt: v.number(),
      memberCount: v.number(),
      owner: v.union(
        v.null(),
        v.object({
          id: v.id("users"),
          name: v.optional(v.string()),
          email: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      return [];
    }

    // Get all users grouped by organization
    const allUsers = await ctx.db.query("users").collect();

    // Group by organization
    const orgMap = new Map<
      string,
      {
        id: string;
        name: string;
        plan: string;
        createdAt: number;
        memberCount: number;
        owner: null | {
          id: Id<"users">;
          name?: string;
          email: string;
        };
      }
    >();

    // Get all organizations first
    const allOrgs = await ctx.db.query("organizations").collect();
    const orgDetailsMap = new Map(allOrgs.map((o) => [o._id, o]));

    allUsers.forEach((u) => {
      if (!u.organizationId) return;

      const orgDetails = orgDetailsMap.get(u.organizationId);

      if (!orgMap.has(u.organizationId)) {
        orgMap.set(u.organizationId, {
          id: u.organizationId,
          name: orgDetails?.name || "Unnamed Organization",
          plan: "free", // Default, will be updated from billing table
          createdAt: u._creationTime,
          memberCount: 0,
          owner: null,
        });
      }

      const org = orgMap.get(u.organizationId);

      if (org) {
        org.memberCount++;

        if (u.role === "StoreOwner") {
          org.owner = {
            id: u._id,
            name: u.name || "",
            email: u.email || "",
          };
        }
      }
    });

    let organizations = Array.from(orgMap.values());

    // Fetch billing info for all organizations
    const billingRecords = await ctx.db.query("billing").collect();
    const billingMap = new Map(
      billingRecords.map((b) => [
        b.organizationId,
        b.shopifyBilling?.plan ?? "free",
      ]),
    );

    // Update plans from billing table
    organizations.forEach((org) => {
      const billingPlan = billingMap.get(org.id as Id<"organizations">);

      if (billingPlan) {
        org.plan = billingPlan;
      }
    });

    // Apply search filter
    if (args.search) {
      const searchLower = args.search.toLowerCase();

      organizations = organizations.filter(
        (org) =>
          org.name.toLowerCase().includes(searchLower) ||
          org.owner?.email?.toLowerCase().includes(searchLower),
      );
    }

    // Sort by creation date (newest first)
    organizations.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    if (args.limit) {
      organizations = organizations.slice(0, args.limit);
    }

    return organizations;
  },
});

/**
 * Get error logs
 */
export const getErrorLogs = query({
  args: {
    limit: v.optional(v.number()),
    platform: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      id: v.id("syncSessions"),
      organizationId: v.id("organizations"),
      platform: v.string(),
      syncType: v.string(),
      error: v.optional(v.string()),
      timestamp: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      return [];
    }

    // Get failed sync sessions
    const query = ctx.db
      .query("syncSessions")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc");

    const sessions = await query.take(args.limit || 100);

    // Filter by platform if specified
    let filtered = sessions;

    if (args.platform) {
      filtered = filtered.filter((s) => s.platform === args.platform);
    }

    return filtered.map((session) => ({
      id: session._id,
      organizationId: session.organizationId,
      platform: session.platform,
      syncType: session.type || "incremental",
      error: session.error,
      timestamp: session.startedAt,
    }));
  },
});

/**
 * Force sync for organization
 */
export const forceSyncForOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    platforms: v.array(v.string()),
  },
  returns: v.object({ success: v.boolean(), sessionId: v.string() }),
  handler: async () => ({ success: false, sessionId: "" }),
});

/**
 * Update organization plan
 */
export const updateOrganizationPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("growth"),
      v.literal("business"),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    updatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

    // Update billing record
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (billing) {
      await ctx.db.patch(billing._id, {
        shopifyBilling: {
          plan: args.plan,
          isActive: true,
        },
        isPremium: args.plan !== "free",
        updatedAt: Date.now(),
      });
    } else {
      // Create billing if doesn't exist
      await ctx.db.insert("billing", {
        organizationId: args.organizationId,
        organizationType: "shopify_app",
        shopifyBilling: {
          plan: args.plan,
          isActive: true,
        },
        isPremium: args.plan !== "free",
        billingCycle: "monthly",
        status: "active",
        createdAt: Date.now(),
      });
    }

    return {
      success: true,
      updatedCount: 1, // Only billing record updated
    };
  },
});

/**
 * Clear cache for organization
 */
export const clearOrganizationCache = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    success: v.boolean(),
    clearedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

    // Clear realtime metrics cache
    const realtimeMetrics = await ctx.db
      .query("realtimeMetrics")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const metric of realtimeMetrics) {
      await ctx.db.delete(metric._id);
    }

    return {
      success: true,
      clearedCount: realtimeMetrics.length,
    };
  },
});

/**
 * Get job queue status
 */
export const getJobQueueStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      total: v.number(),
      pending: v.number(),
      processing: v.number(),
      completed: v.number(),
      failed: v.number(),
      avgProcessingTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      return null;
    }

    // Queue tables trimmed; return zeros for now
    return {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      avgProcessingTime: 0,
    };
  },
});

/**
 * Clear analytics cache
 */
export const clearAnalyticsCache = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    cacheType: v.optional(
      v.union(v.literal("realtime"), v.literal("daily"), v.literal("all")),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    clearedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

    let clearedCount = 0;
    const cacheType = args.cacheType || "all";

    // Clear realtime metrics cache
    if (cacheType === "realtime" || cacheType === "all") {
      const realtimeMetrics = args.organizationId
        ? await ctx.db
            .query("realtimeMetrics")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId!),
            )
            .collect()
        : await ctx.db.query("realtimeMetrics").collect();

      for (const metric of realtimeMetrics) {
        await ctx.db.delete(metric._id);
        clearedCount++;
      }
    }

    // Clear daily metrics cache if requested
    if (cacheType === "daily" || cacheType === "all") {
      const dailyMetrics = args.organizationId
        ? await ctx.db
            .query("metricsDaily")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId!),
            )
            .collect()
        : await ctx.db.query("metricsDaily").collect();

      for (const metric of dailyMetrics) {
        await ctx.db.delete(metric._id);
        clearedCount++;
      }
    }

    return {
      success: true,
      clearedCount,
    };
  },
});

/**
 * Reset test data for development
 */
export const resetTestData = mutation({
  args: {
    organizationId: v.id("organizations"),
    dataTypes: v.array(
      v.union(
        v.literal("orders"),
        v.literal("products"),
        v.literal("customers"),
        v.literal("analytics"),
        v.literal("sync_sessions"),
        v.literal("all"),
      ),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    deletedCounts: v.object({
      orders: v.number(),
      products: v.number(),
      customers: v.number(),
      analytics: v.number(),
      syncSessions: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

    // Safety check - only allow for non-production environments
    if (CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    const deletedCounts = {
      orders: 0,
      products: 0,
      customers: 0,
      analytics: 0,
      syncSessions: 0,
    };

    const shouldDelete = (
      dataType:
        | "orders"
        | "products"
        | "customers"
        | "analytics"
        | "sync_sessions"
        | "all",
    ) => args.dataTypes.includes("all") || args.dataTypes.includes(dataType);

    // Delete Shopify orders
    if (shouldDelete("orders")) {
      const orders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const order of orders) {
        await ctx.db.delete(order._id);
        deletedCounts.orders++;
      }
    }

    // Delete Shopify products
    if (shouldDelete("products")) {
      const products = await ctx.db
        .query("shopifyProducts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const product of products) {
        await ctx.db.delete(product._id);
        deletedCounts.products++;
      }
    }

    // Delete Shopify customers
    if (shouldDelete("customers")) {
      const customers = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const customer of customers) {
        await ctx.db.delete(customer._id);
        deletedCounts.customers++;
      }
    }

    // Delete analytics data
    if (shouldDelete("analytics")) {
      const analyticsTables = [
        "metricsDaily",
        "realtimeMetrics",
        "productMetrics",
        "customerMetrics",
      ];

      for (const tableName of analyticsTables) {
        const records = await ctx.db
          .query(
            tableName as
              | "metricsDaily"
              | "realtimeMetrics"
              | "productMetrics"
              | "customerMetrics",
          )
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .collect();

        for (const record of records) {
          await ctx.db.delete(record._id);
          deletedCounts.analytics++;
        }
      }
    }

    // Delete sync sessions
    if (shouldDelete("sync_sessions")) {
      const syncSessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const session of syncSessions) {
        await ctx.db.delete(session._id);
        deletedCounts.syncSessions++;
      }
    }

    return {
      success: true,
      deletedCounts,
    };
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
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.meyoo.admin.getUserById, {
      userId,
    });

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

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
      customers: v.number(),
      metafields: v.number(),
      webhookLogs: v.number(),
      integrationSessions: v.number(),
      billingReset: v.boolean(),
      usersUpdated: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.meyoo.admin.getUserById, {
      userId,
    });

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

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
    await deleteTableWithCount("shopifyProductVariants", "variants");
    await deleteTableWithCount("shopifyProducts", "products");
    await deleteTableWithCount("shopifyOrders", "orders");
    await deleteTableWithCount("shopifyCustomers", "customers");
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
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.meyoo.admin.getUserById, {
      userId,
    });

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

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
      "shopifyProductVariants",
      "shopifyProducts",
      "shopifyOrders",
      "shopifyCustomers",
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

    // Analytics data caches
    for (const table of [
      "metricsDaily",
      "metricsWeekly",
      "metricsMonthly",
      "productMetrics",
      "customerMetrics",
      "realtimeMetrics",
    ] satisfies OrgScopedTable[]) {
      await deleteTable(table);
    }

    // Sync and scheduling state
    for (const table of ["syncProfiles", "syncSessions"] satisfies OrgScopedTable[]) {
      await deleteTable(table);
    }

    // Cost tracking tables
    for (const table of [
      "costs",
      "costCategories",
      "productCostComponents",
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
