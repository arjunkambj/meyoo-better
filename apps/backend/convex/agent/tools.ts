import { createTool } from "@convex-dev/agent";
import { api } from "../_generated/api";
import { z } from "zod/v3";
import { rag } from "../rag";
import { requireUserAndOrg } from "../utils/auth";

const isoDate = z
  .string()
  .regex(/\d{4}-\d{2}-\d{2}/, "Use ISO date format (YYYY-MM-DD)");

function defaultDateRange(days: number = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const normalize = (d: Date) => d.toISOString().substring(0, 10);
  return { startDate: normalize(start), endDate: normalize(end) };
}

type AnalyticsRow = Record<string, unknown>;

type OrdersOverview = {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  avgOrderValue: number;
  grossMargin: number;
  customerAcquisitionCost: number;
  fulfillmentRate: number;
  avgFulfillmentTime: number;
  returnRate: number;
  changes?: {
    totalOrders?: number;
    revenue?: number;
    netProfit?: number;
    avgOrderValue?: number;
    cac?: number;
    margin?: number;
    fulfillmentRate?: number;
  };
};

type OrdersOverviewChanges = NonNullable<OrdersOverview["changes"]>;

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

type PnlMetrics = {
  revenue?: number;
  grossProfit?: number;
  netProfit?: number;
  grossProfitMargin?: number;
  netProfitMargin?: number;
  operatingExpenses?: number;
  totalAdSpend?: number;
  marketingROI?: number;
  ebitda?: number;
  revenueChange?: number;
  netProfitChange?: number;
  grossProfitMarginChange?: number;
  netProfitMarginChange?: number;
  marketingROIChange?: number;
};

type RawPlatformMetrics = {
  metaSessions: number;
  metaConversion: number;
  metaImpressions: number;
  metaCTR: number;
  metaReach: number;
  metaFrequency: number;
  metaUniqueClicks: number;
  metaCPC: number;
  metaCostPerConversion: number;
  metaAddToCart: number;
  metaInitiateCheckout: number;
  metaPageViews: number;
  metaViewContent: number;
  metaLinkClicks: number;
  metaOutboundClicks: number;
  metaLandingPageViews: number;
  metaVideoViews: number;
  metaVideo3SecViews: number;
  metaCostPerThruPlay: number;
};

type PlatformMetrics = {
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
    await requireUserAndOrg(ctx);
    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const overview = (await ctx.runQuery(api.web.orders.getOrdersOverview, {
      dateRange,
    })) as OrdersOverview | null;

    // Fallback revenue when analytics pipeline hasn't populated metrics yet
    let revenueFallback: number | null = null;
    if (overview && overview.totalOrders > 0 && Number(overview.totalRevenue ?? 0) === 0) {
      try {
        const fallback = await ctx.runQuery(api.web.orders.getRevenueSumForRange, { dateRange });
        if (fallback.totalOrders > 0) {
          revenueFallback = Number(fallback.totalRevenue ?? 0);
        }
      } catch (err) {
        console.debug('Revenue fallback unavailable:', err);
      }
    }

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

    const totals = {
      totalOrders: Number(overview.totalOrders ?? 0),
      pendingOrders: Number(overview.pendingOrders ?? 0),
      processingOrders: Number(overview.processingOrders ?? 0),
      completedOrders: Number(overview.completedOrders ?? 0),
      cancelledOrders: Number(overview.cancelledOrders ?? 0),
    };

    const financials = {
      totalRevenue: revenueFallback !== null
        ? Number(revenueFallback)
        : Number(overview.totalRevenue ?? 0),
      totalCosts: Number(overview.totalCosts ?? 0),
      netProfit: Number(overview.netProfit ?? 0),
      avgOrderValue: Number(overview.avgOrderValue ?? 0),
      grossMargin: Number(overview.grossMargin ?? 0),
      customerAcquisitionCost: Number(overview.customerAcquisitionCost ?? 0),
    };

    // If we used a fallback revenue and AOV is zero, compute a basic AOV
    if (revenueFallback !== null && totals.totalOrders > 0 && financials.avgOrderValue === 0) {
      financials.avgOrderValue = Number((revenueFallback / totals.totalOrders).toFixed(2));
    }

    const fulfillment = {
      fulfillmentRate: Number(overview.fulfillmentRate ?? 0),
      avgFulfillmentTime: Number(overview.avgFulfillmentTime ?? 0),
      returnRate: Number(overview.returnRate ?? 0),
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
    const rows =
      ((await ctx.runQuery(api.web.analytics.getMetrics, {
        dateRange: { startDate, endDate },
        granularity,
        metrics,
      })) as AnalyticsRow[] | null) ?? [];

    if (rows.length === 0) {
      return {
        summary: "No analytics available for the selected date range.",
        totals: {},
        records: [],
      };
    }

    const totals: Record<string, number> = {};
    for (const entry of rows) {
      for (const [key, value] of Object.entries(entry)) {
        if (typeof value === "number") {
          totals[key] = (totals[key] ?? 0) + value;
        }
      }
    }

    return {
      summary: `Aggregated ${rows.length} ${granularity} records from ${startDate} to ${endDate}.`,
      totals,
      records: rows,
    };
  },
});

