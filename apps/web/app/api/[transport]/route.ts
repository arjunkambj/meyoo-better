import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { api } from "../../../../backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
}

const convexClient = new ConvexHttpClient(convexUrl);

const resolveApiToken = (
  extra: { authInfo?: AuthInfo },
  providedKey?: string
) => {
  const token = extra.authInfo?.token ?? providedKey;

  if (!token) {
    throw new Error(
      "Authentication required. Include an Authorization header or provide an apiKey input."
    );
  }

  return token;
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch (stringifyError) {
    void stringifyError;
    return String(error);
  }
};

const handler = createMcpHandler(
  (server) => {
    // Orders Summary Tool
    server.tool(
      "orders_summary",
      "Summarize order volumes, revenue, and fulfillment performance over a date range",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        startDate: z
          .string()
          .regex(/\d{4}-\d{2}-\d{2}/)
          .optional()
          .describe("Start date in ISO format (YYYY-MM-DD)"),
        endDate: z
          .string()
          .regex(/\d{4}-\d{2}-\d{2}/)
          .optional()
          .describe("End date in ISO format (YYYY-MM-DD)"),
      },
      async ({ apiKey, startDate, endDate }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.ordersSummary, {
            apiKey: token,
            startDate,
            endDate,
          });

          const lines = [
            `Orders Summary (${result.dateRange.startDate} to ${result.dateRange.endDate})`,
            "",
            `Total Orders: ${result.totals.totalOrders}`,
            `Completed: ${result.totals.completedOrders} | Pending: ${result.totals.pendingOrders} | Processing: ${result.totals.processingOrders}`,
            `Cancelled: ${result.totals.cancelledOrders}`,
            "",
            `Revenue: $${result.financials.totalRevenue.toFixed(2)} | Net Profit: $${result.financials.netProfit.toFixed(2)}`,
            `Avg Order Value: $${result.financials.avgOrderValue.toFixed(2)} | Gross Margin: ${result.financials.grossMargin.toFixed(1)}%`,
            `Fulfillment Rate: ${result.fulfillment.fulfillmentRate.toFixed(1)}% | Returns: ${result.fulfillment.returnRate.toFixed(1)}%`,
            "",
            result.summary,
          ];

          return {
            content: [{ type: "text", text: lines.join("\n") }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error summarizing orders: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Inventory Low Stock Tool
    server.tool(
      "inventory_low_stock",
      "List products that are low or critical on stock to guide replenishment",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .default(10)
          .describe("Maximum number of alerts to return")
          .optional(),
      },
      async ({ apiKey, limit }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.inventoryLowStock, {
            apiKey: token,
            limit,
          });

          if (result.totalAlerts === 0) {
            return {
              content: [{ type: "text", text: "No low-stock alerts detected. Inventory levels look healthy." }],
            };
          }

          const lines = [
            `Low Stock Alerts (${result.totalAlerts})`,
            "",
            ...result.alerts.map((alert, index) =>
              `${index + 1}. ${alert.productName} (SKU: ${alert.sku})\n` +
              `   Level: ${alert.type.toUpperCase()} | On Hand: ${alert.currentStock}` +
              `${alert.reorderPoint ? ` | Reorder Point: ${alert.reorderPoint}` : ""}` +
              `${typeof alert.daysUntilStockout === "number" ? ` | Est. Days Left: ${alert.daysUntilStockout}` : ""}\n` +
              `   ${alert.message}`
            ),
          ];

          return {
            content: [{ type: "text", text: lines.join("\n\n") }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error retrieving inventory alerts: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // P&L Snapshot Tool
    server.tool(
      "pnl_snapshot",
      "Summarize profit and loss metrics (revenue, margins, spend) for a date range",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        startDate: z
          .string()
          .regex(/\d{4}-\d{2}-\d{2}/)
          .optional()
          .describe("Start date in ISO format (YYYY-MM-DD)"),
        endDate: z
          .string()
          .regex(/\d{4}-\d{2}-\d{2}/)
          .optional()
          .describe("End date in ISO format (YYYY-MM-DD)"),
      },
      async ({ apiKey, startDate, endDate }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.pnlSnapshot, {
            apiKey: token,
            startDate,
            endDate,
          });

          const lines = [
            `P&L Snapshot (${result.dateRange.startDate} to ${result.dateRange.endDate})`,
            "",
            `Revenue: $${result.revenue.toFixed(2)} | Gross Profit: $${result.grossProfit.toFixed(2)} | Net Profit: $${result.netProfit.toFixed(2)}`,
            `Gross Margin: ${result.grossMargin.toFixed(1)}% | Net Margin: ${result.netMargin.toFixed(1)}%`,
            `Operating Expenses: $${result.operatingExpenses.toFixed(2)} | Ad Spend: $${result.adSpend.toFixed(2)} | EBITDA: $${result.ebitda.toFixed(2)}`,
            `Marketing ROI Change: ${result.changes.marketingROI.toFixed(2)} pts`,
            "",
            result.summary,
          ];

          return {
            content: [{ type: "text", text: lines.join("\n") }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error generating P&L snapshot: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Analytics Summary Tool
    server.tool(
      "analytics_summary",
      "Summarize store performance metrics over a date range (daily/weekly/monthly)",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        startDate: z.string().regex(/\d{4}-\d{2}-\d{2}/).describe("Start date in ISO format (YYYY-MM-DD)"),
        endDate: z.string().regex(/\d{4}-\d{2}-\d{2}/).describe("End date in ISO format (YYYY-MM-DD)"),
        granularity: z.enum(["daily", "weekly", "monthly"]).default("daily").describe("Aggregation granularity"),
        metrics: z.array(z.string()).optional().describe("Specific metric field names to include"),
      },
      async ({ apiKey, startDate, endDate, granularity, metrics }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.analyticsSummary, {
            apiKey: token,
            startDate,
            endDate,
            granularity,
            metrics,
          });

          const metricsText = Object.entries(result.totals)
            .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`)
            .join('\n');

          const response = `${result.summary}\n\n` +
            `Total Metrics:\n${metricsText}\n\n` +
            `Records: ${result.records.length} ${granularity} data points`;

          return {
            content: [{ type: "text", text: response }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error fetching analytics: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Meta Ads Overview Tool
    server.tool(
      "meta_ads_overview",
      "Retrieve Meta ads performance metrics (impressions, clicks, conversions, CPC, etc.) for a date window",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        startDate: z.string().regex(/\d{4}-\d{2}-\d{2}/).optional().describe("Start date in ISO format (YYYY-MM-DD)"),
        endDate: z.string().regex(/\d{4}-\d{2}-\d{2}/).optional().describe("End date in ISO format (YYYY-MM-DD)"),
      },
      async ({ apiKey, startDate, endDate }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.metaAdsOverview, {
            apiKey: token,
            startDate,
            endDate,
          });

          const metricsText = `
📊 Meta Ads Performance (${result.dateRange.startDate} to ${result.dateRange.endDate})

Traffic Metrics:
• Sessions: ${result.meta.sessions.toLocaleString()}
• Impressions: ${result.meta.impressions.toLocaleString()}
• Reach: ${result.meta.reach.toLocaleString()}
• Unique Clicks: ${result.meta.uniqueClicks.toLocaleString()}

Engagement Rates:
• CTR: ${(result.meta.ctr * 100).toFixed(2)}%
• Conversion Rate: ${(result.meta.conversionRate * 100).toFixed(2)}%
• Frequency: ${result.meta.frequency.toFixed(2)}

Cost Metrics:
• CPC: $${result.meta.cpc.toFixed(2)}
• Cost per Conversion: $${result.meta.costPerConversion.toFixed(2)}
• Cost per Video View: $${result.meta.costPerThruPlay.toFixed(2)}

User Actions:
• Add to Cart: ${result.meta.addToCart}
• Initiate Checkout: ${result.meta.initiateCheckout}
• Page Views: ${result.meta.pageViews}
• Content Views: ${result.meta.viewContent}

Video Performance:
• Video Views: ${result.meta.videoViews}
• 3-Second Views: ${result.meta.video3SecViews}
`;

          return {
            content: [{ type: "text", text: metricsText }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error fetching Meta ads data: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Current Date Tool
    server.tool(
      "current_date",
      "Returns the current date in ISO 8601 format (UTC). Use this when you need to reference 'today' explicitly",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
      },
      async ({ apiKey }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.getCurrentDate, {
            apiKey: token,
          });

          const response = `Current Date Information:\n` +
            `• ISO Date: ${result.isoDate}\n` +
            `• ISO DateTime: ${result.isoDateTime}\n` +
            `• UTC: ${result.utc}`;

          return {
            content: [{ type: "text", text: response }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error getting current date: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Brand Summary Tool
    server.tool(
      "brand_summary",
      "Retrieve the latest stored overview of the merchant brand. Use this to understand positioning, key products, and sales cadence",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
      },
      async ({ apiKey }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.getBrandSummary, {
            apiKey: token,
          });

          let response = `Brand Summary:\n\n${result.summary}`;

          if (result.generatedAt) {
            response += `\n\nGenerated: ${result.generatedAt}`;
          }
          if (result.source) {
            response += `\nSource: ${result.source}`;
          }

          return {
            content: [{ type: "text", text: response }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error fetching brand summary: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );
  },
  {
    serverInfo: {
      name: "Meyoo Analytics MCP Server",
      version: "1.0.0",
    },
  },
  {
    redisUrl: process.env.REDIS_URL,
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  }
);

const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) {
    return undefined;
  }

  try {
    const validation = await convexClient.query(api.web.security.validateApiKey, {
      key: bearerToken,
    });

    if (!validation || validation.valid !== true) {
      return undefined;
    }

    return {
      token: bearerToken,
      clientId: validation.userId,
      scopes: [`organization:${validation.organizationId}:read`],
      extra: {
        organizationId: validation.organizationId,
        userId: validation.userId,
        organization: validation.organization,
      },
    };
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to validate API key", error);
    }
    return undefined;
  }
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };
