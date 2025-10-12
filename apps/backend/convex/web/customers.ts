import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  validateDateRange,
  toTimestampRange,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { dateRangeValidator, defaultDateRange } from "./analyticsShared";

const MAX_CUSTOMER_PAGE_SIZE = 50;
const DEFAULT_CUSTOMER_PAGE_SIZE = 50;
const MAX_CUSTOMER_RANGE_DAYS = 365;

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
  shopifyCreatedAt: v.string(),
  shopifyUpdatedAt: v.optional(v.string()),
  segment: v.string(),
  city: v.optional(v.string()),
  country: v.optional(v.string()),
  periodOrders: v.number(),
  periodRevenue: v.number(),
  isReturning: v.boolean(),
});

const customerListPaginationValidator = v.object({
  page: v.number(),
  pageSize: v.number(),
  total: v.number(),
  totalPages: v.number(),
  hasMore: v.boolean(),
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
  shopifyCreatedAt: string;
  shopifyUpdatedAt?: string;
  segment: string;
  city?: string;
  country?: string;
  periodOrders: number;
  periodRevenue: number;
  isReturning: boolean;
};

function sortCustomerEntries(
  entries: CustomerListEntry[],
  sortBy: string,
  sortOrder: "asc" | "desc",
): CustomerListEntry[] {
  const direction = sortOrder === "asc" ? 1 : -1;

  const compare = (a: CustomerListEntry, b: CustomerListEntry): number => {
    switch (sortBy) {
      case "lifetimeValue":
        return (a.lifetimeValue - b.lifetimeValue) * direction;
      case "orders":
        return (a.orders - b.orders) * direction;
      case "name":
        return direction === 1 ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      case "avgOrderValue":
        return (a.avgOrderValue - b.avgOrderValue) * direction;
      case "firstOrderDate":
        return (
          (new Date(a.firstOrderDate).getTime() - new Date(b.firstOrderDate).getTime()) *
          direction
        );
      default:
        return (
          (new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime()) * direction
        );
    }
  };

  return entries.sort((a, b) => compare(a, b));
}

type CustomerTableResult = {
  rows: CustomerListEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

async function buildCustomerTable(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  range: ReturnType<typeof toTimestampRange>,
  args: {
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    statusFilter: "all" | "converted" | "abandoned_cart";
    segmentFilter: string | null;
    searchTerm: string | null;
  },
): Promise<CustomerTableResult> {
  const { page, pageSize, sortBy, sortOrder, statusFilter, segmentFilter, searchTerm } = args;

  const orders = await ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization_and_created", (q) =>
      q.eq("organizationId", orgId).gte("shopifyCreatedAt", range.start).lte("shopifyCreatedAt", range.end),
    )
    .collect();

  const customerMetricsMap = new Map<
    string,
    {
      periodRevenue: number;
      periodOrders: number;
      firstOrderTimestamp: number | null;
      lastOrderTimestamp: number | null;
    }
  >();

  for (const order of orders) {
    if (!order.customerId) continue;

    const customerId = order.customerId as string;
    const isCancelled = order.financialStatus === "cancelled";

    if (!customerMetricsMap.has(customerId)) {
      customerMetricsMap.set(customerId, {
        periodRevenue: 0,
        periodOrders: 0,
        firstOrderTimestamp: null,
        lastOrderTimestamp: null,
      });
    }

    const metrics = customerMetricsMap.get(customerId)!;
    const orderValue = Math.max(order.totalPrice ?? 0, 0);

    if (!isCancelled) {
      metrics.periodRevenue += orderValue;
      metrics.periodOrders += 1;

      if (metrics.firstOrderTimestamp === null || order.shopifyCreatedAt < metrics.firstOrderTimestamp) {
        metrics.firstOrderTimestamp = order.shopifyCreatedAt;
      }
      if (metrics.lastOrderTimestamp === null || order.shopifyCreatedAt > metrics.lastOrderTimestamp) {
        metrics.lastOrderTimestamp = order.shopifyCreatedAt;
      }
    }
  }

  const customerIds = Array.from(customerMetricsMap.keys());
  const customerDocs = await Promise.all(
    customerIds.map((id) => ctx.db.get(id as Id<"shopifyCustomers">)),
  );

  const allEntries: CustomerListEntry[] = [];

  for (const customer of customerDocs) {
    if (!customer) continue;

    const metrics = customerMetricsMap.get(customer._id as string);
    if (!metrics) continue;

    const lifetimeOrders = Math.max(customer.ordersCount ?? 0, 0);
    const lifetimeValue = Math.max(customer.totalSpent ?? 0, 0);
    const avgOrderValue = lifetimeOrders > 0 ? lifetimeValue / lifetimeOrders : 0;

    const name = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Anonymous";
    const normalizedEmail = (customer.email ?? "").toLowerCase();
    const normalizedName = name.toLowerCase();

    if (searchTerm && !normalizedName.includes(searchTerm) && !normalizedEmail.includes(searchTerm)) {
      continue;
    }

    let segment = "prospect";
    if (lifetimeOrders === 1) {
      segment = "new";
    } else if (lifetimeOrders >= 2 && lifetimeValue < 500) {
      segment = "regular";
    } else if (lifetimeOrders >= 2 && lifetimeValue >= 500 && lifetimeValue < 1000) {
      segment = "vip";
    } else if (lifetimeOrders >= 2 && lifetimeValue >= 1000) {
      segment = "champion";
    }

    if (segmentFilter && segment !== segmentFilter) {
      continue;
    }

    const convertedStatus = metrics.periodOrders > 0 ? "converted" : "abandoned_cart";
    if (statusFilter === "converted" && convertedStatus !== "converted") {
      continue;
    }
    if (statusFilter === "abandoned_cart" && convertedStatus !== "abandoned_cart") {
      continue;
    }

    const firstOrderTimestamp = metrics.firstOrderTimestamp ?? customer.shopifyCreatedAt ?? range.start;
    const lastOrderTimestamp = metrics.lastOrderTimestamp ?? customer.shopifyUpdatedAt ?? firstOrderTimestamp;

    const entry: CustomerListEntry = {
      id: customer._id as string,
      name,
      email: customer.email ?? "",
      avatar: undefined,
      status: convertedStatus,
      lifetimeValue,
      orders: lifetimeOrders,
      avgOrderValue,
      lastOrderDate: new Date(lastOrderTimestamp).toISOString(),
      firstOrderDate: new Date(firstOrderTimestamp).toISOString(),
      shopifyCreatedAt: new Date(customer.shopifyCreatedAt ?? firstOrderTimestamp).toISOString(),
      shopifyUpdatedAt: customer.shopifyUpdatedAt
        ? new Date(customer.shopifyUpdatedAt).toISOString()
        : undefined,
      segment,
      city: customer.defaultAddress?.city,
      country: customer.defaultAddress?.country,
      periodOrders: metrics.periodOrders,
      periodRevenue: metrics.periodRevenue,
      isReturning: lifetimeOrders > 1,
    };

    allEntries.push(entry);
  }

  const sortedEntries = sortCustomerEntries(allEntries, sortBy, sortOrder);

  const total = sortedEntries.length;
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = total === 0 ? 1 : Math.min(page, totalPages);

  const startIndex = (effectivePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageEntries = sortedEntries.slice(startIndex, endIndex);

  const hasMore = total === 0 ? false : effectivePage < totalPages;

  return {
    rows: pageEntries,
    pagination: {
      page: effectivePage,
      pageSize,
      total,
      totalPages,
      hasMore,
    },
  };
}

export const getCustomersPage = query({
  args: {
    dateRange: v.optional(dateRangeValidator),
    searchTerm: v.optional(v.string()),
    segment: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
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
  returns: v.object({
    rows: v.array(customerListEntryValidator),
    pagination: customerListPaginationValidator,
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const pageSizeInput = Math.max(
      1,
      Math.min(args.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE, MAX_CUSTOMER_PAGE_SIZE),
    );
    const page = Math.max(1, Math.floor(args.page ?? 1));

    if (!auth) {
      return {
        rows: [],
        pagination: {
          page,
          pageSize: pageSizeInput,
          total: 0,
          totalPages: 1,
          hasMore: false,
        },
      };
    }

    const range = validateDateRange(args.dateRange ?? defaultDateRange());
    if (range.dayCount && range.dayCount > MAX_CUSTOMER_RANGE_DAYS) {
      throw new Error(`Date range too large. Please select ${MAX_CUSTOMER_RANGE_DAYS} days or fewer.`);
    }
    const timestamps = toTimestampRange(range);

    const sortBy = args.sortBy ?? "lastOrderDate";
    const sortOrder = args.sortOrder ?? "desc";
    const statusFilter = args.status ?? "all";
    const segmentFilter = args.segment && args.segment !== "all" ? args.segment : null;
    const searchTerm = args.searchTerm?.trim().toLowerCase() ?? null;

    const table = await buildCustomerTable(
      ctx,
      auth.orgId as Id<"organizations">,
      timestamps,
      {
        page,
        pageSize: pageSizeInput,
        sortBy,
        sortOrder,
        statusFilter,
        segmentFilter,
        searchTerm,
      },
    );

    return {
      rows: table.rows,
      pagination: table.pagination,
    };
  },
});
