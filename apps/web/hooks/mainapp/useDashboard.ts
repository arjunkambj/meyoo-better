import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

export interface DashboardConfig {
  zone1: string[]; // KPI metric IDs
  zone2: string[]; // Widget IDs
}

export function useDashboard() {
  // Query to get dashboard layout
  const dashboardLayout = useQuery(api.core.dashboard.getDashboardLayout);

  // Mutation to update dashboard layout
  const updateLayout = useMutation(api.core.dashboard.updateDashboardLayout);

  // Default config if no saved layout
  const defaultConfig: DashboardConfig = {
    zone1: [
      // Top KPIs (10 pinned metrics) — ordered for new users
      // 1) Revenue, 2) Total Ad Spend, 3) COGS, 4) Orders,
      // 5) Net Profit, 6) Taxes Collected, 7) Profit Margin,
      // 8) ROAS, 9) Repeat Rate, 10) AOV
      "revenue",
      "totalAdSpend",
      "cogs",
      "orders",
      "netProfit",
      "taxesCollected",
      "netProfitMargin",
      "blendedRoas",
      "repeatCustomerRate",
      "avgOrderValue",
    ],
    zone2: [
      // Essential widgets for new users (exclude Cost Breakdown by default)
      "adSpendSummary",
      "customerSummary",
      "orderSummary",
    ],
  };

  // Use saved layout or default
  const config = dashboardLayout || defaultConfig;

  // Save config function
  const saveConfig = async (newConfig: DashboardConfig) => {
    try {
      await updateLayout(newConfig);

      return true;
    } catch (error) {
      console.error("Failed to save dashboard layout:", error);

      return false;
    }
  };

  return {
    config,
    saveConfig,
    isLoading: dashboardLayout === undefined,
  };
}
