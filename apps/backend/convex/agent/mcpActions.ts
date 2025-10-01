import { ConvexError, v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { rag } from "../rag";
import { resend } from "../integrations/resend";
import type {
  OrdersAnalyticsResult,
  PlatformMetrics as AggregatedPlatformMetrics,
  PnLAnalyticsResult,
  PnLTablePeriod,
} from "@repo/types";

const hashApiKey = (key: string) => {
  let h1 = 0xdeadbeef ^ key.length;
  let h2 = 0x41c6ce57 ^ key.length;

  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return combined.padStart(32, "0");
};

function defaultDateRange(days: number = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const normalize = (d: Date) => d.toISOString().substring(0, 10);
  return { startDate: normalize(start), endDate: normalize(end) };
}

type ValidatedOrganization = {
  _id: Id<"organizations">;
  name: string;
  timezone?: string;
  locale?: string;
  isPremium?: boolean;
  trialEndDate?: number;
};

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

type PnLSnapshotResult = {
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
};

const validateAndGetOrgContext = async (
  ctx: ActionCtx,
  apiKey: string
): Promise<{
  userId: Id<"users">;
  organizationId: Id<"organizations">;
  organization: ValidatedOrganization;
}> => {
  const validation = await ctx.runQuery(api.web.security.validateApiKey, { key: apiKey });

  if (!validation.valid) {
    throw new ConvexError(validation.reason);
  }

  await ctx.runMutation(internal.agent.mcpActions.updateApiKeyUsage, {
    apiKey
  });

  return {
    userId: validation.userId,
    organizationId: validation.organizationId,
    organization: validation.organization as ValidatedOrganization,
  };
};

export const updateApiKeyUsage = internalMutation({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const hashedKey = hashApiKey(args.apiKey);

    const apiKeyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", hashedKey))
      .first();

    if (apiKeyDoc) {
      const newUsageCount = apiKeyDoc.usageCount + 1;
      await ctx.db.patch(apiKeyDoc._id, {
        lastUsed: Date.now(),
        usageCount: newUsageCount,
      });
      console.log("[API KEY USAGE]", {
        keyId: apiKeyDoc._id,
        usageCount: newUsageCount,
        lastUsed: new Date().toISOString(),
      });
    } else {
      console.warn("[API KEY USAGE] Key not found in database (might be invalid)");
    }
  },
});

export const analyticsSummary = action({
  args: {
    apiKey: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    granularity: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))),
    metrics: v.optional(v.array(v.string())),
  },
  returns: v.object({
    summary: v.string(),
    totals: v.record(v.string(), v.number()),
    records: v.array(v.any()),
  }),
  handler: async (ctx, args): Promise<{ summary: string; totals: Record<string, number>; records: any[] }> => {
    const { organizationId: _organizationId } = await validateAndGetOrgContext(ctx, args.apiKey);

    const analyticsResponse = await ctx.runQuery(api.web.pnl.getAnalytics, {
      dateRange: { startDate: args.startDate, endDate: args.endDate },
      granularity: args.granularity ?? "daily",
    });

    const periods = analyticsResponse?.result?.periods ?? [];

    if (periods.length === 0) {
      return {
        summary: "No analytics available for the selected date range.",
        totals: {},
        records: [],
      };
    }

    const selected = args.metrics && args.metrics.length > 0 ? new Set(args.metrics) : null;

    const records = periods.map((period: PnLTablePeriod) => {
      const record: Record<string, number | string> = {
        label: period.label,
        date: period.date,
      };

      for (const [key, value] of Object.entries(period.metrics as unknown as Record<string, number>)) {
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
      summary: `Aggregated ${records.length} ${args.granularity ?? "daily"} records from ${args.startDate} to ${args.endDate}.`,
      totals,
      records,
    };
  },
});

