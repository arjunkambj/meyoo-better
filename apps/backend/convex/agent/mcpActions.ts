import { ConvexError, v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { rag } from "../rag";

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
  customerAcquisitionCost: number;
  grossMargin: number;
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
      await ctx.db.patch(apiKeyDoc._id, {
        lastUsed: Date.now(),
        usageCount: apiKeyDoc.usageCount + 1,
      });
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

    const analyticsResponse = await ctx.runQuery(api.web.analytics.getMetrics, {
      dateRange: { startDate: args.startDate, endDate: args.endDate },
      granularity: args.granularity ?? "daily",
      metrics: args.metrics,
    });

    const rows = Array.isArray(analyticsResponse)
      ? analyticsResponse
      : (analyticsResponse?.data?.orders ?? []);

    if (!rows.length) {
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
      summary: `Aggregated ${rows.length} ${args.granularity ?? "daily"} records from ${args.startDate} to ${args.endDate}.`,
      totals,
      records: rows,
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
  handler: async (ctx, args): Promise<{ summary: string; dateRange: { startDate: string; endDate: string; }; meta: { sessions: number; conversionRate: number; impressions: number; ctr: number; reach: number; frequency: number; uniqueClicks: number; cpc: number; costPerConversion: number; addToCart: number; initiateCheckout: number; pageViews: number; viewContent: number; linkClicks: number; outboundClicks: number; landingPageViews: number; videoViews: number; video3SecViews: number; costPerThruPlay: number; } }> => {
    const { organizationId: _organizationId } = await validateAndGetOrgContext(ctx, args.apiKey);

    const dateRange = args.startDate && args.endDate
      ? { startDate: args.startDate, endDate: args.endDate }
      : defaultDateRange();

    const metrics: any = await ctx.runQuery(api.web.analytics.getPlatformMetrics, {
      dateRange,
    });

    const emptyMeta = {
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

    const metaMetrics: { sessions: number; conversionRate: number; impressions: number; ctr: number; reach: number; frequency: number; uniqueClicks: number; cpc: number; costPerConversion: number; addToCart: number; initiateCheckout: number; pageViews: number; viewContent: number; linkClicks: number; outboundClicks: number; landingPageViews: number; videoViews: number; video3SecViews: number; costPerThruPlay: number; } = {
      sessions: metrics.metaSessions ?? 0,
      conversionRate: metrics.metaConversion ?? 0,
      impressions: metrics.metaImpressions ?? 0,
      ctr: metrics.metaCTR ?? 0,
      reach: metrics.metaReach ?? 0,
      frequency: metrics.metaFrequency ?? 0,
      uniqueClicks: metrics.metaUniqueClicks ?? 0,
      cpc: metrics.metaCPC ?? 0,
      costPerConversion: metrics.metaCostPerConversion ?? 0,
      addToCart: metrics.metaAddToCart ?? 0,
      initiateCheckout: metrics.metaInitiateCheckout ?? 0,
      pageViews: metrics.metaPageViews ?? 0,
      viewContent: metrics.metaViewContent ?? 0,
      linkClicks: metrics.metaLinkClicks ?? 0,
      outboundClicks: metrics.metaOutboundClicks ?? 0,
      landingPageViews: metrics.metaLandingPageViews ?? 0,
      videoViews: metrics.metaVideoViews ?? 0,
      video3SecViews: metrics.metaVideo3SecViews ?? 0,
      costPerThruPlay: metrics.metaCostPerThruPlay ?? 0,
    };

    return {
      summary: `Meta ads performance from ${dateRange.startDate} to ${dateRange.endDate}.`,
      dateRange,
      meta: metaMetrics,
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

    const overview = (await ctx.runQuery(api.web.orders.getOrdersOverview, {
      dateRange,
    })) as OrdersOverview | null;

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
      totalRevenue: Number(overview.totalRevenue ?? 0),
      totalCosts: Number(overview.totalCosts ?? 0),
      netProfit: Number(overview.netProfit ?? 0),
      avgOrderValue: Number(overview.avgOrderValue ?? 0),
      grossMargin: Number(overview.grossMargin ?? 0),
      customerAcquisitionCost: Number(overview.customerAcquisitionCost ?? 0),
    };

    const fulfillment = {
      fulfillmentRate: Number(overview.fulfillmentRate ?? 0),
      avgFulfillmentTime: Number(overview.avgFulfillmentTime ?? 0),
      returnRate: Number(overview.returnRate ?? 0),
    };

    const changesData = (overview.changes ?? {}) as Partial<OrdersOverviewChanges>;
    const changes = {
      totalOrders: Number(changesData.totalOrders ?? 0),
      revenue: Number(changesData.revenue ?? 0),
      netProfit: Number(changesData.netProfit ?? 0),
      avgOrderValue: Number(changesData.avgOrderValue ?? 0),
      cac: Number(changesData.cac ?? 0),
      margin: Number(changesData.margin ?? 0),
      fulfillmentRate: Number(changesData.fulfillmentRate ?? 0),
    };

    const summary = `Processed ${totals.totalOrders} orders (${totals.completedOrders} completed, ${totals.pendingOrders} pending) generating $${financials.totalRevenue.toFixed(2)} in revenue and $${financials.netProfit.toFixed(2)} net profit with a ${fulfillment.fulfillmentRate.toFixed(1)}% fulfillment rate.`;

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
  handler: async (ctx, args) => {
    await validateAndGetOrgContext(ctx, args.apiKey);

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

    const search = await rag.search(ctx, {
      namespace: String(organizationId),
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
