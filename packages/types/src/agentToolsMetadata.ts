export type AgentToolMetadata = {
  name: AgentToolName;
  description: string;
  usage?: string;
  inputs?: string;
  returns?: string;
};

type AgentToolName =
  | "ordersSummary"
  | "inventoryLowStock"
  | "analyticsSummary"
  | "metaAdsOverview"
  | "currentDate"
  | "brandSummary"
  | "pnlSnapshot"
  | "productsInventory"
  | "orgMembers"
  | "sendEmail";

export const agentToolsMetadata: AgentToolMetadata[] = [
  {
    name: "ordersSummary",
    description:
      "Summarize order volumes, revenue, and fulfillment performance over a date range.",
    inputs:
      "startDate?: string (YYYY-MM-DD), endDate?: string (YYYY-MM-DD)",
  },
  {
    name: "inventoryLowStock",
    description:
      "Surface low or critical stock alerts so replenishment can be prioritised.",
    inputs: "limit?: number (default 10, max 50)",
  },
  {
    name: "analyticsSummary",
    description:
      "Summarize store performance metrics over a date range (daily/weekly/monthly).",
    inputs:
      "startDate: string (YYYY-MM-DD), endDate: string (YYYY-MM-DD), granularity?: 'daily' | 'weekly' | 'monthly', metrics?: string[]",
  },
  {
    name: "metaAdsOverview",
    description:
      "Retrieve Meta ads performance metrics (impressions, clicks, conversions, CPC, etc.) for a date window.",
    inputs: "startDate?: string, endDate?: string",
  },
  {
    name: "currentDate",
    description:
      "Returns the current date/time in ISO 8601 formats (UTC). Use when referencing today's date explicitly or for generating date parameters for other tools.",
    usage:
      "Common pattern: Call currentDate first, then use the returned isoDate for pnlSnapshot, ordersSummary, or analyticsSummary queries.",
    returns:
      "{ isoDate: string (YYYY-MM-DD), isoDateTime: string (ISO 8601), utc: string }",
  },
  {
    name: "brandSummary",
    description:
      "Retrieve the latest stored overview of the merchant brand, including storefront highlights and recent sales stats.",
    usage:
      "Use before making product or strategy recommendations to understand the merchant's brand positioning, target audience, and key product categories.",
    returns:
      "{ summary: string, generatedAt?: string, source?: string }",
  },
  {
    name: "pnlSnapshot",
    description:
      "Generate a profit & loss snapshot covering revenue, profit margins, operating spend, and marketing ROI. Works for single-day (today's profit) or multi-day periods.",
    inputs:
      "startDate?: string (YYYY-MM-DD), endDate?: string (YYYY-MM-DD)",
    usage:
      "For today's profit: set startDate=endDate=today. For period analysis: use date ranges (e.g., last 30 days). Returns period-over-period changes automatically.",
    returns:
      "{ revenue, grossProfit, netProfit, grossMargin, netMargin, operatingExpenses, adSpend, marketingROI, ebitda, changes: {...} }",
  },
  {
    name: "productsInventory",
    description:
      "List all products with inventory details, variants, stock status, pricing, and ABC categorization. Supports pagination, filtering, and search.",
    inputs:
      "page?: number, pageSize?: number (max 200), stockLevel?: 'all' | 'healthy' | 'low' | 'critical' | 'out', search?: string, sortBy?: string, sortOrder?: 'asc' | 'desc'",
    usage:
      "Combine with inventoryLowStock to get detailed information about specific low-stock items. Use search to find products by name or SKU.",
    returns:
      "{ items: [{ id, name, sku, stock, available, reserved, price, cost, margin, variants, ... }], pagination: {...} }",
  },
  {
    name: "orgMembers",
    description:
      "List organization members with roles, status, onboarding state, and email addresses. Supports filtering by role and status.",
    inputs:
      "role?: 'StoreOwner' | 'StoreTeam', status?: 'active' | 'suspended' | 'removed', includeRemoved?: boolean",
    usage:
      "Use before sending team emails with sendEmail tool to verify recipients. Filter by status='active' to get only current team members.",
    returns:
      "{ members: [{ id, name, email, role, status, isOwner, isOnboarded, joinedAt, ... }], counts: {...}, owner: {...} }",
  },
  {
    name: "sendEmail",
    description:
      "Send emails via Resend to team members or external addresses. Supports preview mode for confirmation before sending.",
    inputs:
      "memberId?: string, toEmail?: string, subject: string (required), html?: string, text?: string, replyTo?: string[], from?: string, previewOnly?: boolean",
    usage:
      "ALWAYS confirm recipient email with user before sending. Use previewOnly=true to show email content for approval first. Provide either memberId (to lookup team member) or toEmail (direct address).",
    returns:
      "{ status: 'queued' | 'preview' | 'error', emailId?: string, to: string, summary: string, preview?: {...} }",
  },
];

export const agentToolsMetadataMap: Record<AgentToolName, AgentToolMetadata> =
  agentToolsMetadata.reduce((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  }, {} as Record<AgentToolName, AgentToolMetadata>);

export type { AgentToolName };
