/**
 * Shopify webhook DTOs
 */

/**
 * Base webhook payload
 */
export interface ShopifyWebhookPayload {
  id: number | string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Product webhook payloads
 */
export interface ShopifyProductWebhookPayload extends ShopifyWebhookPayload {
  title: string;
  handle: string;
  product_type?: string;
  vendor?: string;
  tags?: string;
  status: string;
  variants?: Array<{
    id: number | string;
    product_id: number | string;
    title: string;
    sku?: string;
    price: string;
    inventory_quantity?: number;
  }>;
}

/**
 * Order webhook payloads
 */
export interface ShopifyOrderWebhookPayload extends ShopifyWebhookPayload {
  name: string;
  order_number: number;
  email?: string;
  financial_status: string;
  fulfillment_status?: string;
  total_price: string;
  currency: string;
  line_items?: Array<{
    id: number | string;
    title: string;
    quantity: number;
    price: string;
    variant_id?: number | string;
    product_id?: number | string;
  }>;
}

/**
 * Customer webhook payloads
 */
export interface ShopifyCustomerWebhookPayload extends ShopifyWebhookPayload {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  accepts_marketing: boolean;
  state: string;
  total_spent: string;
  orders_count: number;
}

/**
 * Inventory webhook payloads
 */
export interface ShopifyInventoryWebhookPayload {
  inventory_item_id: number | string;
  location_id: number | string;
  available: number;
  updated_at: string;
}

/**
 * App uninstalled webhook payload
 */
export interface ShopifyAppUninstalledPayload {
  id: number | string;
  name: string;
  email: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

/**
 * One-time app purchase payload
 */
export interface ShopifyAppPurchaseOneTimePayload extends ShopifyWebhookPayload {
  name?: string;
  test?: boolean;
  status?: string;
  amount?:
    | string
    | {
        amount?: string;
        currency?: string;
        currency_code?: string;
      };
  price?:
    | string
    | {
        amount?: string;
        currency?: string;
        currency_code?: string;
      };
  currency?: string;
  currency_code?: string;
  admin_graphql_api_id?: string;
}

/**
 * Webhook headers
 */
export interface ShopifyWebhookHeaders {
  "x-shopify-topic": string;
  "x-shopify-hmac-sha256": string;
  "x-shopify-shop-domain": string;
  "x-shopify-api-version": string;
  "x-shopify-webhook-id"?: string;
}

/**
 * Webhook registration request
 */
export interface ShopifyWebhookRegistrationDTO {
  topic: string;
  address: string;
  format?: "json" | "xml";
  fields?: string[];
  metafield_namespaces?: string[];
}

/**
 * Webhook registration response
 */
export interface ShopifyWebhookResponseDTO {
  id: number | string;
  address: string;
  topic: string;
  created_at: string;
  updated_at: string;
  format: string;
  fields: string[];
  metafield_namespaces: string[];
  api_version: string;
}

/**
 * Webhook verification result
 */
export interface ShopifyWebhookVerificationResult {
  isValid: boolean;
  shopDomain?: string;
  topic?: string;
  error?: string;
}
