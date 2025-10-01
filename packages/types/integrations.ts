import type { Id } from "@repo/convex/dataModel";

// Shopify types
export interface ShopifyStore {
  _id: Id<"shopifyStores">;
  organizationId: string;
  userId: Id<"users">;

  // Store info
  shopDomain: string;
  shopName: string;
  shopId: string;
  email: string;

  // API credentials
  accessToken: string;
  scope: string;

  // Session info
  sessionId?: string;
  sessionContent?: string;

  // Store settings
  primaryCurrency: string;
  enabledCurrencies: string[];
  timezone: string;

  // Status
  isActive: boolean;
  installedAt: string;
  lastSyncedAt?: string;

  // Metadata
  updatedAt?: string;
}

export interface ShopifyProduct {
  _id: Id<"shopifyProducts">;
  organizationId: string;
  storeId: Id<"shopifyStores">;

  // Product info
  shopifyId: string;
  title: string;
  handle: string;
  productType?: string;
  vendor?: string;
  tags: string[];

  // Status
  status: "active" | "archived" | "draft";
  publishedAt?: string;

  // Tracking
  totalInventory?: number;
  totalVariants: number;

  // SEO
  seoTitle?: string;
  seoDescription?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

export interface ShopifyOrder {
  _id: Id<"shopifyOrders">;
  organizationId: string;
  storeId: Id<"shopifyStores">;

  // Order info
  shopifyId: string;
  orderNumber: string;
  name: string;

  // Customer
  customerId?: Id<"shopifyCustomers">;
  email?: string;
  phone?: string;

  // Financial
  totalPrice: number;
  subtotalPrice: number;
  totalDiscounts: number;
  totalTax?: number;
  totalShipping?: number;
  totalRefunds?: number;
  currency: string;

  // Status
  financialStatus:
    | "pending"
    | "authorized"
    | "paid"
    | "partially_paid"
    | "refunded"
    | "voided";
  fulfillmentStatus?: "unfulfilled" | "partial" | "fulfilled" | "restocked";

  // Items
  itemCount: number;

  // Dates
  shopifyCreatedAt: string;
  processedAt: string;
  closedAt?: string;
  cancelledAt?: string;

  // Metadata
  tags: string[];
  note?: string;
  createdAt: string;
  updatedAt?: string;
  syncedAt: string;
}

export interface ShopifyCustomer {
  _id: Id<"shopifyCustomers">;
  organizationId: string;
  storeId: Id<"shopifyStores">;

  // Identifiers
  shopifyId: string;

  // Customer info
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;

  // Stats
  ordersCount: number;
  totalSpent: number;

  // Status
  state?: string;
  verifiedEmail?: boolean;

  // Location
  defaultAddress?: {
    country?: string;
    province?: string;
    city?: string;
  };

  // Metadata
  tags?: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

// Meta types
export interface MetaAdAccount {
  _id: Id<"metaAdAccounts">;
  organizationId: string;
  sessionId: Id<"integrationSessions">;

  // Account info
  accountId: string;
  accountName: string;
  businessId?: string;
  metaBusinessName?: string;

  // Settings
  currency: string;
  timezone: string;
  accountStatus: number;

  // Permissions
  permittedRoles: string[];

  // Spend limits
  spendCap?: number;
  amountSpent?: number;

  // Flags
  isPrimary: boolean;
  isActive: boolean;

  // Metadata
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// MetaCampaign interface removed - using account-level insights only

// Common integration types
export type IntegrationPlatform = "shopify" | "meta";
export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "syncing";

export interface IntegrationConfig {
  platform: IntegrationPlatform;
  status: IntegrationStatus;
  lastSyncedAt?: string;
  error?: string;
  settings?: Record<string, unknown>;
}

// Webhook types
export interface WebhookEvent {
  _id: string;
  organizationId: string;
  platform: IntegrationPlatform;
  topic: string;
  shopDomain?: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  status: "pending" | "processed" | "failed";
  attempts: number;
  error?: string;
  processedAt?: string;
  receivedAt: string;
}

// Sync types
export interface SyncConfig {
  platform: IntegrationPlatform;
  enabled: boolean;
  interval: number; // milliseconds
  batchSize: number;
  lastSyncedAt?: string;
  nextSyncAt?: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: "connected" | "available" | "coming_soon";
  configurable: boolean;
  color: string;
}

export interface IntegrationCategory {
  id: string;
  name: string;
  icon: string;
}
