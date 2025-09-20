export const ADMIN_SIDEBAR_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "solar:widget-5-linear",
    activeIcon: "solar:widget-5-bold",
    href: "/dashboard",
  },
  {
    key: "users",
    label: "Users",
    icon: "solar:users-group-two-rounded-linear",
    activeIcon: "solar:users-group-two-rounded-bold",
    href: "/dashboard/users",
  },
  {
    key: "organizations",
    label: "Organizations",
    icon: "solar:buildings-2-linear",
    activeIcon: "solar:buildings-2-bold",
    href: "/dashboard/organizations",
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    icon: "solar:wallet-linear",
    activeIcon: "solar:wallet-bold",
    href: "/dashboard/subscriptions",
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: "solar:ticket-linear",
    activeIcon: "solar:ticket-bold",
    href: "/dashboard/tickets",
    badge: null,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: "solar:bell-linear",
    activeIcon: "solar:bell-bold",
    href: "/dashboard/notifications",
  },
];

export const ADMIN_FOOTER_ITEMS = [
  {
    key: "settings",
    label: "Settings",
    icon: "solar:settings-linear",
    activeIcon: "solar:settings-bold",
    href: "/dashboard/settings",
  },
];
