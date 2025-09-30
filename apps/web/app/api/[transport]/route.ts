import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { api } from "../../../../backend/convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { optionalEnv, requireEnv } from "@/libs/env";

const CONVEX_URL = requireEnv("NEXT_PUBLIC_CONVEX_URL");
const REDIS_URL = optionalEnv("REDIS_URL");

const convexClient = new ConvexHttpClient(CONVEX_URL);

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

    // Products Inventory Tool
    server.tool(
      "products_inventory",
      "List all products with inventory details, variants, and stock status (paginated)",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Page number (default: 1)"),
        pageSize: z
          .number()
          .int()
          .positive()
          .max(200)
          .optional()
          .describe("Items per page (default: 50, max: 200)"),
        stockLevel: z
          .enum(["all", "healthy", "low", "critical", "out"])
          .optional()
          .describe("Filter by stock level"),
        search: z
          .string()
          .optional()
          .describe("Search term for product name or SKU"),
        sortBy: z
          .string()
          .optional()
          .describe("Field to sort by"),
        sortOrder: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction"),
      },
      async ({ apiKey, page, pageSize, stockLevel, search, sortBy, sortOrder }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.productsInventory, {
            apiKey: token,
            page,
            pageSize,
            stockLevel,
            search,
            sortBy,
            sortOrder,
          });

          const lines = [
            result.summary,
            "",
            ...result.items.slice(0, 10).map((item, index) =>
              `${index + 1}. ${item.name} (SKU: ${item.sku})\n` +
              `   Stock: ${item.stock} (${item.available} available, ${item.reserved} reserved) | Status: ${item.stockStatus.toUpperCase()}\n` +
              `   Price: $${item.price.toFixed(2)} | Cost: $${item.cost.toFixed(2)} | Margin: ${item.margin.toFixed(1)}%\n` +
              `   Category: ${item.category} | Vendor: ${item.vendor}${item.variants ? ` | Variants: ${item.variants.length}` : ""}`
            ),
          ];

          if (result.items.length > 10) {
            lines.push(`\n... and ${result.items.length - 10} more items`);
          }

          return {
            content: [{ type: "text", text: lines.join("\n\n") }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error fetching products inventory: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Organization Members Tool
    server.tool(
      "org_members",
      "List organization members with their email, role, status, and onboarding details. Supports optional filtering by role or status",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        role: z
          .enum(["StoreOwner", "StoreTeam"])
          .optional()
          .describe("Filter to a specific membership role"),
        status: z
          .enum(["active", "suspended", "removed"])
          .optional()
          .describe("Filter to members with a specific status"),
        includeRemoved: z
          .boolean()
          .optional()
          .describe("Set to true to include removed members (default: false)"),
      },
      async ({ apiKey, role, status, includeRemoved }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.orgMembers, {
            apiKey: token,
            role,
            status,
            includeRemoved,
          });

          const lines = [
            result.summary,
            "",
            `Total Members: ${result.counts.total} | Active: ${result.counts.active} | Suspended: ${result.counts.suspended} | Removed: ${result.counts.removed}`,
            `Owners: ${result.counts.owners} | Team: ${result.counts.team}`,
          ];

          if (result.owner) {
            lines.push(
              "",
              "Primary Owner:",
              `  ${result.owner.name || "Unnamed"} (${result.owner.email || "No email"})`,
              `  Status: ${result.owner.status} | Joined: ${result.owner.joinedAt || "Unknown"}`
            );
          }

          if (result.members.length > 0) {
            lines.push(
              "",
              "Members:",
              ...result.members.map((member, index) =>
                `${index + 1}. ${member.name || "Unnamed"} (${member.email || "No email"})\n` +
                `   Role: ${member.role} | Status: ${member.status}${member.isOnboarded !== undefined ? ` | Onboarded: ${member.isOnboarded}` : ""}\n` +
                `   Joined: ${member.joinedAt || "Unknown"}`
              )
            );
          }

          return {
            content: [{ type: "text", text: lines.join("\n") }],
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error fetching organization members: ${formatError(error)}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Send Email Tool
    server.tool(
      "send_email",
      "Send an email via the Resend component. Confirm the exact recipient email with the user before invoking this tool. Supports dry-run previews",
      {
        apiKey: z
          .string()
          .describe("API key for authentication (optional when Authorization header is present)")
          .optional(),
        memberId: z
          .string()
          .optional()
          .describe("Optional organization member ID to resolve the recipient email"),
        toEmail: z
          .string()
          .email()
          .optional()
          .describe("Explicit recipient email (provide this when not referencing a memberId)"),
        subject: z
          .string()
          .min(3)
          .max(160)
          .describe("Email subject - keep it concise and professional"),
        html: z
          .string()
          .optional()
          .describe("HTML body of the email"),
        text: z
          .string()
          .optional()
          .describe("Plain-text body of the email"),
        replyTo: z
          .array(z.string().email())
          .max(4)
          .optional()
          .describe("Optional reply-to addresses"),
        from: z
          .string()
          .optional()
          .describe("Override the default from address (defaults to Meyoo no-reply)"),
        previewOnly: z
          .boolean()
          .optional()
          .describe("If true, return a preview without sending the email"),
      },
      async ({ apiKey, memberId, toEmail, subject, html, text, replyTo, from, previewOnly }, extra) => {
        try {
          const token = resolveApiToken(extra, apiKey);

          const result = await convexClient.action(api.agent.mcpActions.sendEmail, {
            apiKey: token,
            memberId,
            toEmail,
            subject,
            html,
            text,
            replyTo,
            from,
            previewOnly,
          });

          const lines = [result.summary];

          if (result.status === "error") {
            lines.push("", `Error: ${result.error || "Unknown error"}`);
          } else {
            if (result.to) {
              lines.push("", `To: ${result.to}`);
            }
            if (result.recipientName) {
              lines.push(`Recipient: ${result.recipientName}`);
            }
            if (result.subject) {
              lines.push(`Subject: ${result.subject}`);
            }
            if (result.emailId) {
              lines.push(`Email ID: ${result.emailId}`);
            }
            if (result.testMode !== undefined) {
              lines.push(`Test Mode: ${result.testMode}`);
            }
            if (result.preview && result.status === "preview") {
              lines.push("", "Preview:");
              if (result.preview.html) {
                lines.push("", "HTML Body:", result.preview.html);
              }
              if (result.preview.text) {
                lines.push("", "Text Body:", result.preview.text);
              }
            }
          }

          return {
            content: [{ type: "text", text: lines.join("\n") }],
            isError: result.status === "error",
          };
        } catch (error: unknown) {
          return {
            content: [{
              type: "text",
              text: `Error sending email: ${formatError(error)}`,
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
    redisUrl: REDIS_URL,
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
