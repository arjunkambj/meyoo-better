import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { action, query, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  dateRangeValidator,
  defaultDateRange,
} from "./analyticsShared";
import {
  getRangeEndExclusiveMs,
  getRangeStartMs,
  validateDateRange,
} from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";

const MAX_CUSTOMER_PAGE_SIZE = 50;
const DEFAULT_CUSTOMER_PAGE_SIZE = 50;
const MAX_CUSTOMER_RANGE_DAYS = 365;
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ANALYSIS_DAYS = 30;

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

const customerSnapshotMetadataValidator = v.object({
  computedAt: v.optional(v.number()),
  analysisWindowDays: v.optional(v.number()),
  windowStartMs: v.optional(v.number()),
  windowEndMsExclusive: v.optional(v.number()),
  isStale: v.boolean(),
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

type CustomerMetricsDoc = Doc<"customerMetricsSummaries">;
type CustomerOverviewDoc = Doc<"customerOverviewSummaries">;

type SnapshotLoadResult = {
  overview: CustomerOverviewDoc | null;
  rows: CustomerMetricsDoc[];
};

const clampPageSize = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CUSTOMER_PAGE_SIZE;
  }
  return Math.max(1, Math.min(Math.floor(value), MAX_CUSTOMER_PAGE_SIZE));
};

const toIso = (timestamp: number | null | undefined, fallback: number): string => {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }
  return new Date(fallback).toISOString();
};

const sortCustomerEntries = (
  entries: CustomerListEntry[],
  sortBy: string,
  sortOrder: "asc" | "desc",
): CustomerListEntry[] => {
  const direction = sortOrder === "asc" ? 1 : -1;

  const parseDate = (value: string): number => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return [...entries].sort((a, b) => {
    switch (sortBy) {
      case "lifetimeValue":
        return (a.lifetimeValue - b.lifetimeValue) * direction;
      case "orders":
        return (a.orders - b.orders) * direction;
      case "name":
        return direction === 1
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case "avgOrderValue":
        return (a.avgOrderValue - b.avgOrderValue) * direction;
      case "firstOrderDate":
        return (parseDate(a.firstOrderDate) - parseDate(b.firstOrderDate)) * direction;
      default:
        return (parseDate(a.lastOrderDate) - parseDate(b.lastOrderDate)) * direction;
    }
  });
};

const matchesSearch = (
  doc: CustomerMetricsDoc,
  term: string | null,
): boolean => {
  if (!term) {
    return true;
  }

  if (doc.searchName.includes(term)) {
    return true;
  }

  if (doc.searchEmail && doc.searchEmail.includes(term)) {
    return true;
  }

  return false;
};

const loadSnapshot = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<SnapshotLoadResult> => {
  const db = ctx.db as any;

  const overview = (await db
    .query("customerOverviewSummaries")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", orgId))
    .order("desc")
    .first()) as CustomerOverviewDoc | null;

  if (!overview) {
    return { overview: null, rows: [] };
  }

  const rows = (await db
    .query("customerMetricsSummaries")
    .withIndex("by_org_computed", (q: any) =>
      q.eq("organizationId", orgId).eq("computedAt", overview.computedAt),
    )
    .collect()) as CustomerMetricsDoc[];

  return { overview, rows };
};

const mapCustomer = (doc: CustomerMetricsDoc): CustomerListEntry => {
  const fallbackCreatedAt = doc.shopifyCreatedAt;

  return {
    id: doc.customerId.toString(),
    name: doc.name,
    email: doc.email ?? "",
    avatar: undefined,
    status: doc.status,
    lifetimeValue: doc.lifetimeValue,
    orders: doc.lifetimeOrders,
    avgOrderValue: doc.avgOrderValue,
    lastOrderDate: toIso(doc.lastOrderAt, fallbackCreatedAt),
    firstOrderDate: toIso(doc.firstOrderAt, fallbackCreatedAt),
    shopifyCreatedAt: new Date(doc.shopifyCreatedAt).toISOString(),
    shopifyUpdatedAt: doc.shopifyUpdatedAt
      ? new Date(doc.shopifyUpdatedAt).toISOString()
      : undefined,
    segment: doc.segment,
    city: doc.city ?? undefined,
    country: doc.country ?? undefined,
    periodOrders: doc.periodOrders,
    periodRevenue: doc.periodRevenue,
    isReturning: doc.isReturning,
  };
};

