import { createTool } from "@convex-dev/agent";
import { api } from "../_generated/api";
import { resend } from "../integrations/resend";
import { z } from "zod/v3";
import { rag } from "../rag";
import { requireUserAndOrg } from "../utils/auth";
import type {
  OrdersAnalyticsResult,
  PlatformMetrics as AggregatedPlatformMetrics,
  PnLAnalyticsResult,
} from "@repo/types";

const isoDate = z
  .string()
  .regex(/\d{4}-\d{2}-\d{2}/, "Use ISO date format (YYYY-MM-DD)");

const emailAddress = z
  .string()
  .email("Provide a valid email address before invoking this tool.");

const memberRoleEnum = z.enum(["StoreOwner", "StoreTeam"]);
const memberStatusEnum = z.enum(["active", "suspended", "removed"]);

const DEFAULT_FROM_EMAIL = "Meyoo <noreply@meyoo.io>";

const toIsoString = (timestamp?: number | null) =>
  typeof timestamp === "number" && Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;

function defaultDateRange(days: number = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const normalize = (d: Date) => d.toISOString().substring(0, 10);
  return { startDate: normalize(start), endDate: normalize(end) };
}

type AnalyticsRow = Record<string, number | string>;

type OrdersOverviewSummary = NonNullable<OrdersAnalyticsResult["overview"]>;
type OrdersOverviewChanges = OrdersOverviewSummary["changes"];

type InventoryAlert = {
  id: string;
  type: "critical" | "low" | "reorder" | "overstock";
  productName: string;
  sku: string;
  currentStock: number;
  reorderPoint?: number;
  daysUntilStockout?: number;
  message: string;
};

type NormalizedInventoryAlert = Omit<InventoryAlert, "type"> & {
  type: "critical" | "low" | "reorder";
};

type MetaPlatformSummary = {
  sessions: number;
  conversionRate: number;
  impressions: number;
  ctr: number;
  reach: number;
  frequency: number;
  uniqueClicks: number;
  cpc: number;
  costPerConversion: number;
  addToCart: number;
  initiateCheckout: number;
  pageViews: number;
  viewContent: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  videoViews: number;
  video3SecViews: number;
  costPerThruPlay: number;
};

type OrgMemberRole = z.infer<typeof memberRoleEnum>;
type OrgMemberStatus = z.infer<typeof memberStatusEnum>;

