/**
 * Widget Registry for Zone 2
 * Clean separation of widgets from KPI metrics
 */

export interface Widget {
  id: string;
  name: string;
  description: string;
  icon: string;
  component: string;
}

export const WIDGETS: Record<string, Widget> = {
  adSpendSummary: {
    id: "adSpendSummary",
    name: "Ad Spend Summary",
    description: "ROAS, POAS, ncROAS and ad spend metrics",
    icon: "solar:ad-bold-duotone",
    component: "AdSpendSummaryWidget",
  },
  costBreakdown: {
    id: "costBreakdown",
    name: "Cost Breakdown",
    description: "Detailed breakdown of all costs",
    icon: "solar:wallet-bold-duotone",
    component: "CostBreakdownWidget",
  },
  customerSummary: {
    id: "customerSummary",
    name: "Customer Summary",
    description: "Customer metrics, CAC and repurchase rate",
    icon: "solar:users-group-rounded-bold-duotone",
    component: "CustomerSummaryWidget",
  },
  orderSummary: {
    id: "orderSummary",
    name: "Order Summary",
    description: "Order value, profit and frequency metrics",
    icon: "solar:cart-large-2-bold-duotone",
    component: "OrderSummaryWidget",
  },
};

// Helper function to get widget by ID
export function getWidgetById(id: string): Widget | undefined {
  return WIDGETS[id];
}

// Get all widget IDs
export function getAllWidgetIds(): string[] {
  return Object.keys(WIDGETS);
}

// Get all widgets as array
export function getAllWidgets(): Widget[] {
  return Object.values(WIDGETS);
}
