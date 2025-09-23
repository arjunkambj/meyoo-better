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
  | "pnlSnapshot";

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
      "Returns the current date/time in ISO 8601 formats (UTC). Use when referencing today's date explicitly.",
  },
  {
    name: "brandSummary",
    description:
      "Retrieve the latest stored overview of the merchant brand, including storefront highlights and recent sales stats.",
  },
  {
    name: "pnlSnapshot",
    description:
      "Generate a profit & loss snapshot covering revenue, profit margins, operating spend, and marketing ROI.",
    inputs:
      "startDate?: string (YYYY-MM-DD), endDate?: string (YYYY-MM-DD)",
  },
];

export const agentToolsMetadataMap: Record<AgentToolName, AgentToolMetadata> =
  agentToolsMetadata.reduce((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  }, {} as Record<AgentToolName, AgentToolMetadata>);

export type { AgentToolName };