type OrgMemberRecord = {
  _id: string;
  _creationTime?: number;
  email?: string;
  name?: string;
  image?: string;
  role: OrgMemberRole;
  status: OrgMemberStatus;
  isOnboarded?: boolean;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type OrgMembersToolArgs = {
  role?: OrgMemberRole;
  status?: OrgMemberStatus;
  includeRemoved?: boolean;
};

type OrgMemberSnapshot = {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  role: OrgMemberRole;
  status: OrgMemberStatus;
  isOwner: boolean;
  isOnboarded?: boolean;
  joinedAt?: string;
  lastUpdatedAt?: string;
};

type OrgMembersToolResult = {
  summary: string;
  counts: {
    total: number;
    active: number;
    suspended: number;
    owners: number;
    team: number;
    removed: number;
  };
  filtered: {
    total: number;
    active: number;
    suspended: number;
    owners: number;
    team: number;
    removed: number;
    appliedFilters: string[];
  };
  owner: null | {
    id: string;
    name?: string;
    email?: string;
    image?: string;
    role: OrgMemberRole;
    status: OrgMemberStatus;
    joinedAt?: string;
  };
  members: OrgMemberSnapshot[];
};

type SendEmailToolArgs = {
  memberId?: string;
  toEmail?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string[];
  from?: string;
  previewOnly?: boolean;
};

type SendEmailToolResult = {
  status: "queued" | "preview" | "error";
  summary: string;
  to?: string;
  subject?: string;
  emailId?: string;
  recipientName?: string;
  memberId?: string;
  testMode?: boolean;
  preview?: {
    html?: string;
    text?: string;
  } | null;
  error?: string;
};

export const ordersSummaryTool = createTool<
  { startDate?: string; endDate?: string },
  {
    dateRange: { startDate: string; endDate: string };
    totals: {
      totalOrders: number;
      pendingOrders: number;
      processingOrders: number;
      completedOrders: number;
      cancelledOrders: number;
    };
    financials: {
      totalRevenue: number;
      totalCosts: number;
      netProfit: number;
      avgOrderValue: number;
      grossMargin: number;
      customerAcquisitionCost: number;
    };
    fulfillment: {
      fulfillmentRate: number;
      avgFulfillmentTime: number;
      returnRate: number;
    };
    changes: {
      totalOrders: number;
      revenue: number;
      netProfit: number;
      avgOrderValue: number;
      cac: number;
      margin: number;
      fulfillmentRate: number;
    };
    summary: string;
  }
>({
  description:
    "Summarize order volume, revenue, and fulfillment performance over a date range.",
  args: z.object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    dateRange: { startDate: string; endDate: string };
    totals: {
      totalOrders: number;
      pendingOrders: number;
      processingOrders: number;
      completedOrders: number;
      cancelledOrders: number;
    };
    financials: {
      totalRevenue: number;
      totalCosts: number;
      netProfit: number;
      avgOrderValue: number;
      grossMargin: number;
      customerAcquisitionCost: number;
    };
    fulfillment: {
      fulfillmentRate: number;
      avgFulfillmentTime: number;
      returnRate: number;
    };
    changes: {
      totalOrders: number;
      revenue: number;
      netProfit: number;
      avgOrderValue: number;
      cac: number;
      margin: number;
      fulfillmentRate: number;
    };
    summary: string;
  }> => {
    console.log("[TOOL CALL] ordersSummary", { startDate: args.startDate, endDate: args.endDate });
    await requireUserAndOrg(ctx);
    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const analyticsResponse = await ctx.runAction(api.web.orders.getAnalytics, {
      dateRange,
      pageSize: 500,
    });

    const result = analyticsResponse?.result as OrdersAnalyticsResult | undefined;
    const overview = result?.overview;
    const fulfillmentDetails = result?.fulfillment;

    const zeroState = {
      dateRange,
      totals: {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
      },
      financials: {
        totalRevenue: 0,
        totalCosts: 0,
        netProfit: 0,
        avgOrderValue: 0,
        grossMargin: 0,
        customerAcquisitionCost: 0,
      },
      fulfillment: {
        fulfillmentRate: 0,
        avgFulfillmentTime: 0,
        returnRate: 0,
      },
      changes: {
        totalOrders: 0,
        revenue: 0,
        netProfit: 0,
        avgOrderValue: 0,
        cac: 0,
        margin: 0,
        fulfillmentRate: 0,
      },
      summary: `No orders found between ${dateRange.startDate} and ${dateRange.endDate}.`,
    } as const;

    if (!overview) {
      return zeroState;
    }

    const orders = result?.orders?.data ?? [];
    const statusCounts = orders.reduce(
      (acc, order) => {
        const status = (order.status ?? "").toLowerCase();
        const fulfillment = (order.fulfillmentStatus ?? "").toLowerCase();
        if (status.includes("cancel")) {
          acc.cancelled += 1;
        } else if (
          fulfillment.includes("fulfill") ||
          status.includes("fulfill") ||
          fulfillment.includes("shipp") ||
          status.includes("shipp") ||
          fulfillment.includes("deliver")
        ) {
          acc.completed += 1;
        } else if (
          status.includes("process") ||
          fulfillment.includes("process") ||
          status.includes("partial") ||
          fulfillment.includes("partial")
        ) {
          acc.processing += 1;
        } else {
          acc.pending += 1;
        }
        return acc;
      },
      { pending: 0, processing: 0, completed: 0, cancelled: 0 },
    );

    const totals = {
      totalOrders: Number(overview.totalOrders ?? 0),
      pendingOrders: statusCounts.pending,
      processingOrders: statusCounts.processing,
      completedOrders: statusCounts.completed,
      cancelledOrders: statusCounts.cancelled,
    };

    const financials = {
      totalRevenue: Number(overview.totalRevenue ?? 0),
      totalCosts: Number(overview.totalCosts ?? 0),
      netProfit: Number(overview.netProfit ?? 0),
      avgOrderValue: Number(overview.avgOrderValue ?? 0),
      grossMargin: Number(overview.grossMargin ?? 0),
      customerAcquisitionCost: Number(overview.customerAcquisitionCost ?? 0),
    };

    const fulfillment = {
      fulfillmentRate: Number(overview.fulfillmentRate ?? 0),
      avgFulfillmentTime: Number(fulfillmentDetails?.avgProcessingTime ?? 0),
      returnRate: Number(fulfillmentDetails?.returnRate ?? 0),
    };

    const changesSource = (overview.changes ?? {}) as Partial<OrdersOverviewChanges>;
    const changes = {
      totalOrders: Number(changesSource.totalOrders ?? 0),
      revenue: Number(changesSource.revenue ?? 0),
      netProfit: Number(changesSource.netProfit ?? 0),
      avgOrderValue: Number(changesSource.avgOrderValue ?? 0),
      cac: Number(changesSource.cac ?? 0),
      margin: Number(changesSource.margin ?? 0),
      fulfillmentRate: Number(changesSource.fulfillmentRate ?? 0),
    };

    const summary = `Processed ${totals.totalOrders} orders (${totals.completedOrders} completed, ${totals.pendingOrders} pending) generating $${financials.totalRevenue.toFixed(2)} revenue and $${financials.netProfit.toFixed(2)} net profit.`;

    return {
      dateRange,
      totals,
      financials,
      fulfillment,
      changes,
      summary,
    };
  },
});

