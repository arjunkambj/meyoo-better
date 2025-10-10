import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { action, query } from "../_generated/server";
import { api } from "../_generated/api";
import { validateDateRange, toTimestampRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { loadCustomerOverviewFromDailyMetrics } from "../utils/dailyMetrics";
import { dateRangeValidator, defaultDateRange } from "./analyticsShared";

const ZERO_CUSTOMER_OVERVIEW = {
  totalCustomers: 0,
  newCustomers: 0,
  returningCustomers: 0,
  activeCustomers: 0,
  churnedCustomers: 0,
  avgLifetimeValue: 0,
  avgOrderValue: 0,
  avgOrdersPerCustomer: 0,
  customerAcquisitionCost: 0,
  churnRate: 0,
  repeatPurchaseRate: 0,
  periodCustomerCount: 0,
  prepaidRate: 0,
  abandonedCartCustomers: 0,
  abandonedRate: 0,
  changes: {
    totalCustomers: 0,
    newCustomers: 0,
    lifetimeValue: 0,
  },
} as const;

const DEFAULT_JOURNEY_STAGES = [
  {
    stage: "Awareness",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:eye-bold-duotone",
    color: "primary",
  },
  {
    stage: "Interest",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:heart-bold-duotone",
    color: "interest",
  },
  {
    stage: "Consideration",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:cart-bold-duotone",
    color: "warning",
  },
  {
    stage: "Purchase",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:bag-bold-duotone",
    color: "success",
  },
  {
    stage: "Retention",
    customers: 0,
    percentage: 0,
    avgDays: 0,
    conversionRate: 0,
    icon: "solar:refresh-circle-bold-duotone",
    color: "retention",
  },
] satisfies Array<{
  stage: string;
  customers: number;
  percentage: number;
  avgDays: number;
  conversionRate: number;
  icon: string;
  color: string;
}>;

const customerListEntryValidator = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  avatar: v.optional(v.string()),
  status: v.string(),
  lifetimeValue: v.number(),
  orders: v.number(),
  avgOrderValue: v.number(),
  lastOrderDate: v.string(),
  firstOrderDate: v.string(),
  segment: v.string(),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  periodOrders: v.optional(v.number()),
  periodRevenue: v.optional(v.number()),
  isReturning: v.optional(v.boolean()),
});

const customerListPaginationValidator = v.object({
  page: v.number(),
  pageSize: v.number(),
  total: v.number(),
  totalPages: v.number(),
});

const customerListResultValidator = v.object({
  data: v.array(customerListEntryValidator),
  pagination: customerListPaginationValidator,
  continueCursor: v.string(),
  info: v.optional(
    v.object({
      pageSize: v.number(),
      returned: v.number(),
      hasMore: v.boolean(),
    }),
  ),
});

const cohortValidator = v.object({
  cohort: v.string(),
  cohortSize: v.number(),
  periods: v.array(
    v.object({
      period: v.number(),
      retained: v.number(),
      percentage: v.number(),
      revenue: v.number(),
    }),
  ),
});

const geographicValidator = v.object({
  countries: v.array(
    v.object({
      country: v.string(),
      customers: v.number(),
      revenue: v.number(),
      orders: v.number(),
      avgOrderValue: v.number(),
      zipCodes: v.array(
        v.object({
          zipCode: v.string(),
          city: v.optional(v.string()),
          customers: v.number(),
          revenue: v.number(),
        }),
      ),
    }),
  ),
  cities: v.array(
    v.object({
      city: v.string(),
      country: v.string(),
      customers: v.number(),
      revenue: v.number(),
    }),
  ),
  heatmapData: v.array(
    v.object({
      lat: v.number(),
      lng: v.number(),
      value: v.number(),
    }),
  ),
});

const journeyStageValidator = v.object({
  stage: v.string(),
  customers: v.number(),
  percentage: v.number(),
  avgDays: v.number(),
  conversionRate: v.number(),
  icon: v.string(),
  color: v.string(),
  metaConversionRate: v.optional(v.number()),
});

