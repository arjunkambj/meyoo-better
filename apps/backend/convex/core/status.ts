import { v } from "convex/values";
import { query, internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getUserAndOrg } from "../utils/auth";

const isInitialSyncSession = (s: Doc<"syncSessions">): boolean =>
  s.type === "initial" || (s.metadata as any)?.isInitialSync === true;

function stageComplete(meta?: Record<string, unknown>): {
  products: boolean;
  inventory: boolean;
  customers: boolean;
  orders: boolean;
} {
  const st = (meta?.stageStatus || {}) as Record<string, string> | undefined;
  return {
    products: st?.products === "completed",
    inventory: st?.inventory === "completed",
    customers: st?.customers === "completed",
    orders: st?.orders === "completed",
  };
}

export const getIntegrationStatus = query({
  args: {},
  returns: v.object({
    shopify: v.object({
      connected: v.boolean(),
      initialSynced: v.boolean(),
      stages: v.object({
        products: v.boolean(),
        inventory: v.boolean(),
        customers: v.boolean(),
        orders: v.boolean(),
      }),
      lastInitialCompletedAt: v.optional(v.number()),
      lastSyncAt: v.optional(v.number()),
      expectedOrders: v.optional(v.number()),
      ordersInDb: v.optional(v.number()),
    }),
    meta: v.object({
      connected: v.boolean(),
      initialSynced: v.boolean(),
      lastInitialCompletedAt: v.optional(v.number()),
      lastSyncAt: v.optional(v.number()),
    }),
    analytics: v.object({
      ready: v.boolean(),
      lastCalculatedAt: v.optional(v.number()),
    }),
  }),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      // Anonymous callers get a blank status
      return {
        shopify: {
          connected: false,
          initialSynced: false,
          stages: { products: false, inventory: false, customers: false, orders: false },
          lastInitialCompletedAt: undefined,
          lastSyncAt: undefined,
        },
        meta: {
          connected: false,
          initialSynced: false,
          lastInitialCompletedAt: undefined,
          lastSyncAt: undefined,
        },
        analytics: { ready: false, lastCalculatedAt: undefined },
      } as const;
    }
    const { orgId } = auth;

    // Connections
    const shopifyStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q.eq("organizationId", orgId as Id<"organizations">).eq("isActive", true),
      )
      .first();
    const metaSession = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", orgId as Id<"organizations">)
          .eq("platform", "meta")
          .eq("isActive", true),
      )
      .first();

    // Latest sync sessions
    const latestShopify = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q.eq("organizationId", orgId as Id<"organizations">).eq("platform", "shopify"),
      )
      .order("desc")
      .take(10);
    const latestMeta = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q.eq("organizationId", orgId as Id<"organizations">).eq("platform", "meta"),
      )
      .order("desc")
      .take(10);

    const initialShopify = latestShopify.find(isInitialSyncSession);
    const initialMeta = latestMeta.find(isInitialSyncSession);

    const stages = stageComplete((initialShopify?.metadata || {}) as any);

    // Heuristic: if DB already contains the expected number of orders for the initial window, treat as complete
    const expectedOrders =
      (initialShopify?.metadata as any)?.totalOrdersSeen ??
      (initialShopify?.metadata as any)?.ordersQueued ??
      undefined;
    let dbHasExpectedOrders = false;
    let ordersInDb = 0;
    if (typeof expectedOrders === "number" && expectedOrders > 0) {
      const windowMs = 60 * 24 * 60 * 60 * 1000; // 60 days
      const since = Date.now() - windowMs;
      const target = Math.max(0, expectedOrders - 2); // allow small slack

      // Avoid paginate() to comply with Convex query limits; take a bounded slice
      const limit = Math.min(Math.max(target + 5, 500), 5000);
      const slice = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", orgId as Id<"organizations">)
            .gte("shopifyCreatedAt", since),
        )
        .order("desc")
        .take(limit);
      ordersInDb = slice.length;
      dbHasExpectedOrders = ordersInDb >= target;
    }

    const shopifyInitialComplete = Boolean(
      initialShopify &&
        (initialShopify.status === "completed" ||
          dbHasExpectedOrders ||
          (stages.products && stages.inventory && stages.customers && stages.orders) ||
          (typeof (initialShopify.metadata as any)?.ordersQueued === "number" &&
            typeof (initialShopify.metadata as any)?.ordersProcessed === "number" &&
            (initialShopify.metadata as any).ordersProcessed >=
              (initialShopify.metadata as any).ordersQueued)),
    );
    const metaInitialComplete = Boolean(
      initialMeta && initialMeta.status === "completed",
    );

    // Analytics readiness: presence of computed metrics or onboarding analyticsTriggeredAt
    const anyMetrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId as Id<"organizations">))
      .first();
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId as Id<"organizations">))
      .first();
    const analyticsReady = Boolean(
      (anyMetrics || onboarding?.onboardingData?.analyticsTriggeredAt) &&
        // Only consider analytics "ready" if Shopify is initial-synced when connected
        (shopifyStore ? shopifyInitialComplete : true),
    );

    return {
      shopify: {
        connected: Boolean(shopifyStore),
        initialSynced: shopifyInitialComplete,
        stages,
        lastInitialCompletedAt: initialShopify?.status === "completed" ? initialShopify.completedAt : undefined,
        lastSyncAt: latestShopify[0]?.completedAt ?? latestShopify[0]?.startedAt,
        expectedOrders,
        ordersInDb: ordersInDb || undefined,
      },
      meta: {
        connected: Boolean(metaSession),
        initialSynced: metaInitialComplete,
        lastInitialCompletedAt: initialMeta?.status === "completed" ? initialMeta.completedAt : undefined,
        lastSyncAt: latestMeta[0]?.completedAt ?? latestMeta[0]?.startedAt,
      },
      analytics: {
        ready: analyticsReady,
        lastCalculatedAt: anyMetrics?.updatedAt,
      },
    } as const;
  },
});

