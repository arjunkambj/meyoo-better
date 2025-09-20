export const DASHBOARD_SIDEBAR_ITEMS = [
  {
    label: "Analytics",
    items: [
      {
        key: "pnl",
        href: "/pnl",
        icon: "solar:chart-square-linear",
        activeIcon: "solar:chart-2-bold",
        label: "P&L Insights",
      },
      {
        key: "orders-insights",
        href: "/orders-insights",
        icon: "solar:graph-new-up-linear",
        activeIcon: "solar:graph-new-up-bold",
        label: "Order Insights",
      },
      {
        key: "customer-insights",
        href: "/customer-insights",
        icon: "solar:users-group-rounded-linear",
        activeIcon: "solar:users-group-rounded-bold",
        label: "Customer Insights",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        key: "orders",
        href: "/orders",
        icon: "solar:cart-check-linear",
        activeIcon: "solar:cart-check-bold",
        label: "Orders",
      },
      {
        key: "customers",
        href: "/customers",
        icon: "solar:users-group-rounded-linear",
        activeIcon: "solar:users-group-rounded-bold",
        label: "Customers",
      },
      {
        key: "inventory",
        href: "/inventory",
        icon: "solar:box-minimalistic-linear",
        activeIcon: "solar:box-minimalistic-bold",
        label: "Product & Inventory",
      },
    ],
  },
];

export const DASHBOARD_FOOTER_ITEMS = [
  {
    key: "cost-expenses",
    href: "/cost-management",
    icon: "solar:wallet-money-linear",
    activeIcon: "solar:wallet-money-bold",
    label: "Cost & Expenses",
  },
  {
    key: "integrations",
    href: "/integrations",
    icon: "solar:link-minimalistic-2-linear",
    activeIcon: "solar:link-minimalistic-2-bold",
    label: "Integrations",
  },
  {
    key: "settings",
    href: "/settings",
    icon: "solar:settings-linear",
    activeIcon: "solar:settings-bold",
    label: "Settings",
  },
];

// Legacy exports for backward compatibility
// Backward-compat exports removed; use DASHBOARD_SIDEBAR_ITEMS and DASHBOARD_FOOTER_ITEMS directly.
