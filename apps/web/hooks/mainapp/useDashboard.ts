import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

export interface DashboardConfig {
  kpis: string[]; // KPI metric IDs
  widgets: string[]; // Widget IDs
}

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  kpis: [
    // Default KPIs - ordered for new users
    "netProfit",
    "revenue",
    "netProfitMargin",
    "orders",
    "avgOrderValue",
    "blendedRoas", // ROAS
    "totalAdSpend",
    "repeatCustomerRate",
    "moMRevenueGrowth",
  ],
  widgets: [
    // Essential widgets for new users
    "adSpendSummary",
    "customerSummary",
    "orderSummary",
  ],
};

export function useDashboard() {
  // Query to get dashboard layout
  const dashboardLayout = useQuery(api.core.dashboard.getDashboardLayout);

  // Mutation to update dashboard layout
  const updateLayout = useMutation(api.core.dashboard.updateDashboardLayout);

  // Use saved layout or default
  const config = dashboardLayout || DEFAULT_DASHBOARD_CONFIG;

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
