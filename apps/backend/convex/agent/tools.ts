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

type CustomerListItem = {
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

type CustomerListResponse = {
  data: CustomerListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type AnalyticsRow = Record<string, unknown>;

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

export const searchCustomersTool = createTool<
  { query: string; limit: number },
  {
    totalMatches: number;
    topCustomers: Array<{
      id: string;
      name: string;
      email: string;
      status: string;
      segment: string;
      lifetimeValue: number;
      orders: number;
      avgOrderValue: number;
      lastOrderDate: string;
      country?: string;
    }>;
  }
>({
  description:
    "Search for customers by name or email and return lifetime value and activity details.",
  args: z.object({
    query: z
      .string()
      .trim()
      .min(1, "Provide a name or email to search for"),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .default(5)
      .describe("Maximum number of customers to return"),
  }),
  handler: async (
    ctx,
    { query, limit },
  ): Promise<{
    totalMatches: number;
    topCustomers: Array<{
      id: string;
      name: string;
      email: string;
      status: string;
      segment: string;
      lifetimeValue: number;
      orders: number;
      avgOrderValue: number;
      lastOrderDate: string;
      country?: string;
    }>;
  }> => {
    const result = (await ctx.runQuery(
      api.web.customers.getCustomerList,
      {
        page: 1,
        pageSize: limit,
        searchTerm: query,
      },
    )) as CustomerListResponse;

    return {
      totalMatches: result.pagination.total,
      topCustomers: result.data.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
        segment: customer.segment,
        lifetimeValue: customer.lifetimeValue,
        orders: customer.orders,
        avgOrderValue: Number(customer.avgOrderValue.toFixed(2)),
        lastOrderDate: customer.lastOrderDate,
        country: customer.country,
      })),
    };
  },
});

export const analyticsSummaryTool = createTool<
  {
    startDate: string;
    endDate: string;
    granularity: "daily" | "weekly" | "monthly";
    metrics?: string[];
  },
  {
    summary: string;
    totals: Record<string, number>;
    records: AnalyticsRow[];
  }
>({
  description:
    "Summarize store performance metrics over a date range (daily/weekly/monthly).",
  args: z.object({
    startDate: isoDate,
    endDate: isoDate,
    granularity: z
      .enum(["daily", "weekly", "monthly"])
      .default("daily"),
    metrics: z
      .array(z.string())
      .optional()
      .describe("Specific metric field names to include (optional)"),
  }),
  handler: async (
    ctx,
    { startDate, endDate, granularity, metrics },
  ): Promise<{
    summary: string;
    totals: Record<string, number>;
    records: AnalyticsRow[];
  }> => {
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

    let summary = extractSummary();

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

export const agentTools = {
  searchCustomers: searchCustomersTool,
  analyticsSummary: analyticsSummaryTool,
  metaAdsOverview: metaAdsOverviewTool,
  currentDate: currentDateTool,
  brandSummary: brandSummaryTool,
};

export type AgentToolset = typeof agentTools;
