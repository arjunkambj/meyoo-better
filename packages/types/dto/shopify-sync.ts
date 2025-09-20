/**
 * Shopify sync DTOs
 */

import type { DateRangeDTO } from "./common";

/**
 * Shopify sync options
 */
export interface ShopifySyncOptions {
  /**
   * Type of sync to perform
   */
  syncType?:
    | "full"
    | "initial"
    | "products"
    | "orders"
    | "customers"
    | "inventory";

  /**
   * Date range for the sync (optional)
   */
  dateRange?: DateRangeDTO;

  /**
   * Specific entity types to sync
   */
  syncTypes?: {
    products?: boolean;
    orders?: boolean;
    customers?: boolean;
    inventory?: boolean;
  };

  /**
   * Batch size for sync operations
   */
  batchSize?: number;

  /**
   * Include archived/deleted items
   */
  includeArchived?: boolean;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Shopify sync request DTOs
 */
export interface ShopifySyncRequestDTO {
  storeId?: string;
  syncType: "full" | "incremental" | "products" | "orders";
}

export interface ShopifySyncResponseDTO {
  success: boolean;
  message: string;
  syncSessionId: string;
  timestamp: string;
}

/**
 * Shopify sync status DTOs
 */
export interface ShopifySyncStatusRequestDTO {
  sessionId: string;
}

export interface ShopifySyncStatusResponseDTO {
  sessionId: string;
  status: "pending" | "processing" | "syncing" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  recordsProcessed?: number;
  recordsFailed?: number;
  error?: string;
}

/**
 * Shopify store DTOs
 */
export interface ShopifyStoreDTO {
  id: string;
  shopDomain: string;
  storeName: string;
  storeEmail?: string;
  primaryCurrency: string;
  operatingCountry?: string;
  isGlobalStore?: boolean;
  supportedCurrencies?: string[];
  isActive: boolean;
  lastSyncAt?: string;
  updatedAt?: string;
}

/**
 * Shopify webhook DTOs
 */
export interface ShopifyWebhookRequestDTO {
  topic: string;
  domain: string;
  webhookId: string;
  apiVersion: string;
  createdAt: string;
}

export interface ShopifyWebhookVerificationDTO {
  isValid: boolean;
  shopDomain?: string;
  topic?: string;
  error?: string;
}
