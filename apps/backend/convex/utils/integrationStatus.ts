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

  // Only read a small recent window for sessions; we don't need large scans
  const latestShopify = await ctx.db
    .query("syncSessions")
    .withIndex("by_org_platform_and_date", (q) =>
      q.eq("organizationId", organizationId).eq("platform", "shopify"),
    )
    .order("desc")
    .take(5);

  const latestMeta = await ctx.db
    .query("syncSessions")
    .withIndex("by_org_platform_and_date", (q) =>
      q.eq("organizationId", organizationId).eq("platform", "meta"),
    )
    .order("desc")
    .take(5);

  const initialShopify = latestShopify.find(isInitialSyncSession);
  const initialMeta = latestMeta.find(isInitialSyncSession);

  const stages = stageComplete((initialShopify?.metadata || {}) as any);

  const expectedOrders =
    (initialShopify?.metadata as any)?.totalOrdersSeen ??
    (initialShopify?.metadata as any)?.ordersQueued ??
    undefined;

  // Avoid an expensive scan of thousands of orders on every status read.
  // We no longer attempt to verify `ordersInDb` here — this dramatically
  // reduces bandwidth for frequent status queries. Instead, rely on the
  // sync session status and stage completion flags which are already
  // maintained during sync.
  const dbHasExpectedOrders = false;
  const ordersInDb = 0;

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

  const onboarding = await ctx.db
    .query("onboarding")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();

  // Make readiness depend on session completion rather than scanning orders/insights.
  const analyticsReady = Boolean(
    (latestShopify[0] || latestMeta[0] || onboarding?.onboardingData?.analyticsTriggeredAt) &&
      (shopifyStore ? shopifyInitialComplete : true),
  );

  const lastCalculatedAt = Math.max(
    latestShopify[0]?.completedAt ?? latestShopify[0]?.startedAt ?? 0,
    latestMeta[0]?.completedAt ?? latestMeta[0]?.startedAt ?? 0,
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
      // Intentionally omit ordersInDb to avoid heavy reads; a separate
      // maintenance job can snapshot this if needed.
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