export const inventoryLowStockTool = createTool<
  { limit?: number },
  {
    summary: string;
    totalAlerts: number;
    alerts: Array<{
      id: string;
      type: "critical" | "low" | "reorder";
      productName: string;
      sku: string;
      currentStock: number;
      reorderPoint?: number;
      daysUntilStockout?: number;
      message: string;
    }>;
  }
>({
  description:
    "List products that are low or critical on stock so replenishment can be prioritised.",
  args: z.object({
    limit: z.number().int().positive().max(50).optional(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    summary: string;
    totalAlerts: number;
    alerts: Array<{
      id: string;
      type: "critical" | "low" | "reorder";
      productName: string;
      sku: string;
      currentStock: number;
      reorderPoint?: number;
      daysUntilStockout?: number;
      message: string;
    }>;
  }> => {
    console.log("[TOOL CALL] inventoryLowStock", { limit: args.limit });
    await requireUserAndOrg(ctx);
    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 50) : 10;

    const alertsResponse = (await ctx.runQuery(api.web.inventory.getStockAlerts, {
      limit,
    })) as InventoryAlert[] | null;

    const alerts = alertsResponse ?? [];

    const filtered = alerts.filter((alert) => alert.type !== "overstock");

    const summary = filtered.length === 0
      ? "No low-stock alerts detected. Inventory levels look healthy."
      : `Identified ${filtered.length} low-stock items requiring replenishment.`;

    const normalized: NormalizedInventoryAlert[] = filtered.map((alert) => ({
      ...alert,
      type: alert.type === "critical" ? "critical" : alert.type === "reorder" ? "reorder" : "low",
    }));

    return {
      summary,
      totalAlerts: normalized.length,
      alerts: normalized,
    };
  },
});

const analyticsSummaryArgs = z.object({
  startDate: isoDate,
  endDate: isoDate,
  granularity: z
    .enum(["daily", "weekly", "monthly"])
    .default("daily"),
  metrics: z
    .array(z.string())
    .optional()
    .describe("Specific metric field names to include (optional)"),
});

type AnalyticsSummaryArgs = z.input<typeof analyticsSummaryArgs>;

type AnalyticsSummaryResult = {
  summary: string;
  totals: Record<string, number>;
  records: AnalyticsRow[];
};

export const analyticsSummaryTool = createTool<
  AnalyticsSummaryArgs,
  AnalyticsSummaryResult
>({
  description:
    "Summarize store performance metrics over a date range (daily/weekly/monthly).",
  args: analyticsSummaryArgs,
  handler: async (
    ctx,
    { startDate, endDate, granularity, metrics },
  ): Promise<AnalyticsSummaryResult> => {
    console.log("[TOOL CALL] analyticsSummary", { startDate, endDate, granularity, metricsCount: metrics?.length });
    const analytics = (await ctx.runQuery(api.web.pnl.getAnalytics, {
      dateRange: { startDate, endDate },
      granularity,
    })) as { result: PnLAnalyticsResult } | null;

    const periods = analytics?.result?.periods ?? [];

    if (periods.length === 0) {
      return {
        summary: "No analytics available for the selected date range.",
        totals: {},
        records: [],
      };
    }

    const selected = metrics && metrics.length > 0 ? new Set(metrics) : null;

    const records: AnalyticsRow[] = periods.map((period) => {
      const record: AnalyticsRow = {
        label: period.label,
        date: period.date,
      };

      for (const [key, value] of Object.entries(period.metrics)) {
        if (!selected || selected.has(key)) {
          record[key] = value;
        }
      }

      return record;
    });

    const totals: Record<string, number> = {};
    for (const entry of records) {
      for (const [key, value] of Object.entries(entry)) {
        if (typeof value === "number") {
          totals[key] = (totals[key] ?? 0) + value;
        }
      }
    }

    return {
      summary: `Aggregated ${records.length} ${granularity} records from ${startDate} to ${endDate}.`,
      totals,
      records,
    };
  },
});

export const metaAdsOverviewTool = createTool<
  { startDate?: string; endDate?: string },
  {
    summary: string;
    dateRange: { startDate: string; endDate: string };
    meta: MetaPlatformSummary;
  }
>({
  description:
    "Retrieve Meta ads performance metrics (impressions, clicks, conversions, CPC, etc.) for a date window.",
  args: z.object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ summary: string; dateRange: { startDate: string; endDate: string }; meta: MetaPlatformSummary }> => {
    console.log("[TOOL CALL] metaAdsOverview", { startDate: args.startDate, endDate: args.endDate });
    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const metricsResponse = (await ctx.runQuery(
      api.web.analytics.getPlatformMetricsSummary,
      {
        dateRange,
      },
    )) as { metrics: AggregatedPlatformMetrics } | null;

    const metrics = metricsResponse?.metrics;

    const meta: MetaPlatformSummary = metrics
      ? {
          sessions: metrics.metaSessions,
          conversionRate: metrics.metaConversionRate,
          impressions: metrics.metaImpressions,
          ctr: metrics.metaCTR,
          reach: metrics.metaReach,
          frequency: metrics.metaFrequency,
          uniqueClicks: metrics.metaUniqueClicks,
          cpc: metrics.metaCPC,
          costPerConversion: metrics.metaCostPerConversion,
          addToCart: metrics.metaAddToCart,
          initiateCheckout: metrics.metaInitiateCheckout,
          pageViews: metrics.metaPageViews,
          viewContent: metrics.metaViewContent,
          linkClicks: metrics.metaLinkClicks,
          outboundClicks: metrics.metaOutboundClicks,
          landingPageViews: metrics.metaLandingPageViews,
          videoViews: metrics.metaVideoViews,
          video3SecViews: metrics.metaVideo3SecViews,
          costPerThruPlay: metrics.metaCostPerThruPlay,
        }
      : {
          sessions: 0,
          conversionRate: 0,
          impressions: 0,
          ctr: 0,
          reach: 0,
          frequency: 0,
          uniqueClicks: 0,
          cpc: 0,
          costPerConversion: 0,
          addToCart: 0,
          initiateCheckout: 0,
          pageViews: 0,
          viewContent: 0,
          linkClicks: 0,
          outboundClicks: 0,
          landingPageViews: 0,
          videoViews: 0,
          video3SecViews: 0,
          costPerThruPlay: 0,
        };

    const summary = metrics
      ? `Meta ads performance summarized for ${dateRange.startDate} to ${dateRange.endDate}.`
      : "No Meta ads metrics available";

    return {
      summary,
      dateRange,
      meta,
    };
  },
});

