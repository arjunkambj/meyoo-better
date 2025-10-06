export type DashboardConfig = {
  kpis: string[];
  widgets: string[];
};

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  kpis: [
    "revenue",
    "netProfit",
    "orders",
    "blendedMarketingCost",
    "blendedRoas",
    "netProfitMargin",
    "marketingPercentageOfNet",
    "rtoRevenueLost",
    "operatingMargin",
    "avgOrderValue",
  ],
  widgets: [
    "costBreakdown",
  ],
};