const computeRequestedDays = (range: ReturnType<typeof validateDateRange>): number => {
  if (range.dayCount && Number.isFinite(range.dayCount)) {
    return Math.min(MAX_CUSTOMER_RANGE_DAYS, Math.max(1, range.dayCount));
  }

  const start = getRangeStartMs(range);
  const end = getRangeEndExclusiveMs(range);
  const span = Math.max(1, Math.round((end - start) / MS_IN_DAY));
  return Math.min(MAX_CUSTOMER_RANGE_DAYS, span);
};

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
    metadata: customerSnapshotMetadataValidator,
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const pageSizeInput = clampPageSize(args.pageSize);
    const page = Math.max(1, Math.floor(args.page ?? 1));

    const range = validateDateRange(args.dateRange ?? defaultDateRange());
    if (range.dayCount && range.dayCount > MAX_CUSTOMER_RANGE_DAYS) {
      throw new Error(
        `Date range too large. Please select ${MAX_CUSTOMER_RANGE_DAYS} days or fewer.`,
      );
    }
    const requestedDays = computeRequestedDays(range);
    const rangeStartMs = getRangeStartMs(range);
    const rangeEndExclusiveMs = getRangeEndExclusiveMs(range);

    if (!auth) {
      return {
        rows: [],
        pagination: {
          page,
          pageSize: pageSizeInput,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
        metadata: {
          computedAt: undefined,
          analysisWindowDays: requestedDays,
          isStale: true,
        },
      };
    }

    const orgId = auth.orgId as Id<"organizations">;
    const { overview, rows } = await loadSnapshot(ctx, orgId);

    const normalizedSearch = args.searchTerm
      ? args.searchTerm.trim().toLowerCase()
      : null;
    const segmentFilter = args.segment && args.segment !== "all"
      ? args.segment
      : null;
    const sortBy = args.sortBy ?? "lastOrderDate";
    const sortOrder = args.sortOrder ?? "desc";
    const statusFilter = args.status ?? "all";

    const filteredDocs = rows.filter((doc) => {
      if (!matchesSearch(doc, normalizedSearch)) {
        return false;
      }

      if (segmentFilter && doc.segment !== segmentFilter) {
        return false;
      }

      if (statusFilter !== "all" && doc.status !== statusFilter) {
        return false;
      }

      return true;
    });

    const mappedEntries = filteredDocs.map(mapCustomer);
    const sortedEntries = sortCustomerEntries(mappedEntries, sortBy, sortOrder);

    const total = sortedEntries.length;
    const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSizeInput));
    const effectivePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const startIndex = (effectivePage - 1) * pageSizeInput;
    const endIndex = startIndex + pageSizeInput;
    const pageEntries = sortedEntries.slice(startIndex, endIndex);
    const hasMore = totalPages > 0 && effectivePage < totalPages;

    const metadata = (() => {
      if (!overview) {
        return {
          computedAt: undefined,
          analysisWindowDays: requestedDays,
          windowStartMs: undefined,
          windowEndMsExclusive: undefined,
          isStale: true,
        };
      }

      const matchesWindow =
        typeof overview.windowStartMs === "number" &&
        typeof overview.windowEndMsExclusive === "number" &&
        overview.windowStartMs === rangeStartMs &&
        overview.windowEndMsExclusive === rangeEndExclusiveMs;

      const isStale =
        Date.now() - overview.computedAt > SNAPSHOT_TTL_MS ||
        overview.analysisWindowDays !== requestedDays ||
        !matchesWindow;

      return {
        computedAt: overview.computedAt,
        analysisWindowDays: overview.analysisWindowDays,
        windowStartMs: overview.windowStartMs ?? undefined,
        windowEndMsExclusive: overview.windowEndMsExclusive ?? undefined,
        isStale,
      };
    })();

    return {
      rows: pageEntries,
      pagination: {
        page: effectivePage,
        pageSize: pageSizeInput,
        total,
        totalPages,
        hasMore,
      },
      metadata,
    };
  },
});

export const refreshCustomerAnalytics = action({
  args: {
    force: v.optional(v.boolean()),
    analysisWindowDays: v.optional(v.number()),
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.object({
    skipped: v.boolean(),
    computedAt: v.optional(v.number()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ skipped: boolean; computedAt?: number }> => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      throw new Error("Not authenticated");
    }

    const orgId = auth.orgId as Id<"organizations">;
    let windowStartMs: number | undefined;
    let windowEndExclusiveMs: number | undefined;
    let requestedWindowDays = Math.floor(args.analysisWindowDays ?? DEFAULT_ANALYSIS_DAYS);

    if (args.dateRange) {
      const normalizedRange = validateDateRange(args.dateRange);
      const daysFromRange = computeRequestedDays(normalizedRange);
      requestedWindowDays = Math.floor(args.analysisWindowDays ?? daysFromRange);
      windowStartMs = getRangeStartMs(normalizedRange);
      windowEndExclusiveMs = getRangeEndExclusiveMs(normalizedRange);
    }

    if (!Number.isFinite(requestedWindowDays)) {
      requestedWindowDays = DEFAULT_ANALYSIS_DAYS;
    }

    const analysisWindowDays = Math.max(
      1,
      Math.min(requestedWindowDays, MAX_CUSTOMER_RANGE_DAYS),
    );

    if (!args.force) {
      const metadata = (await ctx.runQuery(
        internal.engine.customers.getCustomerSnapshotMetadata,
        { organizationId: orgId },
      )) as {
        computedAt: number;
        analysisWindowDays: number;
        windowStartMs?: number;
        windowEndMsExclusive?: number;
      } | null;

      if (
        metadata?.computedAt !== undefined &&
        Date.now() - metadata.computedAt < SNAPSHOT_TTL_MS &&
        metadata.analysisWindowDays === analysisWindowDays &&
        (
          typeof windowStartMs !== "number" ||
          (metadata.windowStartMs === windowStartMs &&
            metadata.windowEndMsExclusive === windowEndExclusiveMs)
        )
      ) {
        return {
          skipped: true,
          computedAt: metadata.computedAt,
        };
      }
    }

    const mutationArgs: {
      organizationId: Id<"organizations">;
      analysisWindowDays: number;
      windowStartMs?: number;
      windowEndMsExclusive?: number;
    } = {
      organizationId: orgId,
      analysisWindowDays,
    };

    if (typeof windowStartMs === "number" && typeof windowEndExclusiveMs === "number") {
      mutationArgs.windowStartMs = windowStartMs;
      mutationArgs.windowEndMsExclusive = windowEndExclusiveMs;
    }

    const result = (await ctx.runMutation(
      internal.engine.customers.rebuildCustomerSnapshot,
      mutationArgs,
    )) as { computedAt: number };

    return {
      skipped: false,
      computedAt: result.computedAt,
    };
  },
});