export const currentDateTool = createTool<
  Record<string, never>,
  {
    isoDate: string;
    isoDateTime: string;
    utc: string;
  }
>({
  description:
    'Returns the current date in ISO 8601 format (UTC). Use this when you need to reference "today" explicitly.',
  args: z.object({}),
  handler: async () => {
    console.log("[TOOL CALL] currentDate");
    const now = new Date();
    return {
      isoDate: now.toISOString().slice(0, 10),
      isoDateTime: now.toISOString(),
      utc: now.toUTCString(),
    };
  },
});

export const pnlSnapshotTool = createTool<
  { startDate?: string; endDate?: string },
  {
    summary: string;
    dateRange: { startDate: string; endDate: string };
    revenue: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
    operatingExpenses: number;
    adSpend: number;
    marketingROI: number;
    ebitda: number;
    changes: {
      revenue: number;
      netProfit: number;
      grossMargin: number;
      netMargin: number;
      marketingROI: number;
    };
  }
>({
  description:
    "Generate a profit & loss snapshot covering revenue, profit margins, and spend for a period.",
  args: z.object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    summary: string;
    dateRange: { startDate: string; endDate: string };
    revenue: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
    operatingExpenses: number;
    adSpend: number;
    marketingROI: number;
    ebitda: number;
    changes: {
      revenue: number;
      netProfit: number;
      grossMargin: number;
      netMargin: number;
      marketingROI: number;
    };
  }> => {
    console.log("[TOOL CALL] pnlSnapshot", { startDate: args.startDate, endDate: args.endDate });
    await requireUserAndOrg(ctx);
    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const response = (await ctx.runQuery(api.web.pnl.getAnalytics, {
      dateRange,
      granularity: "monthly",
    })) as { result: PnLAnalyticsResult } | null;

    const result = response?.result;
    const metrics = result?.metrics;
    const totals = result?.totals;

    if (!metrics || !totals) {
      return {
        summary: `No financial data available between ${dateRange.startDate} and ${dateRange.endDate}.`,
        dateRange,
        revenue: 0,
        grossProfit: 0,
        netProfit: 0,
        grossMargin: 0,
        netMargin: 0,
        operatingExpenses: 0,
        adSpend: 0,
        marketingROI: 0,
        ebitda: 0,
        changes: {
          revenue: 0,
          netProfit: 0,
          grossMargin: 0,
          netMargin: 0,
          marketingROI: 0,
        },
      };
    }

    const revenue = Number(totals.revenue ?? 0);
    const grossProfit = Number(totals.grossProfit ?? 0);
    const netProfit = Number(totals.netProfit ?? 0);
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = Number(metrics.netMargin ?? 0);
    const operatingExpenses = Number(metrics.operatingExpenses ?? 0);
    const adSpend = Number(metrics.marketingCost ?? totals.totalAdSpend ?? 0);
    const marketingROI = Number(metrics.marketingROI ?? 0);
    const ebitda = Number(metrics.ebitda ?? 0);

    const changes = {
      revenue: Number(metrics.changes?.grossSales ?? 0),
      netProfit: Number(metrics.changes?.netProfit ?? 0),
      grossMargin: Number(metrics.changes?.grossProfit ?? 0),
      netMargin: Number(metrics.changes?.netMargin ?? 0),
      marketingROI: Number(metrics.changes?.marketingROI ?? 0),
    };

    const summary = `Revenue of $${revenue.toFixed(2)} generated $${netProfit.toFixed(2)} net profit (${netMargin.toFixed(1)}% net margin) with $${operatingExpenses.toFixed(2)} in operating expenses.`;

    return {
      summary,
      dateRange,
      revenue,
      grossProfit,
      netProfit,
      grossMargin,
      netMargin,
      operatingExpenses,
      adSpend,
      marketingROI,
      ebitda,
      changes,
    };
  },
});

