import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ANALYSIS_DAYS = 30;

type CustomerPeriodStats = {
  periodOrders: number;
  periodRevenue: number;
  firstOrderMs: number | null;
  lastOrderMs: number | null;
};

const emptyStats: CustomerPeriodStats = {
  periodOrders: 0,
  periodRevenue: 0,
  firstOrderMs: null,
  lastOrderMs: null,
};

const normalizeStatus = (value: unknown): string =>
  typeof value === "string" ? value.toLowerCase() : "";

const isCancelledOrder = (order: Doc<"shopifyOrders">): boolean => {
  const status = normalizeStatus(order.financialStatus);
  if (status.includes("cancel")) return true;
  return false;
};

const resolveCustomerName = (customer: Doc<"shopifyCustomers">): string => {
  const combined = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`
    .trim()
    .replace(/\s+/g, " ");
  if (combined) return combined;
  if (customer.email && customer.email.trim().length > 0) {
    return customer.email.trim();
  }
  return "Anonymous";
};

const resolveSegment = (lifetimeOrders: number, lifetimeValue: number): string => {
  if (lifetimeOrders <= 0) return "prospect";
  if (lifetimeOrders === 1) return "new";
  if (lifetimeValue >= 1000) return "champion";
  if (lifetimeValue >= 500) return "vip";
  return "regular";
};

const buildOrderStats = (
  orders: Array<Doc<"shopifyOrders">>,
): Map<string, CustomerPeriodStats> => {
  const map = new Map<string, CustomerPeriodStats>();

  for (const order of orders) {
    const rawCustomerId = order.customerId;
    if (!rawCustomerId) continue;

    const customerId = String(rawCustomerId);
    const stats = map.get(customerId) ?? { ...emptyStats };

    const createdAt = order.shopifyCreatedAt;
    const totalPrice = typeof order.totalPrice === "number" ? order.totalPrice : 0;
    const value = Number.isFinite(totalPrice) ? Math.max(totalPrice, 0) : 0;

    if (!isCancelledOrder(order)) {
      stats.periodOrders += 1;
      stats.periodRevenue += value;
      if (stats.firstOrderMs === null || createdAt < stats.firstOrderMs) {
        stats.firstOrderMs = createdAt;
      }
      if (stats.lastOrderMs === null || createdAt > stats.lastOrderMs) {
        stats.lastOrderMs = createdAt;
      }
    }

    if (stats.firstOrderMs === null || createdAt < stats.firstOrderMs) {
      stats.firstOrderMs = createdAt;
    }
    if (stats.lastOrderMs === null || createdAt > stats.lastOrderMs) {
      stats.lastOrderMs = createdAt;
    }

    map.set(customerId, stats);
  }

  return map;
};

type CustomerSummaryDoc = Doc<"shopifyCustomers">;

type CustomerSnapshot = {
  customerId: Id<"shopifyCustomers">;
  name: string;
  email?: string;
  status: "converted" | "abandoned_cart";
  segment: string;
  lifetimeOrders: number;
  lifetimeValue: number;
  avgOrderValue: number;
  periodOrders: number;
  periodRevenue: number;
  firstOrderAt: number | null;
  lastOrderAt: number | null;
  shopifyCreatedAt: number;
  shopifyUpdatedAt?: number;
  city?: string;
  country?: string;
  isReturning: boolean;
  searchName: string;
  searchEmail?: string;
};

type CustomerSnapshotOverview = {
  totalCustomers: number;
  convertedCustomers: number;
  abandonedCustomers: number;
  returningCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  periodOrders: number;
  periodRevenue: number;
};

const buildCustomerSnapshots = (
  customers: CustomerSummaryDoc[],
  statsMap: Map<string, CustomerPeriodStats>,
): { snapshots: CustomerSnapshot[]; overview: CustomerSnapshotOverview } => {
  const snapshots: CustomerSnapshot[] = [];

  let convertedCustomers = 0;
  let returningCustomers = 0;
  let newCustomers = 0;
  let periodOrdersTotal = 0;
  let periodRevenueTotal = 0;

  for (const customer of customers) {
    const customerId = customer._id as Id<"shopifyCustomers">;
    const stats = statsMap.get(String(customerId)) ?? emptyStats;

    const lifetimeOrders = Math.max(customer.ordersCount ?? 0, 0);
    const lifetimeValue = Math.max(customer.totalSpent ?? 0, 0);
    const avgOrderValue = lifetimeOrders > 0 ? lifetimeValue / lifetimeOrders : 0;
    const name = resolveCustomerName(customer);
    const email = customer.email ?? undefined;
    const segment = resolveSegment(lifetimeOrders, lifetimeValue);
    const status = stats.periodOrders > 0 ? "converted" : "abandoned_cart";
    const isReturning = lifetimeOrders > 1;

    const shopifyCreatedAt = customer.shopifyCreatedAt;
    const shopifyUpdatedAt = customer.shopifyUpdatedAt ?? undefined;

    const firstOrderAt = stats.firstOrderMs;
    const lastOrderAt = stats.lastOrderMs ?? shopifyUpdatedAt ?? firstOrderAt;

    if (stats.periodOrders > 0) {
      convertedCustomers += 1;
      if (isReturning) {
        returningCustomers += 1;
      }
      if (lifetimeOrders === stats.periodOrders) {
        newCustomers += 1;
      }
    }

    periodOrdersTotal += stats.periodOrders;
    periodRevenueTotal += stats.periodRevenue;

    snapshots.push({
      customerId,
      name,
      email,
      status,
      segment,
      lifetimeOrders,
      lifetimeValue,
      avgOrderValue,
      periodOrders: stats.periodOrders,
      periodRevenue: stats.periodRevenue,
      firstOrderAt,
      lastOrderAt,
      shopifyCreatedAt,
      shopifyUpdatedAt,
      city: customer.defaultAddress?.city ?? undefined,
      country: customer.defaultAddress?.country ?? undefined,
      isReturning,
      searchName: name.toLowerCase(),
      searchEmail: email ? email.toLowerCase() : undefined,
    });
  }

  const overview: CustomerSnapshotOverview = {
    totalCustomers: customers.length,
    convertedCustomers,
    abandonedCustomers: Math.max(customers.length - convertedCustomers, 0),
    returningCustomers,
    newCustomers,
    activeCustomers: convertedCustomers,
    periodOrders: periodOrdersTotal,
    periodRevenue: periodRevenueTotal,
  };

  return { snapshots, overview };
};

export const getCustomerSnapshotMetadata = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("customerOverviewSummaries")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();

    if (!latest) {
      return null;
    }

    return {
      computedAt: latest.computedAt,
      analysisWindowDays: latest.analysisWindowDays,
      windowStartMs: latest.windowStartMs ?? undefined,
      windowEndMsExclusive: latest.windowEndMsExclusive ?? undefined,
    };
  },
});

export const rebuildCustomerSnapshot = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    analysisWindowDays: v.optional(v.number()),
    windowStartMs: v.optional(v.number()),
    windowEndMsExclusive: v.optional(v.number()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    const fallbackDays = Math.max(
      1,
      Math.floor(args.analysisWindowDays ?? DEFAULT_ANALYSIS_DAYS),
    );

    const hasExplicitWindow =
      typeof args.windowStartMs === "number" &&
      Number.isFinite(args.windowStartMs) &&
      typeof args.windowEndMsExclusive === "number" &&
      Number.isFinite(args.windowEndMsExclusive);

    let windowStartMs: number;
    let windowEndMsExclusive: number;

    if (hasExplicitWindow) {
      windowStartMs = Math.floor(args.windowStartMs!);
      windowEndMsExclusive = Math.floor(args.windowEndMsExclusive!);
    } else {
      const nowExclusive = Date.now() + 1;
      windowEndMsExclusive = nowExclusive;
      windowStartMs = nowExclusive - fallbackDays * MS_IN_DAY;
    }

    windowStartMs = Math.max(0, windowStartMs);

    if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMsExclusive)) {
      throw new Error("Invalid snapshot window values provided");
    }

    if (windowEndMsExclusive <= windowStartMs) {
      throw new Error("Invalid snapshot window: end must be after start");
    }

    const windowDurationMs = Math.max(0, windowEndMsExclusive - windowStartMs);
    const analysisWindowDays = Math.max(1, Math.round(windowDurationMs / MS_IN_DAY));

    const [customers, orders] = await Promise.all([
      ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
      ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", orgId)
            .gte("shopifyCreatedAt", windowStartMs)
            .lt("shopifyCreatedAt", windowEndMsExclusive),
        )
        .collect(),
    ]);

    const orderStats = buildOrderStats(orders);
    const { snapshots, overview } = buildCustomerSnapshots(customers, orderStats);

    const computedAt = Date.now();

    const existingSnapshots = await ctx.db
      .query("customerMetricsSummaries")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const doc of existingSnapshots) {
      await ctx.db.delete(doc._id);
    }

    const existingOverviews = await ctx.db
      .query("customerOverviewSummaries")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const doc of existingOverviews) {
      await ctx.db.delete(doc._id);
    }

    for (const snapshot of snapshots) {
      await ctx.db.insert("customerMetricsSummaries", {
        organizationId: orgId,
        customerId: snapshot.customerId,
        computedAt,
        analysisWindowDays,
        name: snapshot.name,
        email: snapshot.email,
        status: snapshot.status,
        segment: snapshot.segment,
        lifetimeOrders: snapshot.lifetimeOrders,
        lifetimeValue: snapshot.lifetimeValue,
        avgOrderValue: snapshot.avgOrderValue,
        periodOrders: snapshot.periodOrders,
        periodRevenue: snapshot.periodRevenue,
        firstOrderAt: snapshot.firstOrderAt ?? undefined,
        lastOrderAt: snapshot.lastOrderAt ?? undefined,
        shopifyCreatedAt: snapshot.shopifyCreatedAt,
        shopifyUpdatedAt: snapshot.shopifyUpdatedAt,
        city: snapshot.city,
        country: snapshot.country,
        isReturning: snapshot.isReturning,
        searchName: snapshot.searchName,
        searchEmail: snapshot.searchEmail,
      });
    }

    await ctx.db.insert("customerOverviewSummaries", {
      organizationId: orgId,
      computedAt,
      analysisWindowDays,
      windowStartMs,
      windowEndMsExclusive,
      totalCustomers: overview.totalCustomers,
      convertedCustomers: overview.convertedCustomers,
      abandonedCustomers: overview.abandonedCustomers,
      returningCustomers: overview.returningCustomers,
      newCustomers: overview.newCustomers,
      activeCustomers: overview.activeCustomers,
      periodOrders: overview.periodOrders,
      periodRevenue: overview.periodRevenue,
    });

    return {
      computedAt,
      customers: snapshots.length,
    };
  },
});