const overviewValidator = v.union(
  v.null(),
  v.object({
    totalCustomers: v.number(),
    newCustomers: v.number(),
    returningCustomers: v.number(),
    activeCustomers: v.number(),
    churnedCustomers: v.number(),
    avgLifetimeValue: v.number(),
    avgOrderValue: v.number(),
    avgOrdersPerCustomer: v.number(),
    customerAcquisitionCost: v.number(),
    churnRate: v.number(),
    repeatPurchaseRate: v.number(),
    periodCustomerCount: v.number(),
    prepaidRate: v.number(),
    abandonedCartCustomers: v.number(),
    abandonedRate: v.number(),
    changes: v.object({
      totalCustomers: v.number(),
      newCustomers: v.number(),
      lifetimeValue: v.number(),
    }),
  }),
);

const customerAnalyticsResultValidator = v.object({
  overview: overviewValidator,
  cohorts: v.array(cohortValidator),
  customerList: v.union(v.null(), customerListResultValidator),
  geographic: v.union(v.null(), geographicValidator),
  journey: v.array(journeyStageValidator),
});

type CustomerListEntry = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: string;
  lifetimeValue: number;
  orders: number;
  avgOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
  segment: string;
  city?: string;
  country?: string;
  periodOrders: number;
  periodRevenue: number;
  isReturning: boolean;
};

type CustomerListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type CustomerAnalyticsResult = {
  overview: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    activeCustomers: number;
    churnedCustomers: number;
    avgLifetimeValue: number;
    avgOrderValue: number;
    avgOrdersPerCustomer: number;
    customerAcquisitionCost: number;
    churnRate: number;
    repeatPurchaseRate: number;
    periodCustomerCount: number;
    prepaidRate: number;
    abandonedCartCustomers: number;
    abandonedRate: number;
    changes: {
      totalCustomers: number;
      newCustomers: number;
      lifetimeValue: number;
    };
  } | null;
  cohorts: Array<{
    cohort: string;
    cohortSize: number;
    periods: Array<{
      period: number;
      retained: number;
      percentage: number;
      revenue: number;
    }>;
  }>;
  customerList: {
    data: CustomerListEntry[];
    pagination: CustomerListPagination;
    continueCursor: string;
  } | null;
  geographic: {
    countries: Array<{
      country: string;
      customers: number;
      revenue: number;
      orders: number;
      avgOrderValue: number;
      zipCodes: Array<{
        zipCode: string;
        city?: string;
        customers: number;
        revenue: number;
      }>;
    }>;
    cities: Array<{
      city: string;
      country: string;
      customers: number;
      revenue: number;
    }>;
    heatmapData: Array<{ lat: number; lng: number; value: number }>;
  } | null;
  journey: Array<{
    stage: string;
    customers: number;
    percentage: number;
    avgDays: number;
    conversionRate: number;
    icon: string;
    color: string;
  }>;
};

/**
 * Customer Analytics API
 * Provides comprehensive customer insights and segmentation
 */

/**
 * Get customer overview metrics
 */
export const getCustomerOverview = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalCustomers: v.number(),
      newCustomers: v.number(),
      returningCustomers: v.number(),
      activeCustomers: v.number(),
      churnedCustomers: v.number(),
      avgLifetimeValue: v.number(),
      avgOrderValue: v.number(),
      avgOrdersPerCustomer: v.number(),
      customerAcquisitionCost: v.number(),
      churnRate: v.number(),
      repeatPurchaseRate: v.number(),
      periodCustomerCount: v.number(),
      prepaidRate: v.number(),
      abandonedCartCustomers: v.number(),
      abandonedRate: v.number(),
      changes: v.object({
        totalCustomers: v.number(),
        newCustomers: v.number(),
        lifetimeValue: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);
    const dailyOverview = await loadCustomerOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    if (!dailyOverview) {
      return { ...ZERO_CUSTOMER_OVERVIEW };
    }

    return dailyOverview.metrics ?? { ...ZERO_CUSTOMER_OVERVIEW };
  },
});
/**
 * Get cohort analysis data
 */
