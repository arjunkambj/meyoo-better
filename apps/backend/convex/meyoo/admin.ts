import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalQuery, mutation, query } from "../_generated/server";

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
        v.literal("sync_history"),
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
      syncHistory: v.number(),
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
    if (process.env.CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    const deletedCounts = {
      orders: 0,
      products: 0,
      customers: 0,
      analytics: 0,
      syncHistory: 0,
    };

    const shouldDelete = (
      dataType:
        | "orders"
        | "products"
        | "customers"
        | "analytics"
        | "sync_history"
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
        "channelMetrics",
      ];

      for (const tableName of analyticsTables) {
        const records = await ctx.db
          .query(
            tableName as
              | "metricsDaily"
              | "realtimeMetrics"
              | "productMetrics"
              | "customerMetrics"
              | "channelMetrics",
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

    // Delete sync history
    if (shouldDelete("sync_history")) {
      const syncSessions = await ctx.db
        .query("syncSessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const session of syncSessions) {
        await ctx.db.delete(session._id);
        deletedCounts.syncHistory++;
      }

      // Also delete sync history records by index
      const syncHistory = await ctx.db
        .query("syncHistory")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const history of syncHistory) {
        await ctx.db.delete(history._id);
        deletedCounts.syncHistory++;
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
export const resetMetaData = mutation({
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
      activityLogs: v.number(),
      usersUpdated: v.number(),
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

    if (process.env.CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    let metaAdAccounts = 0;
    const metaCampaigns = 0;
    const metaAds = 0;
    let metaInsights = 0;
    let integrationSessions = 0;
    const webhookLogs = 0;
    let activityLogs = 0;
    let usersUpdated = 0;

    // Delete Meta ad accounts
    const accounts = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const a of accounts) {
      await ctx.db.delete(a._id);
      metaAdAccounts++;
    }

    // Delete Meta campaigns (table not present in schema) -> keep counter at 0
    // Delete Meta ads (table not present in schema) -> keep counter at 0

    // Delete Meta insights
    const insights = await ctx.db
      .query("metaInsights")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const i of insights) {
      await ctx.db.delete(i._id);
      metaInsights++;
    }

    // Webhook logs removed

    // Delete activity logs
    const activities = await (ctx.db.query as any)("userActivity")
      .withIndex("by_organization", (q: any) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const a of activities) {
      // Filter for Meta-related activities
      if (a.metadata?.platform === "meta" || a.action?.includes("meta")) {
        await ctx.db.delete(a._id);
        activityLogs++;
      }
    }

    // Remove/disable integration sessions for Meta
    const sessions = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_and_platform", (q) =>
        q.eq("organizationId", args.organizationId).eq("platform", "meta"),
      )
      .collect();

    for (const s of sessions) {
      await ctx.db.delete(s._id);
      integrationSessions++;
    }

    // Update user flags in the organization
    const members = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const m of members) {
      // Update onboarding record instead of user
      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", m._id).eq("organizationId", args.organizationId),
        )
        .first();

      if (onboarding) {
        await ctx.db.patch(onboarding._id, {
          hasMetaConnection: false,
          updatedAt: Date.now(),
        });
      }

      await ctx.db.patch(m._id, {
        isOnboarded: true,
        updatedAt: Date.now(),
      });
      usersUpdated++;
    }

    // NOTE: NOT deleting or modifying billing record per requirements

    return {
      success: true,
      deletedCounts: {
        metaAdAccounts,
        metaCampaigns,
        metaAds,
        metaInsights,
        integrationSessions,
        webhookLogs,
        activityLogs,
        usersUpdated,
      },
    };
  },
});

/**
 * Reset Shopify data for an organization and update user flags
 */
