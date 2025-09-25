import { LATEST_API_VERSION } from "@shopify/shopify-api";
import { optionalEnv } from "@/libs/env";

const NEXT_PUBLIC_META_API_VERSION = optionalEnv("NEXT_PUBLIC_META_API_VERSION") ?? "v23.0";

export const INTEGRATIONS = {
  shopify: {
    enabled: true,
    apiVersion: LATEST_API_VERSION,
    webhooks: [
      "ORDERS_CREATE",
      "ORDERS_UPDATED",
      "ORDERS_CANCELLED",
      "ORDERS_FULFILLED",
      "PRODUCTS_CREATE",
      "PRODUCTS_UPDATE",
      "PRODUCTS_DELETE",
      "CUSTOMERS_CREATE",
      "CUSTOMERS_UPDATE",
      "INVENTORY_LEVELS_UPDATE",
      "FULFILLMENTS_CREATE",
      "FULFILLMENTS_UPDATE",
    ],
    syncInterval: 60 * 60 * 1000, // 1 hour
    batchSize: 250,
    rateLimit: {
      restApi: {
        requests: 40,
        window: 1000, // 40 requests per second
      },
      graphql: {
        cost: 1000,
        window: 1000, // 1000 cost points per second
      },
    },
    dataSyncRange: {
      initial: 60, // 60 days for initial sync
      incremental: 7, // 7 days for incremental syncs
    },
  },

  meta: {
    enabled: true,
    apiVersion: NEXT_PUBLIC_META_API_VERSION, // Graph API
    insightFields: [
      "account_id",
      "account_name",
      "campaign_id",
      "campaign_name",
      "spend",
      "impressions",
      "clicks",
      "conversions",
      "conversion_values",
      "cpm",
      "cpc",
      "ctr",
      "frequency",
      "reach",
      "actions",
      "action_values",
    ],
    datePresets: {
      last_7_days: "last_7d",
      last_30_days: "last_30d",
      last_90_days: "last_90d",
      this_month: "this_month",
      last_month: "last_month",
    },
    syncInterval: 4 * 60 * 60 * 1000, // 4 hours
    batchSize: 50,
    rateLimit: {
      requests: 200,
      window: 3600000, // 200 requests per hour
    },
    dataSyncRange: {
      initial: 60, // 60 days for initial sync
      incremental: 7, // 7 days for incremental syncs
    },
  },

  // Future integrations template
  tiktok: {
    enabled: false,
    apiVersion: "v1.3",
    syncInterval: 4 * 60 * 60 * 1000,
    batchSize: 50,
    rateLimit: {
      requests: 100,
      window: 60000,
    },
  },

  klaviyo: {
    enabled: false,
    apiVersion: "2024-10-15",
    syncInterval: 6 * 60 * 60 * 1000,
    batchSize: 100,
    rateLimit: {
      requests: 100,
      window: 60000,
    },
  },

  pinterest: {
    enabled: false,
    apiVersion: "v5",
    syncInterval: 4 * 60 * 60 * 1000,
    batchSize: 50,
    rateLimit: {
      requests: 100,
      window: 60000,
    },
  },
};

// Helper functions
export const getEnabledIntegrations = () => {
  return Object.entries(INTEGRATIONS)
    .filter(([_, config]) => config.enabled)
    .map(([name, config]) => ({
      name,
      ...config,
    }));
};

export const getIntegrationConfig = (name: keyof typeof INTEGRATIONS) => {
  return INTEGRATIONS[name];
};

export const isIntegrationEnabled = (
  name: keyof typeof INTEGRATIONS,
): boolean => {
  return INTEGRATIONS[name]?.enabled || false;
};

// Rate limit helper
export const getRateLimit = (integration: keyof typeof INTEGRATIONS) => {
  const config = INTEGRATIONS[integration];

  if (!config || !config.rateLimit) {
    return null;
  }

  return config.rateLimit;
};

// Sync interval helper
export const getSyncInterval = (
  integration: keyof typeof INTEGRATIONS,
): number => {
  const config = INTEGRATIONS[integration];

  return config?.syncInterval || 4 * 60 * 60 * 1000; // Default 4 hours
};

// Batch size helper
export const getBatchSize = (
  integration: keyof typeof INTEGRATIONS,
): number => {
  const config = INTEGRATIONS[integration];

  return config?.batchSize || 50; // Default 50
};

// Export types
export type IntegrationName = keyof typeof INTEGRATIONS;
export type IntegrationConfig = (typeof INTEGRATIONS)[IntegrationName];
