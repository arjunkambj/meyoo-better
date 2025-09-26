/**
 * Shopify integration configuration
 */

import { optionalEnv } from "../env";

const SHOPIFY_API_VERSION = optionalEnv("SHOPIFY_API_VERSION") ?? "2025-07";

export const SHOPIFY_CONFIG = {
  // API Configuration
  API: {
    VERSION: SHOPIFY_API_VERSION,
    RATE_LIMIT: {
      REST: 2, // requests per second
      GRAPHQL: {
        COST_LIMIT: 1000,
        RESTORE_RATE: 50, // points per second
      },
    },
  },

  // GraphQL Queries
  QUERIES: {
    PRODUCTS_BATCH_SIZE: 50,
    ORDERS_BATCH_SIZE: 100, // Safe limit tested to avoid rate limits
    CUSTOMERS_BATCH_SIZE: 100,
    INVENTORY_BATCH_SIZE: 25,
  },

  // Sync batching controls
  SYNC: {
    ORDERS_PERSIST_BATCH_SIZE: 25, // Orders persisted per workpool batch job
  },

  // Webhook Topics
  WEBHOOKS: {
    // Product events
    PRODUCT_CREATE: "products/create",
    PRODUCT_UPDATE: "products/update",
    PRODUCT_DELETE: "products/delete",

    // Order events
    ORDER_CREATE: "orders/create",
    ORDER_UPDATE: "orders/updated",
    ORDER_CANCELLED: "orders/cancelled",
    ORDER_FULFILLED: "orders/fulfilled",
    ORDER_PAID: "orders/paid",
    ORDER_PARTIALLY_FULFILLED: "orders/partially_fulfilled",

    // Customer events
    CUSTOMER_CREATE: "customers/create",
    CUSTOMER_UPDATE: "customers/update",
    CUSTOMER_DELETE: "customers/delete",
    CUSTOMER_ENABLE: "customers/enable",
    CUSTOMER_DISABLE: "customers/disable",

    // Inventory events
    INVENTORY_LEVELS_UPDATE: "inventory_levels/update",
    INVENTORY_ITEMS_CREATE: "inventory_items/create",
    INVENTORY_ITEMS_UPDATE: "inventory_items/update",
    INVENTORY_ITEMS_DELETE: "inventory_items/delete",

    // Fulfillment events
    FULFILLMENT_CREATE: "fulfillments/create",
    FULFILLMENT_UPDATE: "fulfillments/update",

    // App events
    APP_UNINSTALLED: "app/uninstalled",
    // Billing events
    APP_SUBSCRIPTIONS_UPDATE: "app_subscriptions/update",
    SHOP_UPDATE: "shop/update",

    // Collection events
    COLLECTION_CREATE: "collections/create",
    COLLECTION_UPDATE: "collections/update",
    COLLECTION_DELETE: "collections/delete",
  },

  // Sync Types
  SYNC_TYPES: {
    FULL: {
      name: "full",
      description: "Complete sync of all store data",
      includes: ["products", "orders", "customers", "inventory"],
    },
    INITIAL: {
      name: "initial",
      description: "Initial sync for new store connection",
      includes: ["products", "orders", "customers", "inventory"],
    },
    PRODUCTS: {
      name: "products",
      description: "Sync products and variants only",
      includes: ["products"],
    },
    ORDERS: {
      name: "orders",
      description: "Sync orders only",
      includes: ["orders"],
    },
    CUSTOMERS: {
      name: "customers",
      description: "Sync customers only",
      includes: ["customers"],
    },
    INVENTORY: {
      name: "inventory",
      description: "Sync inventory levels only",
      includes: ["inventory"],
    },
    HISTORICAL: {
      name: "historical",
      description: "Sync historical data for specific date range",
      includes: ["orders"],
    },
  },

  // Field Mappings
  FIELD_MAPPINGS: {
    PRODUCT: {
      id: "shopifyId",
      title: "title",
      handle: "handle",
      product_type: "productType",
      vendor: "vendor",
      tags: "tags",
      status: "status",
      created_at: "createdAt",
      updated_at: "updatedAt",
      published_at: "publishedAt",
    },
    ORDER: {
      id: "shopifyId",
      name: "orderName",
      order_number: "orderNumber",
      email: "email",
      phone: "phone",
      financial_status: "financialStatus",
      fulfillment_status: "fulfillmentStatus",
      created_at: "createdAt",
      updated_at: "updatedAt",
    },
    CUSTOMER: {
      id: "shopifyId",
      email: "email",
      first_name: "firstName",
      last_name: "lastName",
      phone: "phone",
      accepts_marketing: "acceptsMarketing",
      created_at: "createdAt",
      updated_at: "updatedAt",
    },
  },

  // Default Settings
  DEFAULTS: {
    SYNC_BATCH_SIZE: 250,
    WEBHOOK_TIMEOUT: 5000, // 5 seconds
    WEBHOOK_MAX_RETRIES: 3,
    INVENTORY_LOCATION_LIMIT: 10,
    INITIAL_SYNC_DAYS: 60, // Sync 60 days of data for initial sync (matching Google/Meta)
    ORDER_BATCH_PROCESS_SIZE: 10, // Process orders in batches of 10
  },

  // Error Messages
  ERRORS: {
    INVALID_WEBHOOK: "Invalid webhook signature",
    STORE_NOT_FOUND: "Store not found",
    INVALID_ACCESS_TOKEN: "Invalid access token",
    RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
    SYNC_IN_PROGRESS: "Sync already in progress",
  },
} as const;

/**
 * Get all webhook topics as an array
 */
export function getAllWebhookTopics(): string[] {
  return Object.values(SHOPIFY_CONFIG.WEBHOOKS);
}

/**
 * Get critical webhook topics (minimum required)
 */
export function getCriticalWebhookTopics(): string[] {
  return [
    SHOPIFY_CONFIG.WEBHOOKS.APP_UNINSTALLED,
    SHOPIFY_CONFIG.WEBHOOKS.PRODUCT_CREATE,
    SHOPIFY_CONFIG.WEBHOOKS.PRODUCT_UPDATE,
    SHOPIFY_CONFIG.WEBHOOKS.PRODUCT_DELETE,
    SHOPIFY_CONFIG.WEBHOOKS.ORDER_CREATE,
    SHOPIFY_CONFIG.WEBHOOKS.ORDER_UPDATE,
    SHOPIFY_CONFIG.WEBHOOKS.INVENTORY_LEVELS_UPDATE,
  ];
}

/**
 * Check if a webhook topic is valid
 */
export function isValidWebhookTopic(topic: string): boolean {
  return getAllWebhookTopics().includes(topic);
}
