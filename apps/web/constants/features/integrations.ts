export const INTEGRATIONS = {
  SHOPIFY: {
    id: "shopify",
    name: "Shopify",
    description:
      "Connect your Shopify store to sync orders, products, and customers",
    icon: "logos:shopify",
    color: "#7AB55C",
    category: "ecommerce",
    required: true,
    features: [
      "Real-time order sync",
      "Product inventory tracking",
      "Customer data sync",
      "Refund tracking",
    ],
  },
  META: {
    id: "meta",
    name: "Meta Ads",
    description: "Track your Facebook and Instagram advertising performance",
    icon: "grommet-icons:meta",
    color: "#0668E1",
    category: "marketing",
    required: false,
    features: [
      "Campaign performance",
      "Ad spend tracking",
      "ROAS calculation",
      "Audience insights",
    ],
  },
  GOOGLE: {
    id: "google",
    name: "Google Ads",
    description: "Monitor your Google Ads campaigns and performance metrics",
    icon: "logos:google-ads",
    color: "#4285F4",
    category: "marketing",
    required: false,
    comingSoon: true,
    releaseDate: "Coming soon",
    features: [
      "Campaign analytics",
      "Keyword performance tracking",
      "Conversion attribution",
      "Cost and budget optimization",
    ],
  },
};

export const INTEGRATION_CATEGORIES = {
  ecommerce: {
    name: "E-commerce",
    description: "Online store platforms",
    icon: "solar:shop-bold-duotone",
  },
  marketing: {
    name: "Marketing",
    description: "Advertising and marketing platforms",
    icon: "solar:speaker-bold-duotone",
  },
  analytics: {
    name: "Analytics",
    description: "Data and analytics tools",
    icon: "solar:chart-2-bold-duotone",
  },
  shipping: {
    name: "Shipping",
    description: "Shipping and logistics providers",
    icon: "solar:delivery-bold-duotone",
  },
};

export const SHOPIFY_WEBHOOK_TOPICS = [
  "app/uninstalled",
  // Billing
  "app_subscriptions/update",
  // The following billing topics are included for completeness; some may
  // not be registrable via GraphQL in all API versions but we handle them
  // if Shopify delivers them to our endpoint.
  "app_subscriptions/cancelled",
  "app_subscriptions/approaching_capped_amount",
  "app_subscription_billing_attempts/success",
  "app_subscription_billing_attempts/failure",
  "app_purchases/one_time",
  // Shop and collections
  "shop/update",
  "collections/create",
  "collections/update",
  "collections/delete",
  "orders/create",
  "orders/paid",
  "orders/cancelled",
  "orders/fulfilled",
  "orders/partially_fulfilled",
  "orders/edited",
  "orders/delete",
  "products/create",
  "products/update",
  "products/delete",
  "refunds/create",
  "customers/create",
  "customers/update",
  "customers/delete",
  "customers/enable",
  "customers/disable",
  "inventory_levels/update",
  "inventory_items/create",
  "inventory_items/update",
  "inventory_items/delete",
  "order_transactions/create",
  "fulfillments/create",
];

export const META_AD_OBJECTIVES = [
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_TRAFFIC",
  "OUTCOME_APP_PROMOTION",
];

export const SYNC_INTERVALS = {
  REALTIME: 0,
  EVERY_5_MIN: 5 * 60 * 1000,
  EVERY_15_MIN: 15 * 60 * 1000,
  EVERY_30_MIN: 30 * 60 * 1000,
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
};

export const SYNC_BATCH_SIZES = {
  SHOPIFY_ORDERS: 250,
  SHOPIFY_PRODUCTS: 250,
  SHOPIFY_CUSTOMERS: 250,
  META_INSIGHTS: 100,
};