export const brandSummaryTool = createTool<
  Record<string, never>,
  {
    summary: string;
    generatedAt?: string;
    source?: string;
  }
>({
  description:
    'Retrieve the latest stored overview of the merchant brand. Use this to understand positioning, key products, and sales cadence.',
  args: z.object({}),
  handler: async (ctx) => {
    console.log("[TOOL CALL] brandSummary");
    const { orgId } = await requireUserAndOrg(ctx);
    const namespace = String(orgId);

    let search;
    try {
      search = await rag.search(ctx, {
        namespace,
        query: "brand summary",
        filters: [{ name: "type", value: "brand-summary" }],
        limit: 1,
      });
    } catch (error) {
      console.error("[TOOL CALL] brandSummary - RAG search error:", error);
      return {
        summary:
          "No brand summary is stored yet. Ask an administrator to run the brand summary update action to refresh the knowledge base.",
      };
    }

    const entry = search.entries?.[0];

    const extractSummary = () => {
      if (!entry) return "";
      const relevant = search.results
        .filter((result) => result.entryId === entry.entryId)
        .flatMap((result) => result.content?.map((part) => part.text ?? "") ?? []);
      const combined = relevant.join("\n").trim();
      if (combined.length > 0) return combined;
      if (typeof search.text === "string") return search.text.trim();
      return "";
    };

    const summary = extractSummary();

    if (!entry || summary.length === 0) {
      return {
        summary:
          "No brand summary is stored yet. Ask an administrator to run the brand summary update action to refresh the knowledge base.",
      };
    }

    const metadata = (entry.metadata ?? {}) as Record<string, unknown>;

    return {
      summary,
      generatedAt: typeof metadata.generatedAt === "string" ? metadata.generatedAt : undefined,
      source: typeof metadata.shopDomain === "string" ? metadata.shopDomain : undefined,
    };
  },
});