export const getCohortAnalysis = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
    cohortType: v.optional(v.union(v.literal("monthly"), v.literal("weekly"))),
  },
  returns: v.array(
    v.object({
      cohort: v.string(),
      cohortSize: v.number(),
      periods: v.array(
        v.object({
          period: v.number(),
          retained: v.number(),
          percentage: v.number(),
          revenue: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);
    const timestamps = toTimestampRange(range);

    const cohortType = args.cohortType ?? "monthly";
    const DAY_MS = 24 * 60 * 60 * 1000;

    const toCohortKey = (ms: number): string => {
      const date = new Date(ms);
      if (cohortType === "weekly") {
        const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const day = target.getUTCDay() || 7;
        target.setUTCDate(target.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
        const week = Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
        return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
      }

      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    };

    const periodDifference = (startMs: number, currentMs: number): number => {
      if (currentMs < startMs) {
        return 0;
      }
      if (cohortType === "weekly") {
        return Math.floor((currentMs - startMs) / (7 * DAY_MS));
      }
      const start = new Date(startMs);
      const current = new Date(currentMs);
      return (
        (current.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (current.getUTCMonth() - start.getUTCMonth())
      );
    };

    const cohortCustomers = new Map<
      string,
      { firstOrderMs: number }
    >();

    const customerIds = new Set<string>();
    const CUSTOMER_PAGE_SIZE = 200;
    let customerCursor: string | null = null;

    while (true) {
      const page = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("shopifyCreatedAt", timestamps.start)
            .lte("shopifyCreatedAt", timestamps.end),
        )
        .paginate({ numItems: CUSTOMER_PAGE_SIZE, cursor: customerCursor });

      for (const customer of page.page) {
        const id = customer._id as string;
        cohortCustomers.set(id, { firstOrderMs: customer.shopifyCreatedAt });
        customerIds.add(id);
      }

      if (page.isDone || !page.continueCursor) {
        break;
      }

      customerCursor = page.continueCursor;
    }

    if (cohortCustomers.size === 0) {
      return [];
    }

    const ordersByCustomer = new Map<
      string,
      Array<{ date: number; amount: number }>
    >();

    const ORDER_PAGE_SIZE = 200;
    let orderCursor: string | null = null;

    while (true) {
      const page = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("shopifyCreatedAt", timestamps.start)
            .lte("shopifyCreatedAt", timestamps.end),
        )
        .paginate({ numItems: ORDER_PAGE_SIZE, cursor: orderCursor });

      for (const order of page.page) {
        if (!order.customerId) continue;
        const customerId = order.customerId as string;
        if (!customerIds.has(customerId)) continue;
        if (order.financialStatus === "cancelled") continue;

        const bucket = ordersByCustomer.get(customerId) ?? [];
        bucket.push({
          date: order.shopifyCreatedAt,
          amount: Number(order.totalPrice) || 0,
        });
        ordersByCustomer.set(customerId, bucket);
      }

      if (page.isDone || !page.continueCursor) {
        break;
      }

      orderCursor = page.continueCursor;
    }

    const cohorts = new Map<
      string,
      {
        customers: Set<string>;
        ordersByPeriod: Map<number, { customers: Set<string>; revenue: number }>;
      }
    >();

    for (const [customerId, meta] of cohortCustomers.entries()) {
      const cohortKey = toCohortKey(meta.firstOrderMs);
      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          customers: new Set(),
          ordersByPeriod: new Map(),
        });
      }

      const cohortBucket = cohorts.get(cohortKey)!;
      cohortBucket.customers.add(customerId);

      const orders = (ordersByCustomer.get(customerId) ?? []).sort(
        (a, b) => a.date - b.date,
      );

      for (const order of orders) {
        const period = Math.max(0, periodDifference(meta.firstOrderMs, order.date));
        if (!cohortBucket.ordersByPeriod.has(period)) {
          cohortBucket.ordersByPeriod.set(period, {
            customers: new Set(),
            revenue: 0,
          });
        }
        const periodBucket = cohortBucket.ordersByPeriod.get(period)!;
        periodBucket.customers.add(customerId);
        periodBucket.revenue += order.amount;
      }
    }

    const cohortResults = Array.from(cohorts.entries())
      .map(([cohortKey, cohortData]) => {
        const cohortSize = cohortData.customers.size;
        if (cohortSize === 0) {
          return null;
        }

        const periods = Array.from(cohortData.ordersByPeriod.entries())
          .sort(([a], [b]) => a - b)
          .slice(0, 12)
          .map(([period, data]) => ({
            period,
            retained: data.customers.size,
            percentage: cohortSize > 0 ? (data.customers.size / cohortSize) * 100 : 0,
            revenue: data.revenue,
          }));

        return {
          cohort: cohortKey,
          cohortSize,
          periods,
        };
      })
      .filter((entry): entry is { cohort: string; cohortSize: number; periods: { period: number; retained: number; percentage: number; revenue: number; }[] } => Boolean(entry))
      .sort((a, b) => b.cohort.localeCompare(a.cohort))
      .slice(0, 12);

    return cohortResults;
  },
});
/**
 * Get geographic distribution
 */
