export const DASHBOARD_SIDEBAR_ITEMS = [
  {
    label: "Analytics",
    items: [
      {
        key: "pnl",
        href: "/pnl",
        icon: "solar:wallet-money-bold-duotone",
        activeIcon: "solar:wallet-money-bold",
        label: "P&L Insights",
      },
      {
        key: "orders-insights",
        href: "/orders-insights",
        icon: "solar:graph-new-up-bold-duotone",
        activeIcon: "solar:graph-new-up-bold",
        label: "Order Insights",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        key: "orders",
        href: "/orders",
        icon: "solar:bag-check-bold-duotone",
        activeIcon: "solar:bag-check-bold",
        label: "Orders",
      },
      {
        key: "inventory",
        href: "/inventory",
        icon: "solar:box-bold-duotone",
        activeIcon: "solar:box-bold",
        label: "Product & Inventory",
      },
    ],
  },
];

export const DASHBOARD_FOOTER_ITEMS = [
  {
    key: "cost-expenses",
    href: "/cost-management",
    icon: "solar:bill-list-bold-duotone",
    activeIcon: "solar:bill-list-bold",
    label: "Cost & Expenses",
  },
  {
    key: "integrations",
    href: "/integrations",
    icon: "solar:widget-4-bold-duotone",
    activeIcon: "solar:widget-4-bold",
    label: "Integrations",
  },
  {
    key: "settings",
    href: "/settings",
    icon: "solar:settings-bold-duotone",
    activeIcon: "solar:settings-bold",
    label: "Settings",
  },
];

// Legacy exports for backward compatibility
// Backward-compat exports removed; use DASHBOARD_SIDEBAR_ITEMS and DASHBOARD_FOOTER_ITEMS directly.