export const productsInventoryTool = createTool<
  {
    page?: number;
    pageSize?: number;
    stockLevel?: "all" | "healthy" | "low" | "critical" | "out";
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
  {
    summary: string;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    items: Array<{
      id: string;
      name: string;
      sku: string;
      category: string;
      vendor: string;
      stock: number;
      available: number;
      reorderPoint: number;
      stockStatus: "healthy" | "low" | "critical" | "out";
      price: number;
      cost: number;
      margin: number;
      unitsSold?: number;
      lastSold?: string;
      abcCategory: "A" | "B" | "C";
      variants?: Array<{
        id: string;
        sku: string;
        title: string;
        price: number;
        stock: number;
        available: number;
        unitsSold?: number;
      }>;
    }>;
  }
>({
  description: "List all products with inventory details, variants, and stock status (paginated).",
  args: z.object({
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().max(200).optional(),
    stockLevel: z.enum(["all", "healthy", "low", "critical", "out"]).optional(),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    summary: string;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    items: Array<{
      id: string;
      name: string;
      sku: string;
      category: string;
      vendor: string;
      stock: number;
      available: number;
      reorderPoint: number;
      stockStatus: 'healthy' | 'low' | 'critical' | 'out';
      price: number;
      cost: number;
      margin: number;
      unitsSold?: number;
      lastSold?: string;
      abcCategory: 'A' | 'B' | 'C';
      variants?: Array<{
        id: string;
        sku: string;
        title: string;
        price: number;
        stock: number;
        available: number;
        unitsSold?: number;
      }>;
    }>;
  }> => {
    console.log("[TOOL CALL] productsInventory", { page: args.page, pageSize: args.pageSize, stockLevel: args.stockLevel, search: args.search });
    await requireUserAndOrg(ctx);

    const page = args.page && args.page > 0 ? args.page : 1;
    const pageSize = args.pageSize && args.pageSize > 0 ? Math.min(args.pageSize, 200) : 50;

    const result: {
      overview: {
        totalValue: number;
        totalCOGS: number;
        totalSKUs: number;
        stockCoverageDays: number;
        deadStock: number;
      };
      products: {
        data: Array<{
          id: string;
          name: string;
          sku: string;
          image?: string;
          category: string;
          vendor: string;
          stock: number;
          available: number;
          reorderPoint: number;
          stockStatus: 'healthy' | 'low' | 'critical' | 'out';
          price: number;
          cost: number;
          margin: number;
          unitsSold?: number;
          lastSold?: string;
          abcCategory: 'A' | 'B' | 'C';
          variants?: Array<{
            id: string;
            sku: string;
            title: string;
            price: number;
            stock: number;
            available: number;
            unitsSold?: number;
          }>;
        }>;
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
        hasMore: boolean;
      };
    } = await ctx.runQuery(api.web.inventory.getInventoryAnalytics, {
      page,
      pageSize,
      stockLevel: args.stockLevel && args.stockLevel !== "all" ? args.stockLevel : undefined,
      searchTerm: args.search,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder as any,
    });

    const items = result.products.data.map((p: any) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      sku: String(p.sku ?? ""),
      category: String(p.category ?? ""),
      vendor: String(p.vendor ?? ""),
      stock: Number(p.stock ?? 0),
      available: Number(p.available ?? 0),
      reorderPoint: Number(p.reorderPoint ?? 0),
      stockStatus: p.stockStatus as 'healthy' | 'low' | 'critical' | 'out',
      price: Number(p.price ?? 0),
      cost: Number(p.cost ?? 0),
      margin: Number(p.margin ?? 0),
      unitsSold: typeof p.unitsSold === "number" ? p.unitsSold : undefined,
      lastSold: typeof p.lastSold === "string" ? p.lastSold : undefined,
      abcCategory: (p.abcCategory ?? "C") as 'A' | 'B' | 'C',
      variants: Array.isArray(p.variants)
        ? p.variants.map((v: any) => ({
            id: String(v.id),
            sku: String(v.sku ?? ""),
            title: String(v.title ?? ""),
            price: Number(v.price ?? 0),
            stock: Number(v.stock ?? 0),
            available: Number(v.available ?? 0),
            unitsSold: typeof v.unitsSold === "number" ? v.unitsSold : undefined,
          }))
        : undefined,
    }));

    const summary = `Found ${result.products.pagination.total} products (${result.products.pagination.totalPages} pages). Page ${result.products.pagination.page} of ${result.products.pagination.totalPages}.`;

    return {
      summary,
      page: result.products.pagination.page,
      pageSize: result.products.pagination.pageSize,
      total: result.products.pagination.total,
      totalPages: result.products.pagination.totalPages,
      items,
    };
  },
});