export const metaAdsOverviewTool = createTool<
  { startDate?: string; endDate?: string },
  {
    summary: string;
    dateRange: { startDate: string; endDate: string };
    meta: PlatformMetrics;
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
  ): Promise<{ summary: string; dateRange: { startDate: string; endDate: string }; meta: PlatformMetrics }> => {
    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const metrics = (await ctx.runQuery(
      api.web.analytics.getPlatformMetrics,
      {
        dateRange,
      },
    )) as RawPlatformMetrics | null;

    const emptyMeta: PlatformMetrics = {
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

    if (!metrics) {
      return {
        summary: "No Meta ads metrics available",
        dateRange,
        meta: emptyMeta,
      };
    }

    const metaMetrics: PlatformMetrics = {
      sessions: metrics.metaSessions,
      conversionRate: metrics.metaConversion,
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
    };

    return {
      summary: `Meta ads performance from ${dateRange.startDate} to ${dateRange.endDate}.`,
      dateRange,
      meta: metaMetrics,
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
    await requireUserAndOrg(ctx);
    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const metrics = (await ctx.runQuery(api.web.pnl.getMetrics, {
      dateRange,
    })) as PnlMetrics | null;

    if (!metrics) {
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

    const revenue = Number(metrics.revenue ?? 0);
    const grossProfit = Number(metrics.grossProfit ?? 0);
    const netProfit = Number(metrics.netProfit ?? 0);
    const grossMargin = Number(metrics.grossProfitMargin ?? 0);
    const netMargin = Number(metrics.netProfitMargin ?? 0);
    const operatingExpenses = Number(metrics.operatingExpenses ?? 0);
    const adSpend = Number(metrics.totalAdSpend ?? 0);
    const marketingROI = Number(metrics.marketingROI ?? 0);
    const ebitda = Number(metrics.ebitda ?? 0);

    const changes = {
      revenue: Number(metrics.revenueChange ?? 0),
      netProfit: Number(metrics.netProfitChange ?? 0),
      grossMargin: Number(metrics.grossProfitMarginChange ?? 0),
      netMargin: Number(metrics.netProfitMarginChange ?? 0),
      marketingROI: Number(metrics.marketingROIChange ?? 0),
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
    const { orgId } = await requireUserAndOrg(ctx);
    const namespace = String(orgId);

    const search = await rag.search(ctx, {
      namespace,
      query: "brand summary",
      filters: [{ name: "type", value: "brand-summary" }],
      limit: 1,
    });

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
      reserved: number;
      available: number;
      reorderPoint: number;
      stockStatus: "healthy" | "low" | "critical" | "out";
      price: number;
      cost: number;
      margin: number;
      turnoverRate: number;
      unitsSold?: number;
      lastSold?: string;
      abcCategory: "A" | "B" | "C";
      variants?: Array<{
        id: string;
        sku: string;
        title: string;
        price: number;
        stock: number;
        reserved: number;
        available: number;
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
      reserved: number;
      available: number;
      reorderPoint: number;
      stockStatus: 'healthy' | 'low' | 'critical' | 'out';
      price: number;
      cost: number;
      margin: number;
      turnoverRate: number;
      unitsSold?: number;
      lastSold?: string;
      abcCategory: 'A' | 'B' | 'C';
      variants?: Array<{
        id: string;
        sku: string;
        title: string;
        price: number;
        stock: number;
        reserved: number;
        available: number;
      }>;
    }>;
  }> => {
    await requireUserAndOrg(ctx);

    const page = args.page && args.page > 0 ? args.page : 1;
    const pageSize = args.pageSize && args.pageSize > 0 ? Math.min(args.pageSize, 200) : 50;

    type ProductListResult = {
      data: Array<{
        id: string;
        name: string;
        sku: string;
        image?: string;
        category: string;
        vendor: string;
        stock: number;
        reserved: number;
        available: number;
        reorderPoint: number;
        stockStatus: 'healthy' | 'low' | 'critical' | 'out';
        price: number;
        cost: number;
        margin: number;
        turnoverRate: number;
        unitsSold?: number;
        lastSold?: string;
        abcCategory: 'A' | 'B' | 'C';
        variants?: Array<{
          id: string;
          sku: string;
          title: string;
          price: number;
          stock: number;
          reserved: number;
          available: number;
        }>;
      }>;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };

    const result: ProductListResult = await ctx.runQuery(api.web.inventory.getProductsList, {
      page,
      pageSize,
      stockLevel: args.stockLevel && args.stockLevel !== "all" ? args.stockLevel : undefined,
      searchTerm: args.search,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder as any,
    });

    const items = result.data.map((p: any) => ({
      id: String(p.id),
      name: String(p.name ?? ""),
      sku: String(p.sku ?? ""),
      category: String(p.category ?? ""),
      vendor: String(p.vendor ?? ""),
      stock: Number(p.stock ?? 0),
      reserved: Number(p.reserved ?? 0),
      available: Number(p.available ?? 0),
      reorderPoint: Number(p.reorderPoint ?? 0),
      stockStatus: p.stockStatus as 'healthy' | 'low' | 'critical' | 'out',
      price: Number(p.price ?? 0),
      cost: Number(p.cost ?? 0),
      margin: Number(p.margin ?? 0),
      turnoverRate: Number(p.turnoverRate ?? 0),
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
            reserved: Number(v.reserved ?? 0),
            available: Number(v.available ?? 0),
          }))
        : undefined,
    }));

    const summary = `Found ${result.pagination.total} products (${result.pagination.totalPages} pages). Page ${result.pagination.page} of ${result.pagination.totalPages}.`;

    return {
      summary,
      page: result.pagination.page,
      pageSize: result.pagination.pageSize,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
      items,
    };
  },
});