export const resetShopifyData = mutation({
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
      activityLogs: v.number(),
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

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

    if (process.env.CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    let stores = 0;
    let orders = 0;
    let orderItems = 0;
    let refunds = 0;
    let transactions = 0;
    let fulfillments = 0;
    let products = 0;
    let variants = 0;
    let inventory = 0;
    let customers = 0;
    const metafields = 0;
    const webhookLogs = 0;
    let activityLogs = 0;
    let integrationSessions = 0;
    let billingReset = false;
    let usersUpdated = 0;

    // Load orders by organization and delete children first
    const orderList = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const order of orderList) {
      // delete order items
      const items = await ctx.db
        .query("shopifyOrderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const item of items) {
        await ctx.db.delete(item._id);
        orderItems++;
      }

      // delete refunds
      const orderRefunds = await ctx.db
        .query("shopifyRefunds")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const r of orderRefunds) {
        await ctx.db.delete(r._id);
        refunds++;
      }

      // delete transactions
      const orderTxs = await ctx.db
        .query("shopifyTransactions")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const t of orderTxs) {
        await ctx.db.delete(t._id);
        transactions++;
      }

      // delete fulfillments
      const orderFfs = await ctx.db
        .query("shopifyFulfillments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const f of orderFfs) {
        await ctx.db.delete(f._id);
        fulfillments++;
      }

      // delete order itself
      await ctx.db.delete(order._id);
      orders++;
    }

    // Delete products and variants (and variant inventory)
    const productList = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const p of productList) {
      const productVariants = await ctx.db
        .query("shopifyProductVariants")
        .withIndex("by_product", (q) => q.eq("productId", p._id))
        .collect();

      for (const v of productVariants) {
        // delete inventory per variant
        const inv = await ctx.db
          .query("shopifyInventory")
          .withIndex("by_variant", (q) => q.eq("variantId", v._id))
          .collect();

        for (const iv of inv) {
          await ctx.db.delete(iv._id);
          inventory++;
        }

        await ctx.db.delete(v._id);
        variants++;
      }

      await ctx.db.delete(p._id);
      products++;
    }

    // Delete any remaining inventory by organization (safety)
    const invByOrg = await ctx.db
      .query("shopifyInventory")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const iv of invByOrg) {
      await ctx.db.delete(iv._id);
      inventory++;
    }

    // Delete customers
    const customersList = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const c of customersList) {
      await ctx.db.delete(c._id);
      customers++;
    }

    // Delete shopifyMetafields (table not present in schema) -> keep counter at 0

    // Delete stores last
    const storesList = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const s of storesList) {
      await ctx.db.delete(s._id);
      stores++;
    }

    // Webhook logs removed

    // Delete activity logs
    const activities = await (ctx.db.query as any)("userActivity")
      .withIndex("by_organization", (q: any) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const a of activities) {
      // Filter for Shopify-related activities
      if (a.metadata?.platform === "shopify" || a.action?.includes("shopify")) {
        await ctx.db.delete(a._id);
        activityLogs++;
      }
    }

    // Remove integration sessions for Shopify
    const sessions = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_and_platform", (q) =>
        q.eq("organizationId", args.organizationId).eq("platform", "shopify"),
      )
      .collect();

    for (const s of sessions) {
      await ctx.db.delete(s._id);
      integrationSessions++;
    }

    // Update user flags in the organization
    const members = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const m of members) {
      // Update onboarding record instead of user
      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", m._id).eq("organizationId", args.organizationId),
        )
        .first();

      if (onboarding) {
        await ctx.db.patch(onboarding._id, {
          hasShopifyConnection: false,
          hasShopifySubscription: false,
          isProductCostSetup: false,
          isExtraCostSetup: false,
          // Also mark other integrations disconnected as requested
          hasMetaConnection: false,
          hasGoogleConnection: false,
          updatedAt: Date.now(),
        });
      }

      await ctx.db.patch(m._id, {
        updatedAt: Date.now(),
      });
      usersUpdated++;
    }

    // Delete billing record to require billing on reinstall/reconnect
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (billing) {
      await ctx.db.delete(billing._id);
    }

    // Do not recreate billing here; leave org without a plan so reinstall goes through billing step
    billingReset = true;

    return {
      success: true,
      deletedCounts: {
        stores,
        orders,
        orderItems,
        refunds,
        transactions,
        fulfillments,
        products,
        variants,
        inventory,
        customers,
        metafields,
        webhookLogs,
        activityLogs,
        integrationSessions,
        billingReset,
        usersUpdated,
      },
    };
  },
});

/**
 * Reset everything for an organization: wipe most org-scoped data and reset users to initial state.
 * Keeps organizationId, but sets onboarding to false and clears integration flags.
 */