export const getGeographicDistribution = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: geographicValidator,
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        countries: [],
        cities: [],
        heatmapData: [],
      };
    }

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);
    const timestamps = toTimestampRange(range);

    // Stream orders in the date range to limit memory and bandwidth
    const orders: Array<Doc<"shopifyOrders">> = [];
    let cursor: string | null = null;
    const PAGE = 200;
    while (true) {
      const page = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_organization_and_created", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("shopifyCreatedAt", timestamps.start)
            .lte("shopifyCreatedAt", timestamps.end),
        )
        .paginate({ numItems: PAGE, cursor });

      for (const o of page.page) {
        if (o.financialStatus !== "cancelled") orders.push(o);
      }

      if (page.isDone || !page.continueCursor) break;
      cursor = page.continueCursor;
    }

    // Get unique customer IDs from orders
    const customerIds = new Set<string>();
    for (const order of orders) {
      if (order.customerId) {
        customerIds.add(order.customerId);
      }
    }

    // Load only customers referenced by orders to minimize reads
    const customers: Doc<"shopifyCustomers">[] = [];
    const custIds = Array.from(customerIds);
    const C_BATCH = 50;
    for (let i = 0; i < custIds.length; i += C_BATCH) {
      const slice = custIds.slice(i, i + C_BATCH);
      const fetched = await Promise.all(
        slice.map((id) => ctx.db.get(id as Id<"shopifyCustomers">)),
      );
      for (const c of fetched) {
        if (c) customers.push(c);
      }
    }

    // Build geographic aggregations
    const countryMap = new Map<
      string,
      {
        customers: Set<string>;
        revenue: number;
        orders: number;
        cities: Map<string, { customers: Set<string>; revenue: number }>;
        zipCodes: Map<string, { customers: Set<string>; revenue: number; city?: string }>;
      }
    >();

    for (const customer of customers) {
      if (!customerIds.has(customer._id)) continue;
      if (!customer.defaultAddress?.country) continue;

      const country = customer.defaultAddress.country;
      const city = customer.defaultAddress.city;
      const zip = customer.defaultAddress.zip;

      if (!countryMap.has(country)) {
        countryMap.set(country, {
          customers: new Set(),
          revenue: 0,
          orders: 0,
          cities: new Map(),
          zipCodes: new Map(),
        });
      }

      const countryData = countryMap.get(country)!;
      countryData.customers.add(customer._id);

      // Add city data
      if (city) {
        if (!countryData.cities.has(city)) {
          countryData.cities.set(city, { customers: new Set(), revenue: 0 });
        }
        countryData.cities.get(city)!.customers.add(customer._id);
      }

      // Add zip data
      if (zip) {
        if (!countryData.zipCodes.has(zip)) {
          countryData.zipCodes.set(zip, { customers: new Set(), revenue: 0, city });
        }
        countryData.zipCodes.get(zip)!.customers.add(customer._id);
      }
    }

    // Aggregate revenue from orders
    for (const order of orders) {
      if (!order.customerId) continue;
      if (!order.shippingAddress?.country) continue;

      const country = order.shippingAddress.country;
      if (countryMap.has(country)) {
        const countryData = countryMap.get(country)!;
        countryData.revenue += order.totalPrice;
        countryData.orders += 1;

        // Add to city revenue
        const city = order.shippingAddress.city;
        if (city && countryData.cities.has(city)) {
          countryData.cities.get(city)!.revenue += order.totalPrice;
        }

        // Add to zip revenue
        const zip = order.shippingAddress.zip;
        if (zip && countryData.zipCodes.has(zip)) {
          countryData.zipCodes.get(zip)!.revenue += order.totalPrice;
        }
      }
    }

    // Build result arrays
    const countries = Array.from(countryMap.entries()).map(([country, data]) => ({
      country,
      customers: data.customers.size,
      revenue: data.revenue,
      orders: data.orders,
      avgOrderValue: data.orders > 0 ? data.revenue / data.orders : 0,
      zipCodes: Array.from(data.zipCodes.entries()).map(([zipCode, zipData]) => ({
        zipCode,
        city: zipData.city,
        customers: zipData.customers.size,
        revenue: zipData.revenue,
      })),
    }));

    const cities = Array.from(countryMap.entries()).flatMap(([country, data]) =>
      Array.from(data.cities.entries()).map(([city, cityData]) => ({
        city,
        country,
        customers: cityData.customers.size,
        revenue: cityData.revenue,
      })),
    );

    return {
      countries,
      cities,
      heatmapData: [], // TODO: Implement heatmap coordinates
    };
  },
});

