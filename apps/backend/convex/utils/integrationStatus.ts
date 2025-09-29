import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type DbCtx = Pick<QueryCtx, "db">;

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

export const integrationStatusValidator = v.object({
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
});

export type IntegrationStatus = {
  shopify: {
    connected: boolean;
    initialSynced: boolean;
    stages: ReturnType<typeof stageComplete>;
    lastInitialCompletedAt?: number;
    lastSyncAt?: number;
    expectedOrders?: number;
    ordersInDb?: number;
  };
  meta: {
    connected: boolean;
    initialSynced: boolean;
    lastInitialCompletedAt?: number;
    lastSyncAt?: number;
  };
  analytics: {
    ready: boolean;
    lastCalculatedAt?: number;
  };
};

export const emptyIntegrationStatus = (): IntegrationStatus => ({
  shopify: {
    connected: false,
    initialSynced: false,
    stages: { products: false, inventory: false, customers: false, orders: false },
  },
  meta: {
    connected: false,
    initialSynced: false,
  },
  analytics: { ready: false },
});

export async function computeIntegrationStatus(
  ctx: DbCtx,
  organizationId: Id<"organizations">,
): Promise<IntegrationStatus> {
  const shopifyStore = await ctx.db
    .query("shopifyStores")
    .withIndex("by_organization_and_active", (q) =>
      q.eq("organizationId", organizationId).eq("isActive", true),
    )
    .first();

  const metaSession = await ctx.db
    .query("integrationSessions")
    .withIndex("by_org_platform_and_status", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("platform", "meta")
        .eq("isActive", true),
    )
    .first();

  const latestShopify = await ctx.db
    .query("syncSessions")
    .withIndex("by_org_platform_and_date", (q) =>
      q.eq("organizationId", organizationId).eq("platform", "shopify"),
    )
    .order("desc")
    .take(10);

  const latestMeta = await ctx.db
    .query("syncSessions")
    .withIndex("by_org_platform_and_date", (q) =>
      q.eq("organizationId", organizationId).eq("platform", "meta"),
    )
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
    const windowMs = 60 * 24 * 60 * 60 * 1000;
    const since = Date.now() - windowMs;
    const target = Math.max(0, expectedOrders - 2);

    const limit = Math.min(Math.max(target + 5, 500), 5000);
    const slice = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q.eq("organizationId", organizationId).gte("shopifyCreatedAt", since),
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

  const recentOrder = await ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization_and_created", (q) =>
      q.eq("organizationId", organizationId),
    )
    .order("desc")
    .first();

  const recentInsight = await ctx.db
    .query("metaInsights")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .first();

  const onboarding = await ctx.db
    .query("onboarding")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();

  const analyticsReady = Boolean(
    (recentOrder || recentInsight || onboarding?.onboardingData?.analyticsTriggeredAt) &&
      (shopifyStore ? shopifyInitialComplete : true),
  );

  const lastCalculatedAt = Math.max(
    recentOrder?.syncedAt ?? 0,
    recentInsight?.syncedAt ?? 0,
    onboarding?.onboardingData?.analyticsTriggeredAt ?? 0,
  );

  return {
    shopify: {
      connected: Boolean(shopifyStore),
      initialSynced: shopifyInitialComplete,
      stages,
      lastInitialCompletedAt:
        initialShopify?.status === "completed" ? initialShopify.completedAt : undefined,
      lastSyncAt: latestShopify[0]?.completedAt ?? latestShopify[0]?.startedAt,
      expectedOrders,
      ordersInDb: ordersInDb || undefined,
    },
    meta: {
      connected: Boolean(metaSession),
      initialSynced: metaInitialComplete,
      lastInitialCompletedAt:
        initialMeta?.status === "completed" ? initialMeta.completedAt : undefined,
      lastSyncAt: latestMeta[0]?.completedAt ?? latestMeta[0]?.startedAt,
    },
    analytics: {
      ready: analyticsReady,
      lastCalculatedAt: lastCalculatedAt || undefined,
    },
  };
}