export const orgMembersTool = createTool<OrgMembersToolArgs, OrgMembersToolResult>({
  description:
    "List organization members with their email, role, status, and onboarding details. Supports optional filtering by role or status.",
  args: z.object({
    role: memberRoleEnum
      .optional()
      .describe("Filter to a specific membership role (StoreOwner or StoreTeam)."),
    status: memberStatusEnum
      .optional()
      .describe("Filter to members with a specific status (active, suspended, removed)."),
    includeRemoved: z
      .boolean()
      .optional()
      .describe(
        "Set to true to include members whose status is removed. Defaults to false.",
      ),
  }),
  handler: async (ctx, args): Promise<OrgMembersToolResult> => {
    console.log("[TOOL CALL] orgMembers", { role: args.role, status: args.status, includeRemoved: args.includeRemoved });
    await requireUserAndOrg(ctx);

    const { role, status, includeRemoved = false } = args;

    const team = (await ctx.runQuery(api.core.teams.getTeamMembers, {})) as OrgMemberRecord[];

    const members: OrgMemberSnapshot[] = team.map((member) => {
      const joinedTimestamp = typeof member.createdAt === "number"
        ? member.createdAt
        : member._creationTime;
      const updatedTimestamp = typeof member.updatedAt === "number"
        ? member.updatedAt
        : null;

      return {
        id: String(member._id),
        name: member.name,
        email: member.email,
        image: member.image,
        role: member.role,
        status: member.status,
        isOwner: member.role === "StoreOwner",
        isOnboarded:
          typeof member.isOnboarded === "boolean" ? member.isOnboarded : undefined,
        joinedAt: toIsoString(joinedTimestamp),
        lastUpdatedAt: toIsoString(updatedTimestamp),
      } satisfies OrgMemberSnapshot;
    });

    const counts = {
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      suspended: members.filter((m) => m.status === "suspended").length,
      owners: members.filter((m) => m.isOwner).length,
      team: members.filter((m) => m.role === "StoreTeam").length,
      removed: members.filter((m) => m.status === "removed").length,
    };

    let filteredMembers = members;
    const appliedFilters: string[] = [];

    if (role) {
      filteredMembers = filteredMembers.filter((m) => m.role === role);
      appliedFilters.push(`role=${role}`);
    }

    if (status) {
      filteredMembers = filteredMembers.filter((m) => m.status === status);
      appliedFilters.push(`status=${status}`);
    }

    const shouldExcludeRemoved = !includeRemoved && status !== "removed";

    if (shouldExcludeRemoved) {
      filteredMembers = filteredMembers.filter((m) => m.status !== "removed");
    }

    appliedFilters.push(
      shouldExcludeRemoved ? "removed=excluded" : "removed=included",
    );

    const filteredCounts = {
      total: filteredMembers.length,
      active: filteredMembers.filter((m) => m.status === "active").length,
      suspended: filteredMembers.filter((m) => m.status === "suspended").length,
      owners: filteredMembers.filter((m) => m.isOwner).length,
      team: filteredMembers.filter((m) => m.role === "StoreTeam").length,
      removed: filteredMembers.filter((m) => m.status === "removed").length,
      appliedFilters,
    };

    const primaryOwner = members.find((m) => m.isOwner) ?? null;
    const owner = primaryOwner
      ? {
          id: primaryOwner.id,
          name: primaryOwner.name,
          email: primaryOwner.email,
          image: primaryOwner.image,
          role: primaryOwner.role,
          status: primaryOwner.status,
          joinedAt: primaryOwner.joinedAt,
        }
      : null;

    const summarySegments: string[] = [];

    summarySegments.push(
      counts.total === 0
        ? "No members found for this organization."
        : `Organization has ${counts.total} members (${counts.owners} owner, ${counts.team} team). ${counts.active} active, ${counts.suspended} suspended, ${counts.removed} removed.`,
    );

    if (filteredMembers.length !== counts.total || role || status || includeRemoved) {
      summarySegments.push(
        filteredMembers.length === 0
          ? "No members match the provided filters."
          : `Returning ${filteredMembers.length} member${filteredMembers.length === 1 ? "" : "s"} after applying filters.`,
      );
    }

    if (appliedFilters.length > 0) {
      summarySegments.push(`Filters: ${appliedFilters.join(", ")}.`);
    }

    const summary = summarySegments.filter(Boolean).join(" ");

    return {
      summary,
      counts,
      filtered: filteredCounts,
      owner,
      members: filteredMembers,
    };
  },
});