// Optional: snapshot writer to cache status in integrationStatus table
export const refreshIntegrationStatus = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    // Compute via the query logic above by calling it internally is not available here; re‑implement minimal bits
    const orgId = args.organizationId;

    const shopifyStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) => q.eq("organizationId", orgId).eq("isActive", true))
      .first();
    const metaSession = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) => q.eq("organizationId", orgId).eq("platform", "meta").eq("isActive", true))
      .first();

    const latestShopify = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) => q.eq("organizationId", orgId).eq("platform", "shopify"))
      .order("desc")
      .take(10);
    const latestMeta = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) => q.eq("organizationId", orgId).eq("platform", "meta"))
      .order("desc")
      .take(10);

    const initialShopify = latestShopify.find(isInitialSyncSession);
    const initialMeta = latestMeta.find(isInitialSyncSession);

    const stages = stageComplete((initialShopify?.metadata || {}) as any);
    const expectedOrders =
      (initialShopify?.metadata as any)?.totalOrdersSeen ??
      (initialShopify?.metadata as any)?.ordersQueued ??
      undefined;
    let dbHasExpectedOrders = false;
    let ordersInDb = 0;
    if (typeof expectedOrders === "number" && expectedOrders > 0) {
      const windowMs = 60 * 24 * 60 * 60 * 1000; // 60 days
      const since = Date.now() - windowMs;
      const target = Math.max(0, expectedOrders - 2);
      const limit = Math.min(Math.max(target + 5, 500), 5000);
      const slice = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q.eq("organizationId", orgId).gte("shopifyCreatedAt", since),
        )
        .order("desc")
        .take(limit);
      ordersInDb = slice.length;
      dbHasExpectedOrders = ordersInDb >= target;
    }
    const shopifyInitialComplete = Boolean(
      initialShopify &&
        (initialShopify.status === "completed" ||
          dbHasExpectedOrders ||
          (stages.products && stages.inventory && stages.customers && stages.orders) ||
          (typeof (initialShopify.metadata as any)?.ordersQueued === "number" &&
            typeof (initialShopify.metadata as any)?.ordersProcessed === "number" &&
            (initialShopify.metadata as any).ordersProcessed >=
              (initialShopify.metadata as any).ordersQueued)),
    );
    const metaInitialComplete = Boolean(
      initialMeta && initialMeta.status === "completed",
    );

    const anyMetrics = await ctx.db
      .query("metricsDaily")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    const existing = await ctx.db
      .query("integrationStatus")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    const payload = {
      organizationId: orgId,
      shopify: {
        connected: Boolean(shopifyStore),
        initialSynced: shopifyInitialComplete,
        stages,
        lastInitialCompletedAt: initialShopify?.status === "completed" ? initialShopify.completedAt : undefined,
        lastSyncAt: latestShopify[0]?.completedAt ?? latestShopify[0]?.startedAt,
        expectedOrders,
        ordersInDb: ordersInDb || undefined,
      },
      meta: {
        connected: Boolean(metaSession),
        initialSynced: metaInitialComplete,
        lastInitialCompletedAt: initialMeta?.status === "completed" ? initialMeta.completedAt : undefined,
        lastSyncAt: latestMeta[0]?.completedAt ?? latestMeta[0]?.startedAt,
      },
      analytics: {
        ready: Boolean(anyMetrics && (shopifyStore ? shopifyInitialComplete : true)),
        lastCalculatedAt: anyMetrics?.updatedAt,
      },
      updatedAt: Date.now(),
    } as const;

    if (existing) {
      await ctx.db.patch(existing._id, payload as any);
    } else {
      await ctx.db.insert("integrationStatus", payload as any);
    }

    return { ok: true } as const;
  },
});