export const resetEverything = mutation({
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

    const user = await ctx.db.get(userId);

    if (!user || !isAdmin(user)) {
      throw new Error("Admin access required");
    }

    if (process.env.CONVEX_CLOUD_URL?.includes("prod")) {
      throw new Error("Cannot reset data in production environment");
    }

    let deleted = 0;

    // Helper to delete all records from a table by organizationId using indexes only
    async function deleteByOrg(table: string) {
      switch (table) {
        case "metricsDaily": {
          const rows = await ctx.db
            .query("metricsDaily")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "metricsWeekly": {
          const rows = await ctx.db
            .query("metricsWeekly")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "metricsMonthly": {
          const rows = await ctx.db
            .query("metricsMonthly")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "productMetrics": {
          const rows = await ctx.db
            .query("productMetrics")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "channelMetrics": {
          const rows = await ctx.db
            .query("channelMetrics")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "customerMetrics": {
          const rows = await ctx.db
            .query("customerMetrics")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "realtimeMetrics": {
          const rows = await ctx.db
            .query("realtimeMetrics")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "shopifyCustomers": {
          const rows = await ctx.db
            .query("shopifyCustomers")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "shopifyOrders": {
          const rows = await ctx.db
            .query("shopifyOrders")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "shopifyStores": {
          const rows = await ctx.db
            .query("shopifyStores")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "shopifyProducts": {
          const rows = await ctx.db
            .query("shopifyProducts")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "metaAdAccounts": {
          const rows = await ctx.db
            .query("metaAdAccounts")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "metaInsights": {
          const rows = await ctx.db
            .query("metaInsights")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "syncSessions": {
          const rows = await ctx.db
            .query("syncSessions")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "costs": {
          const rows = await ctx.db
            .query("costs")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        case "costCategories": {
          const rows = await ctx.db
            .query("costCategories")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        // historicalCostDefaults removed (legacy)
        case "dashboards": {
          const rows = await ctx.db
            .query("dashboards")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", args.organizationId),
            )
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted++;
          }
          break;
        }
        default: {
          // Attempt generic deletion for org-scoped tables; ignore if table doesn't exist
          try {
            const rows = await (ctx.db.query as any)(table)
              .withIndex("by_organization", (q: any) =>
                q.eq("organizationId", args.organizationId),
              )
              .collect();
            for (const row of rows) {
              await ctx.db.delete(row._id);
              deleted++;
            }
          } catch (_e) {
            // no-op for unknown tables
          }
          break;
        }
      }
    }

    // Shopify deep delete
    {
      // orders and children
      const orderList = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const order of orderList) {
        const items = await ctx.db
          .query("shopifyOrderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();

        for (const item of items) {
          await ctx.db.delete(item._id);
          deleted++;
        }

        const orderRefunds = await ctx.db
          .query("shopifyRefunds")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();

        for (const r of orderRefunds) {
          await ctx.db.delete(r._id);
          deleted++;
        }

        const orderTxs = await ctx.db
          .query("shopifyTransactions")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();

        for (const t of orderTxs) {
          await ctx.db.delete(t._id);
          deleted++;
        }

        const orderFfs = await ctx.db
          .query("shopifyFulfillments")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();

        for (const f of orderFfs) {
          await ctx.db.delete(f._id);
          deleted++;
        }

        await ctx.db.delete(order._id);
        deleted++;
      }

      // products, variants, inventory
      const productList = await ctx.db
        .query("shopifyProducts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const p of productList) {
        const productVariants = await ctx.db
          .query("shopifyProductVariants")
          .withIndex("by_product", (q) => q.eq("productId", p._id))
          .collect();

        for (const v of productVariants) {
          const inv = await ctx.db
            .query("shopifyInventory")
            .withIndex("by_variant", (q) => q.eq("variantId", v._id))
            .collect();

          for (const iv of inv) {
            await ctx.db.delete(iv._id);
            deleted++;
          }
          await ctx.db.delete(v._id);
          deleted++;
        }
        await ctx.db.delete(p._id);
        deleted++;
      }

      const invByOrg = await ctx.db
        .query("shopifyInventory")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const iv of invByOrg) {
        await ctx.db.delete(iv._id);
        deleted++;
      }

      const customersList = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const c of customersList) {
        await ctx.db.delete(c._id);
        deleted++;
      }

      const storesList = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const s of storesList) {
        await ctx.db.delete(s._id);
        deleted++;
      }

      const shopifySessions = await ctx.db
        .query("integrationSessions")
        .withIndex("by_org_and_platform", (q) =>
          q.eq("organizationId", args.organizationId).eq("platform", "shopify"),
        )
        .collect();

      for (const s of shopifySessions) {
        await ctx.db.delete(s._id);
        deleted++;
      }
    }

    // Meta delete
    {
      const accounts = await ctx.db
        .query("metaAdAccounts")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const a of accounts) {
        await ctx.db.delete(a._id);
        deleted++;
      }
      const insights = await ctx.db
        .query("metaInsights")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();

      for (const i of insights) {
        await ctx.db.delete(i._id);
        deleted++;
      }
      const sessions = await ctx.db
        .query("integrationSessions")
        .withIndex("by_org_and_platform", (q) =>
          q.eq("organizationId", args.organizationId).eq("platform", "meta"),
        )
        .collect();

      for (const s of sessions) {
        await ctx.db.delete(s._id);
        deleted++;
      }
    }

    // Analytics and widgets
    await deleteByOrg("metricsDaily");
    await deleteByOrg("metricsWeekly");
    await deleteByOrg("metricsMonthly");
    // realtime cache only
    await deleteByOrg("realtimeMetrics");
    await deleteByOrg("productMetrics");
    await deleteByOrg("channelMetrics");
    await deleteByOrg("customerMetrics");
    await deleteByOrg("realtimeMetrics");
    await deleteByOrg("rfmSegments");
    await deleteByOrg("cohortAnalysis");
    await deleteByOrg("productProfitability");
    await deleteByOrg("inventoryMetrics");
    await deleteByOrg("returnAnalytics");
    await deleteByOrg("geographicMetrics");
    await deleteByOrg("predictiveMetrics");
    await deleteByOrg("marketBasketAnalysis");
    await deleteByOrg("customerJourneyMetrics");
    await deleteByOrg("metricWidgets");

    // Sync engine
    await deleteByOrg("syncProfiles");
    await deleteByOrg("syncSessions");
    await deleteByOrg("syncQueue");
    await deleteByOrg("syncHistory");
    await deleteByOrg("dataFreshness");

    // Rate limits by org+platform
    const ratePlatforms = ["shopify", "meta"];

    for (const p of ratePlatforms) {
      const rl = await ctx.db
        .query("rateLimits")
        .withIndex("by_org_platform", (q) =>
          q.eq("organizationId", args.organizationId).eq("platform", p),
        )
        .collect();

      for (const r of rl) {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }

    // Costs
    await deleteByOrg("costs");
    await deleteByOrg("costCategories");
    // historicalCostDefaults removed (legacy)
    await deleteByOrg("productCostComponents");

    // Dashboards
    await deleteByOrg("dashboards");

    // Security/ops logs (org-scoped only)
    await deleteByOrg("gdprRequests");

    // Webhook logs table removed; no-op cleanup retained for compatibility

    // Delete activity logs
    const activityLogs = await (ctx.db.query as any)("userActivity")
      .withIndex("by_organization", (q: any) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const a of activityLogs) {
      await ctx.db.delete(a._id);
      deleted++;
    }

    // Delete notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const n of notifications) {
      await ctx.db.delete(n._id);
      deleted++;
    }

    // Delete billing histories
    const billingHistories = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const b of billingHistories) {
      await ctx.db.delete(b._id);
      deleted++;
    }

    // Tickets
    // Delete tickets and their responses
    const tickets = await (ctx.db.query as any)("tickets")
      .withIndex("by_created", (q: any) => q.gte("createdAt", 0))
      .collect();

    for (const t of tickets) {
      if (t.organizationId === args.organizationId) {
        // Delete responses
      const responses = await (ctx.db.query as any)("ticketResponses")
        .withIndex("by_ticket", (q: any) => q.eq("ticketId", t._id))
        .collect();

        for (const r of responses) {
          await ctx.db.delete(r._id);
          deleted++;
        }
        await ctx.db.delete(t._id);
        deleted++;
      }
    }

    // Integration sessions for all platforms
    const allSessions = await ctx.db
      .query("integrationSessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    for (const s of allSessions) {
      await ctx.db.delete(s._id);
      deleted++;
    }

    // Delete and recreate billing record as free plan
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (billing) {
      await ctx.db.delete(billing._id);
      deleted++;
    }

    // Do not recreate billing here; leave org without a plan so billing step isn't skipped

    // Finally, reset all users in the organization to initial login state
    const members = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    let usersUpdated = 0;

    for (const m of members) {
      // Reset onboarding record instead of user fields
      const onboarding = await ctx.db
        .query("onboarding")
        .withIndex("by_user_organization", (q) =>
          q.eq("userId", m._id).eq("organizationId", args.organizationId),
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

      await ctx.db.patch(m._id, {
        // Keep organizationId as requested
        isOnboarded: false,
        updatedAt: Date.now(),
      });
      usersUpdated++;
    }

    return { success: true, deleted, usersUpdated };
  },
});
