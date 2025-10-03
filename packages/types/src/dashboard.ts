export type DashboardConfig = {
  kpis: string[];
  widgets: string[];
};

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  kpis: [
    "netProfit",
    "rtoRevenueLost",
    "revenue",
    "netProfitMargin",
    "orders",
    "avgOrderValue",
    "blendedRoas",
    "blendedMarketingCost",
    "repeatCustomerRate",
    "moMRevenueGrowth",
  ],
  widgets: [
    "adSpendSummary",
    "customerSummary",
    "orderSummary",
  ],
};