export const orgMembersTool = createTool<
  Record<string, never>,
  {
    summary: string;
    counts: {
      total: number;
      active: number;
      suspended: number;
      owners: number;
      team: number;
    };
    owner: null | {
      id: string;
      name?: string;
      email?: string;
      image?: string;
      role: "StoreOwner" | "StoreTeam";
      status: "active" | "suspended" | "removed";
    };
    members: Array<{
      id: string;
      name?: string;
      email?: string;
      image?: string;
      role: "StoreOwner" | "StoreTeam";
      status: "active" | "suspended" | "removed";
      isOwner: boolean;
    }>;
  }
>({
  description:
    "List all organization members, including the owner, with role and status details.",
  args: z.object({}),
  handler: async (ctx) => {
    await requireUserAndOrg(ctx);

    // Use existing query that joins memberships with user profiles
    const team = (await ctx.runQuery(api.core.teams.getTeamMembers, {})) as Array<
      {
        _id: string;
        email?: string;
        name?: string;
        image?: string;
        role: "StoreOwner" | "StoreTeam";
        status: "active" | "suspended" | "removed";
      }
    >;

    // Map to clean shape
    const members = team.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      status: u.status,
      isOwner: u.role === "StoreOwner",
    }));

    const owners = members.filter((m) => m.isOwner);
    const owner = owners[0]
      ? {
          id: owners[0].id,
          name: owners[0].name,
          email: owners[0].email,
          image: owners[0].image,
          role: owners[0].role,
          status: owners[0].status,
        }
      : null;

    const counts = {
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      suspended: members.filter((m) => m.status === "suspended").length,
      owners: owners.length,
      team: members.filter((m) => m.role === "StoreTeam").length,
    } as const;

    const summary =
      members.length === 0
        ? "No members found for this organization."
        : `Organization has ${counts.total} members (${counts.owners} owner, ${counts.team} team). ${counts.active} active, ${counts.suspended} suspended.`;

    return {
      summary,
      counts,
      owner,
      members,
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
};

export type AgentToolset = typeof agentTools;
