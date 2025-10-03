import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { action, query } from "../_generated/server";
import { api } from "../_generated/api";
import { validateDateRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { loadCustomerOverviewFromDailyMetrics } from "../utils/dailyMetrics";
import { dateRangeValidator, defaultDateRange } from "./analyticsShared";

const MAX_CUSTOMER_PAGE_SIZE = 100;
const DEFAULT_CUSTOMER_PAGE_SIZE = 50;
const END_CURSOR = "__END__";

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
  periodRepeatRate: 0,
  abandonedCartCustomers: 0,
  changes: {
    totalCustomers: 0,
    newCustomers: 0,
    lifetimeValue: 0,
  },
} as const;

const EMPTY_GEOGRAPHIC = {
  countries: [] as Array<{
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
  }>,
  cities: [] as Array<{
    city: string;
    country: string;
    customers: number;
    revenue: number;
  }>,
  heatmapData: [] as Array<{ lat: number; lng: number; value: number }>,
};

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
    color: "secondary",
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
    color: "info",
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
    periodRepeatRate: v.number(),
    abandonedCartCustomers: v.number(),
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
    periodRepeatRate: number;
    abandonedCartCustomers: number;
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
      periodRepeatRate: v.number(),
      abandonedCartCustomers: v.number(),
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
 * Get RFM (Recency, Frequency, Monetary) segments
 */
export const getRFMSegments = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      count: v.number(),
      percentage: v.number(),
      avgLTV: v.number(),
      description: v.string(),
      recommendation: v.string(),
      color: v.string(),
      icon: v.string(),
    }),
  ),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    return [];
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
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    return [];
  },
});

/**
 * Get paginated customer list
 */
export const getCustomerList = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
    paginationOpts: v.optional(paginationOptsValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(
      v.object({
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
      }),
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
    data: v.optional(
      v.array(
        v.object({
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
        }),
      ),
    ),
    pagination: v.optional(
      v.object({
        page: v.number(),
        pageSize: v.number(),
        total: v.number(),
        totalPages: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const pageSize = Math.max(
      1,
      Math.min(args.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE, MAX_CUSTOMER_PAGE_SIZE),
    );
    const page = Math.max(1, Math.floor(args.page ?? 1));

    if (!auth) {
      return {
        page: [],
        continueCursor: END_CURSOR,
        isDone: true,
        data: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        },
      };
    }

    return {
      page: [],
      continueCursor: END_CURSOR,
      isDone: true,
      data: [],
      pagination: {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      },
    };
  },
});

/**
 * Get customer segments for dashboard widget
 */
export const getCustomerSegments = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.object({
    totalCustomers: v.number(),
    returningCustomers: v.number(),
    vipCustomers: v.number(),
    atRiskCustomers: v.number(),
  }),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        totalCustomers: 0,
        returningCustomers: 0,
        vipCustomers: 0,
        atRiskCustomers: 0,
      };
    }

    return {
      totalCustomers: 0,
      returningCustomers: 0,
      vipCustomers: 0,
      atRiskCustomers: 0,
    };
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
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return {
        countries: [],
        cities: [],
        heatmapData: [],
      };
    }

    return { ...EMPTY_GEOGRAPHIC };
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
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return DEFAULT_JOURNEY_STAGES;

    return DEFAULT_JOURNEY_STAGES;
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
    const page = Math.max(1, Math.floor(args.page ?? 1));
    const pageSize = Math.min(Math.max(args.pageSize ?? 50, 1), MAX_CUSTOMER_PAGE_SIZE);
    const searchTerm = args.searchTerm?.trim() ? args.searchTerm.trim() : undefined;
    const segment = args.segment?.trim() ? args.segment.trim() : undefined;
    const sortBy = args.sortBy ?? undefined;
    const sortOrder = args.sortOrder ?? "desc";

    const [overview, cohorts, geographic, journey, customerList] = await Promise.all([
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
      ctx.runQuery(api.web.customers.getCustomerList, {
        dateRange: range,
        page,
        pageSize,
        searchTerm,
        segment,
        sortBy,
        sortOrder,
      }),
    ]);

    const listData = customerList?.data ?? customerList?.page ?? [];
    const pagination = customerList?.pagination ?? {
      page,
      pageSize,
      total:
        customerList?.pagination?.total ??
        Math.max((page - 1) * pageSize + listData.length, listData.length),
      totalPages:
        customerList?.pagination?.totalPages ??
        Math.max(
          1,
          Math.ceil(
            (customerList?.pagination?.total ?? Math.max((page - 1) * pageSize + listData.length, listData.length)) /
              pageSize,
          ),
        ),
    } satisfies CustomerListPagination;

    const customerListPayload = customerList
      ? {
          data: listData as CustomerListEntry[],
          pagination,
          continueCursor: customerList.continueCursor ?? END_CURSOR,
        }
      : null;

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