/**
 * Get customer journey funnel
 */
export const getCustomerJourney = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.array(journeyStageValidator),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return DEFAULT_JOURNEY_STAGES;

    const rangeInput = args.dateRange ?? defaultDateRange();
    const range = validateDateRange(rangeInput);

    // Load customer overview from daily metrics to get aggregated data
    const dailyOverview = await loadCustomerOverviewFromDailyMetrics(
      ctx,
      auth.orgId as Id<"organizations">,
      range,
    );

    if (!dailyOverview?.metrics) {
      return DEFAULT_JOURNEY_STAGES;
    }

    const metrics = dailyOverview.metrics;
    const returningCustomers = metrics.returningCustomers || 0;

    // Sum Meta insights incrementally to avoid fetching a giant array
    let metaTotals = { impressions: 0, clicks: 0, conversions: 0 } as {
      impressions: number;
      clicks: number;
      conversions: number;
    };
    let mCursor: string | null = null;
    const M_PAGE = 250;
    while (true) {
      const page = await ctx.db
        .query("metaInsights")
        .withIndex("by_org_date", (q) =>
          q
            .eq("organizationId", auth.orgId as Id<"organizations">)
            .gte("date", range.startDate)
            .lte("date", range.endDate),
        )
        .paginate({ numItems: M_PAGE, cursor: mCursor });

      for (const insight of page.page) {
        if ((insight as any).entityType !== "account") continue;
        const impressions = typeof (insight as any).impressions === "number" ? (insight as any).impressions : 0;
        const clicks = typeof (insight as any).clicks === "number" ? (insight as any).clicks : 0;
        const conversions = typeof (insight as any).conversions === "number" ? (insight as any).conversions : 0;
        metaTotals = {
          impressions: metaTotals.impressions + Math.max(impressions, 0),
          clicks: metaTotals.clicks + Math.max(clicks, 0),
          conversions: metaTotals.conversions + Math.max(conversions, 0),
        };
      }

      if (page.isDone || !page.continueCursor) break;
      mCursor = page.continueCursor;
    }

    const roundPercent = (value: number) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      const clamped = Math.min(100, Math.max(0, value));
      return Number.parseFloat(clamped.toFixed(2));
    };

    const awarenessCustomers = Math.max(metaTotals.impressions, 0);
    const interestCustomers = Math.max(metaTotals.clicks, 0);
    const metaConversionRate = interestCustomers > 0
      ? roundPercent((metaTotals.conversions / interestCustomers) * 100)
      : 0;

    const considerationCustomers = Math.max(
      (metrics.abandonedCartCustomers || 0) + (metrics.periodCustomerCount || 0),
      0,
    );
    const purchaseCustomers = Math.max(metrics.periodCustomerCount || 0, 0);
    const retentionCustomers = Math.max(returningCustomers, 0);

    const baseForPercentage = (() => {
      if (awarenessCustomers > 0) return awarenessCustomers;
      if (interestCustomers > 0) return interestCustomers;
      if (considerationCustomers > 0) return considerationCustomers;
      if (purchaseCustomers > 0) return purchaseCustomers;
      if (retentionCustomers > 0) return retentionCustomers;
      return 1;
    })();

    const toPercentage = (value: number) =>
      baseForPercentage > 0
        ? roundPercent((value / baseForPercentage) * 100)
        : 0;

    const awarenessToInterest = awarenessCustomers > 0
      ? roundPercent((interestCustomers / awarenessCustomers) * 100)
      : 0;
    const interestToConsideration = interestCustomers > 0
      ? roundPercent((considerationCustomers / interestCustomers) * 100)
      : 0;
    const considerationToPurchase = considerationCustomers > 0
      ? roundPercent((purchaseCustomers / considerationCustomers) * 100)
      : 0;
    const purchaseToRetention = purchaseCustomers > 0
      ? roundPercent((retentionCustomers / purchaseCustomers) * 100)
      : 0;

    return [
      {
        stage: "Awareness",
        customers: awarenessCustomers,
        percentage: awarenessCustomers > 0 ? 100 : toPercentage(awarenessCustomers),
        avgDays: 0,
        conversionRate: awarenessToInterest,
        icon: "solar:eye-bold-duotone",
        color: "primary",
      },
      {
        stage: "Interest",
        customers: interestCustomers,
        percentage: toPercentage(interestCustomers),
        avgDays: 0,
        conversionRate: interestToConsideration,
        icon: "solar:heart-bold-duotone",
        color: "interest",
        metaConversionRate,
      },
      {
        stage: "Consideration",
        customers: considerationCustomers,
        percentage: toPercentage(considerationCustomers),
        avgDays: 0,
        conversionRate: considerationToPurchase,
        icon: "solar:cart-bold-duotone",
        color: "warning",
      },
      {
        stage: "Purchase",
        customers: purchaseCustomers,
        percentage: toPercentage(purchaseCustomers),
        avgDays: 0,
        conversionRate: purchaseToRetention,
        icon: "solar:bag-bold-duotone",
        color: "success",
      },
      {
        stage: "Retention",
        customers: retentionCustomers,
        percentage: toPercentage(retentionCustomers),
        avgDays: 0,
        conversionRate: 0,
        icon: "solar:refresh-circle-bold-duotone",
        color: "retention",
      },
    ];
  },
});