export const sendEmailTool = createTool<SendEmailToolArgs, SendEmailToolResult>({
  description:
    "Send an email via the Resend component. Confirm the exact recipient email with the user before invoking this tool. Supports dry-run previews.",
  args: z
    .object({
      memberId: z
        .string()
        .min(1)
        .trim()
        .optional()
        .describe("Optional organization member id to resolve the recipient email."),
      toEmail: emailAddress
        .optional()
        .describe("Explicit recipient email. Provide this when not referencing a memberId."),
      subject: z
        .string()
        .min(3)
        .max(160)
        .describe("Email subject. Keep it concise and professional."),
      html: z
        .string()
        .min(1)
        .optional()
        .describe("HTML body of the email. Provide html or text (or both)."),
      text: z
        .string()
        .min(1)
        .optional()
        .describe("Plain-text body of the email. Provide text or html (or both)."),
      replyTo: z
        .array(emailAddress)
        .max(4)
        .optional()
        .describe("Optional reply-to addresses."),
      from: z
        .string()
        .min(3)
        .max(160)
        .optional()
        .describe("Override the default from address (defaults to Meyoo no-reply)."),
      previewOnly: z
        .boolean()
        .optional()
        .describe(
          "If true, return a preview payload without sending the email. Use this to confirm content.",
        ),
    })
    .superRefine((value, ctx) => {
      if (!value.memberId && !value.toEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide either memberId or toEmail to resolve the recipient.",
          path: ["toEmail"],
        });
      }
      if (
        (typeof value.html !== "string" || value.html.trim().length === 0) &&
        (typeof value.text !== "string" || value.text.trim().length === 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide email content in html and/or text.",
          path: ["html"],
        });
      }
    }),
  handler: async (ctx, args): Promise<SendEmailToolResult> => {
    console.log("[TOOL CALL] sendEmail", { memberId: args.memberId, toEmail: args.toEmail, subject: args.subject, previewOnly: args.previewOnly });
    await requireUserAndOrg(ctx);

    const normalizedSubject = args.subject.replace(/[\r\n]+/g, " ").trim();
    const htmlBody = typeof args.html === "string" ? args.html.trim() : undefined;
    const textBody = typeof args.text === "string" ? args.text.trim() : undefined;
    const replyToList = args.replyTo
      ?.map((address) => address.trim())
      .filter((address) => address.length > 0);

    let recipientEmail: string | undefined;
    let recipientName: string | undefined;
    let resolvedMemberId: string | undefined;

    if (args.memberId) {
      resolvedMemberId = args.memberId;
      const members = (await ctx.runQuery(api.core.teams.getTeamMembers, {})) as OrgMemberRecord[];
      const match = members.find((member) => String(member._id) === args.memberId);
      if (!match) {
        return {
          status: "error",
          summary: `No organization member found for id ${args.memberId}. Confirm the recipient before retrying.`,
          memberId: args.memberId,
          error: "member_not_found",
        };
      }
      if (!match.email) {
        return {
          status: "error",
          summary: `Member ${match.name ?? args.memberId} does not have an email address on file.`,
          memberId: args.memberId,
          error: "missing_email",
        };
      }
      recipientEmail = match.email.trim();
      recipientName = match.name ?? undefined;
    }

    if (!recipientEmail && args.toEmail) {
      recipientEmail = args.toEmail.trim();
    }

    if (!recipientEmail) {
      return {
        status: "error",
        summary:
          "No recipient email could be resolved. Confirm the address with the user before invoking this tool again.",
        error: "missing_recipient",
      };
    }

    const sanitizedHtml = htmlBody && htmlBody.length > 0 ? htmlBody : undefined;
    const sanitizedText = textBody && textBody.length > 0 ? textBody : undefined;

    if (!sanitizedHtml && !sanitizedText) {
      return {
        status: "error",
        summary: "Email content is empty after trimming. Provide html or text content.",
        to: recipientEmail,
        subject: normalizedSubject,
        error: "missing_body",
      };
    }

    const from = args.from?.trim() && args.from.trim().length > 0
      ? args.from.trim()
      : DEFAULT_FROM_EMAIL;

    const preview = sanitizedHtml || sanitizedText ? { html: sanitizedHtml, text: sanitizedText } : null;

    if (args.previewOnly) {
      return {
        status: "preview",
        summary: `Generated preview for email to ${recipientEmail}. No email was sent.`,
        to: recipientEmail,
        subject: normalizedSubject,
        recipientName,
        memberId: resolvedMemberId,
        testMode: resend.config.testMode ?? true,
        preview,
      };
    }

    const emailId = await resend.sendEmail(ctx, {
      from,
      to: recipientEmail,
      subject: normalizedSubject,
      html: sanitizedHtml,
      text: sanitizedText,
      replyTo: replyToList && replyToList.length > 0 ? replyToList : undefined,
    });

    return {
      status: "queued",
      summary: `Email queued via Resend for ${recipientEmail}.`,
      to: recipientEmail,
      subject: normalizedSubject,
      emailId,
      recipientName,
      memberId: resolvedMemberId,
      testMode: resend.config.testMode ?? true,
      preview,
    };
  },
});

export const agentTools = {
  ordersSummary: ordersSummaryTool,
  inventoryLowStock: inventoryLowStockTool,
  analyticsSummary: analyticsSummaryTool,
  metaAdsOverview: metaAdsOverviewTool,
  currentDate: currentDateTool,
  pnlSnapshot: pnlSnapshotTool,
  brandSummary: brandSummaryTool,
  productsInventory: productsInventoryTool,
  orgMembers: orgMembersTool,
  sendEmail: sendEmailTool,
};

export type AgentToolset = typeof agentTools;