export const metaAdsOverview = action({
  args: {
    apiKey: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.object({
    summary: v.string(),
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    meta: v.object({
      sessions: v.number(),
      conversionRate: v.number(),
      impressions: v.number(),
      ctr: v.number(),
      reach: v.number(),
      frequency: v.number(),
      uniqueClicks: v.number(),
      cpc: v.number(),
      costPerConversion: v.number(),
      addToCart: v.number(),
      initiateCheckout: v.number(),
      pageViews: v.number(),
      viewContent: v.number(),
      linkClicks: v.number(),
      outboundClicks: v.number(),
      landingPageViews: v.number(),
      videoViews: v.number(),
      video3SecViews: v.number(),
      costPerThruPlay: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<{ summary: string; dateRange: { startDate: string; endDate: string; }; meta: MetaPlatformSummary }> => {
    const { organizationId: _organizationId } = await validateAndGetOrgContext(ctx, args.apiKey);

    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const metricsResponse = await ctx.runQuery(
      api.web.analytics.getPlatformMetricsSummary,
      {
        dateRange,
      },
    );

    const metrics = (metricsResponse as { metrics: AggregatedPlatformMetrics } | null)?.metrics;

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
      ? `Meta ads performance from ${dateRange.startDate} to ${dateRange.endDate}.`
      : "No Meta ads metrics available";

    return {
      summary,
      dateRange,
      meta,
    };
  },
});

export const ordersSummary = action({
  args: {
    apiKey: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.object({
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    totals: v.object({
      totalOrders: v.number(),
      pendingOrders: v.number(),
      processingOrders: v.number(),
      completedOrders: v.number(),
      cancelledOrders: v.number(),
    }),
    financials: v.object({
      totalRevenue: v.number(),
      totalCosts: v.number(),
      netProfit: v.number(),
      avgOrderValue: v.number(),
      grossMargin: v.number(),
      customerAcquisitionCost: v.number(),
    }),
    fulfillment: v.object({
      fulfillmentRate: v.number(),
      avgFulfillmentTime: v.number(),
      returnRate: v.number(),
    }),
    changes: v.object({
      totalOrders: v.number(),
      revenue: v.number(),
      netProfit: v.number(),
      avgOrderValue: v.number(),
      cac: v.number(),
      margin: v.number(),
      fulfillmentRate: v.number(),
    }),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    await validateAndGetOrgContext(ctx, args.apiKey);

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
      totalOrders: overview.totalOrders,
      pendingOrders: statusCounts.pending,
      processingOrders: statusCounts.processing,
      completedOrders: statusCounts.completed,
      cancelledOrders: statusCounts.cancelled,
    };

    const financials = {
      totalRevenue: overview.totalRevenue,
      totalCosts: overview.totalCosts,
      netProfit: overview.netProfit,
      avgOrderValue: overview.avgOrderValue,
      grossMargin: overview.grossMargin,
      customerAcquisitionCost: overview.customerAcquisitionCost,
    };

    const fulfillment = {
      fulfillmentRate: overview.fulfillmentRate,
      avgFulfillmentTime: fulfillmentDetails?.avgProcessingTime ?? 0,
      returnRate: fulfillmentDetails?.returnRate ?? 0,
    };

    const changesData = overview.changes ?? {
      totalOrders: 0,
      revenue: 0,
      netProfit: 0,
      avgOrderValue: 0,
      cac: 0,
      margin: 0,
      fulfillmentRate: 0,
    };

    const summary = `Processed ${totals.totalOrders} orders (${totals.completedOrders} fulfilled, ${totals.pendingOrders} pending) generating $${financials.totalRevenue.toFixed(2)} in revenue and $${financials.netProfit.toFixed(2)} net profit with a ${fulfillment.fulfillmentRate.toFixed(1)}% fulfillment rate.`;

    return {
      dateRange,
      totals,
      financials,
      fulfillment,
      changes: {
        totalOrders: Number(changesData.totalOrders ?? 0),
        revenue: Number(changesData.revenue ?? 0),
        netProfit: Number(changesData.netProfit ?? 0),
        avgOrderValue: Number(changesData.avgOrderValue ?? 0),
        cac: Number(changesData.cac ?? 0),
        margin: Number(changesData.margin ?? 0),
        fulfillmentRate: Number(changesData.fulfillmentRate ?? 0),
      },
      summary,
    };
  },
});

export const inventoryLowStock = action({
  args: {
    apiKey: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    summary: v.string(),
    totalAlerts: v.number(),
    alerts: v.array(
      v.object({
        id: v.string(),
        type: v.union(
          v.literal("critical"),
          v.literal("low"),
          v.literal("reorder"),
        ),
        productName: v.string(),
        sku: v.string(),
        currentStock: v.number(),
        reorderPoint: v.optional(v.number()),
        daysUntilStockout: v.optional(v.number()),
        message: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await validateAndGetOrgContext(ctx, args.apiKey);

    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 50) : 10;
    const alertsResponse = (await ctx.runQuery(api.web.inventory.getStockAlerts, {
      limit,
    })) as InventoryAlert[] | null;

    const alerts = alertsResponse ?? [];

    const filtered = alerts.filter((alert) => alert.type !== "overstock");

    const summary = filtered.length === 0
      ? "No low-stock alerts detected. Inventory levels look healthy."
      : `Identified ${filtered.length} products that require restocking attention.`;

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

export const pnlSnapshot = action({
  args: {
    apiKey: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.object({
    summary: v.string(),
    dateRange: v.object({
      startDate: v.string(),
      endDate: v.string(),
    }),
    revenue: v.number(),
    grossProfit: v.number(),
    netProfit: v.number(),
    grossMargin: v.number(),
    netMargin: v.number(),
    operatingExpenses: v.number(),
    adSpend: v.number(),
    marketingROI: v.number(),
    ebitda: v.number(),
    changes: v.object({
      revenue: v.number(),
      netProfit: v.number(),
      grossMargin: v.number(),
      netMargin: v.number(),
      marketingROI: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<PnLSnapshotResult> => {
    console.log("[MCP TOOL CALL] pnlSnapshot", { startDate: args.startDate, endDate: args.endDate });
    await validateAndGetOrgContext(ctx, args.apiKey);

    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const pnlResponse = (await ctx.runQuery(api.web.pnl.getAnalytics, {
      dateRange,
      granularity: "monthly",
    })) as { result: PnLAnalyticsResult } | null;

    const metrics = pnlResponse?.result?.metrics;
    const totals = pnlResponse?.result?.totals;

    console.log("[MCP TOOL CALL] pnlSnapshot - raw data", {
      hasMetrics: !!metrics,
      hasTotals: !!totals,
      revenue: totals?.revenue,
      netProfit: totals?.netProfit,
      grossProfit: totals?.grossProfit
    });

    if (!metrics || !totals) {
      console.log("[MCP TOOL CALL] pnlSnapshot - No metrics or totals found");
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
    const grossProfit = Number(metrics.grossProfit ?? totals.grossProfit ?? 0);
    const netProfit = Number(totals.netProfit ?? 0);
    const currentNetRevenue = Number(metrics.netRevenue ?? revenue);
    const grossMargin = currentNetRevenue > 0 ? (grossProfit / currentNetRevenue) * 100 : 0;
    const netMargin = Number(metrics.netMargin ?? 0);
    const operatingExpenses = Number(metrics.operatingExpenses ?? 0);
    const adSpend = Number(metrics.marketingCost ?? totals.totalAdSpend ?? 0);
    const marketingROI = Number(metrics.marketingROI ?? 0);
    const ebitda = Number(metrics.ebitda ?? 0);

    const grossProfitChange = Number(metrics.changes?.grossProfit ?? 0);
    const netRevenueChange = Number(metrics.changes?.netRevenue ?? 0);
    const previousNetRevenue = currentNetRevenue - netRevenueChange;
    const previousGrossProfit = grossProfit - grossProfitChange;
    const previousGrossMargin = previousNetRevenue > 0
      ? (previousGrossProfit / previousNetRevenue) * 100
      : null;
    const grossMarginChange = previousGrossMargin !== null && Number.isFinite(previousGrossMargin)
      ? grossMargin - previousGrossMargin
      : 0;

    const changes = {
      revenue: Number(metrics.changes?.grossSales ?? 0),
      netProfit: Number(metrics.changes?.netProfit ?? 0),
      grossMargin: grossMarginChange,
      netMargin: Number(metrics.changes?.netMargin ?? 0),
      marketingROI: Number(metrics.changes?.marketingROI ?? 0),
    };

    const summary = `Revenue of $${revenue.toFixed(2)} generated $${netProfit.toFixed(2)} in net profit (${netMargin.toFixed(1)}% net margin) with $${operatingExpenses.toFixed(2)} in operating expenses.`;

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

export const getCurrentDate = action({
  args: {
    apiKey: v.string(),
  },
  returns: v.object({
    isoDate: v.string(),
    isoDateTime: v.string(),
    utc: v.string(),
  }),
  handler: async (ctx, args): Promise<{ isoDate: string; isoDateTime: string; utc: string; }> => {
    console.log("[MCP TOOL CALL] getCurrentDate");
    await validateAndGetOrgContext(ctx, args.apiKey);

    const now = new Date();
    return {
      isoDate: now.toISOString().slice(0, 10),
      isoDateTime: now.toISOString(),
      utc: now.toUTCString(),
    };
  },
});

export const getBrandSummary = action({
  args: {
    apiKey: v.string(),
  },
  returns: v.object({
    summary: v.string(),
    generatedAt: v.optional(v.string()),
    source: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { organizationId } = await validateAndGetOrgContext(ctx, args.apiKey);

    let search;
    try {
      search = await rag.search(ctx, {
        namespace: String(organizationId),
        query: "brand summary",
        filters: [{ name: "type", value: "brand-summary" }],
        limit: 1,
      });
    } catch (error) {
      console.error("[MCP] getBrandSummary - RAG search error:", error);
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

export const productsInventory = action({
  args: {
    apiKey: v.string(),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    stockLevel: v.optional(v.union(v.literal("all"), v.literal("healthy"), v.literal("low"), v.literal("critical"), v.literal("out"))),
    search: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    summary: v.string(),
    page: v.number(),
    pageSize: v.number(),
    total: v.number(),
    totalPages: v.number(),
    items: v.array(v.object({
      id: v.string(),
      name: v.string(),
      sku: v.string(),
      category: v.string(),
      vendor: v.string(),
      stock: v.number(),
      reserved: v.number(),
      available: v.number(),
      reorderPoint: v.number(),
      stockStatus: v.union(v.literal("healthy"), v.literal("low"), v.literal("critical"), v.literal("out")),
      price: v.number(),
      cost: v.number(),
      margin: v.number(),
      turnoverRate: v.number(),
      unitsSold: v.optional(v.number()),
      lastSold: v.optional(v.string()),
      abcCategory: v.union(v.literal("A"), v.literal("B"), v.literal("C")),
      variants: v.optional(v.array(v.object({
        id: v.string(),
        sku: v.string(),
        title: v.string(),
        price: v.number(),
        stock: v.number(),
        reserved: v.number(),
        available: v.number(),
      }))),
    })),
  }),
  handler: async (ctx, args) => {
    await validateAndGetOrgContext(ctx, args.apiKey);

    const page = args.page && args.page > 0 ? args.page : 1;
    const pageSize = args.pageSize && args.pageSize > 0 ? Math.min(args.pageSize, 200) : 50;

    type ProductListResult = {
      data: Array<{
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

type OrgMemberRole = "StoreOwner" | "StoreTeam";
type OrgMemberStatus = "active" | "suspended" | "removed";

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

export const orgMembers = action({
  args: {
    apiKey: v.string(),
    role: v.optional(v.union(v.literal("StoreOwner"), v.literal("StoreTeam"))),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("removed"))),
    includeRemoved: v.optional(v.boolean()),
  },
  returns: v.object({
    summary: v.string(),
    counts: v.object({
      total: v.number(),
      active: v.number(),
      suspended: v.number(),
      owners: v.number(),
      team: v.number(),
      removed: v.number(),
    }),
    filtered: v.object({
      total: v.number(),
      active: v.number(),
      suspended: v.number(),
      owners: v.number(),
      team: v.number(),
      removed: v.number(),
      appliedFilters: v.array(v.string()),
    }),
    owner: v.union(
      v.null(),
      v.object({
        id: v.string(),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        image: v.optional(v.string()),
        role: v.union(v.literal("StoreOwner"), v.literal("StoreTeam")),
        status: v.union(v.literal("active"), v.literal("suspended"), v.literal("removed")),
        joinedAt: v.optional(v.string()),
      })
    ),
    members: v.array(v.object({
      id: v.string(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      role: v.union(v.literal("StoreOwner"), v.literal("StoreTeam")),
      status: v.union(v.literal("active"), v.literal("suspended"), v.literal("removed")),
      isOwner: v.boolean(),
      isOnboarded: v.optional(v.boolean()),
      joinedAt: v.optional(v.string()),
      lastUpdatedAt: v.optional(v.string()),
    })),
  }),
  handler: async (ctx, args) => {
    await validateAndGetOrgContext(ctx, args.apiKey);

    const { role, status, includeRemoved = false } = args;

    const team = (await ctx.runQuery(api.core.teams.getTeamMembers, {})) as OrgMemberRecord[];

    const toIsoString = (timestamp?: number | null) =>
      typeof timestamp === "number" && Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : undefined;

    const members = team.map((member) => {
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
      };
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

const DEFAULT_FROM_EMAIL = "Meyoo <noreply@meyoo.io>";

export const sendEmail = action({
  args: {
    apiKey: v.string(),
    memberId: v.optional(v.string()),
    toEmail: v.optional(v.string()),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    replyTo: v.optional(v.array(v.string())),
    from: v.optional(v.string()),
    previewOnly: v.optional(v.boolean()),
  },
  returns: v.object({
    status: v.union(v.literal("queued"), v.literal("preview"), v.literal("error")),
    summary: v.string(),
    to: v.optional(v.string()),
    subject: v.optional(v.string()),
    emailId: v.optional(v.string()),
    recipientName: v.optional(v.string()),
    memberId: v.optional(v.string()),
    testMode: v.optional(v.boolean()),
    preview: v.optional(v.union(
      v.null(),
      v.object({
        html: v.optional(v.string()),
        text: v.optional(v.string()),
      })
    )),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await validateAndGetOrgContext(ctx, args.apiKey);

    if (!args.memberId && !args.toEmail) {
      return {
        status: "error" as const,
        summary: "Provide either memberId or toEmail to resolve the recipient.",
        error: "missing_recipient",
      };
    }

    if ((!args.html || args.html.trim().length === 0) && (!args.text || args.text.trim().length === 0)) {
      return {
        status: "error" as const,
        summary: "Provide email content in html and/or text.",
        error: "missing_body",
      };
    }

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
          status: "error" as const,
          summary: `No organization member found for id ${args.memberId}. Confirm the recipient before retrying.`,
          memberId: args.memberId,
          error: "member_not_found",
        };
      }
      if (!match.email) {
        return {
          status: "error" as const,
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
        status: "error" as const,
        summary:
          "No recipient email could be resolved. Confirm the address with the user before invoking this tool again.",
        error: "missing_recipient",
      };
    }

    const sanitizedHtml = htmlBody && htmlBody.length > 0 ? htmlBody : undefined;
    const sanitizedText = textBody && textBody.length > 0 ? textBody : undefined;

    if (!sanitizedHtml && !sanitizedText) {
      return {
        status: "error" as const,
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
        status: "preview" as const,
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
      status: "queued" as const,
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