export const getAnalytics = action({
  args: {
    dateRange: dateRangeValidator,
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("converted"),
        v.literal("abandoned_cart"),
      ),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
      organizationId: v.string(),
      result: customerAnalyticsResultValidator,
    }),
  ),
  handler: async (ctx, args): Promise<
    | {
        dateRange: { startDate: string; endDate: string };
        organizationId: string;
        result: CustomerAnalyticsResult;
      }
    | null
  > => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const range = validateDateRange(args.dateRange);

    const [overview, cohorts, geographic, journey] = await Promise.all([
      ctx.runQuery(api.web.customers.getCustomerOverview, {
        dateRange: range,
      }),
      ctx.runQuery(api.web.customers.getCohortAnalysis, {
        dateRange: range,
        cohortType: "monthly",
      }),
      ctx.runQuery(api.web.customers.getGeographicDistribution, {
        dateRange: range,
      }),
      ctx.runQuery(api.web.customers.getCustomerJourney, {
        dateRange: range,
      }),
    ]);

    const customerListPayload = null;

    return {
      dateRange: range,
      organizationId: auth.orgId,
      result: {
        overview: overview ?? null,
        cohorts: cohorts ?? null,
        geographic: geographic ?? null,
        journey: journey ?? null,
        customerList: customerListPayload,
      },
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      result: CustomerAnalyticsResult;
    };
  },
});
