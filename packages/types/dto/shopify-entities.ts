/**
 * Shopify entity DTOs
 */

/**
 * Shopify Product DTOs
 */
export interface ShopifyProductDTO {
  id: string;
  title: string;
  handle: string;
  productType?: string;
  vendor?: string;
  tags?: string;
  status: "active" | "archived" | "draft";
  featuredImage?: {
    url: string;
    altText?: string;
  };
  totalInventory?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  variants: ShopifyVariantDTO[];
}

export interface ShopifyVariantDTO {
  id: string;
  productId: string;
  title: string;
  sku?: string;
  barcode?: string;
  position: number;
  price: string;
  compareAtPrice?: string;
  weight?: number;
  weightUnit?: string;
  inventoryItemId?: string;
  inventoryQuantity?: number;
  available: boolean;
  taxable: boolean;
  taxCode?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  unitCost?: number;
  costCurrency?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shopify Order DTOs
 */
export interface ShopifyOrderDTO {
  id: string;
  name: string;
  orderNumber: number;
  email?: string;
  phone?: string;
  financialStatus: string;
  fulfillmentStatus: string;
  currency: string;
  totalPrice: string;
  subtotalPrice: string;
  totalTax: string;
  totalShipping: string;
  totalDiscounts: string;
  customer?: ShopifyOrderCustomerDTO;
  shippingAddress?: ShopifyAddressDTO;
  billingAddress?: ShopifyAddressDTO;
  lineItems: ShopifyLineItemDTO[];
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
}

export interface ShopifyOrderCustomerDTO {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ShopifyLineItemDTO {
  id: string;
  title: string;
  quantity: number;
  sku?: string;
  variantId?: string;
  productId?: string;
  price: string;
  totalDiscount?: string;
}

/**
 * Shopify Customer DTOs
 */
export interface ShopifyCustomerDTO {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  marketingOptInLevel?: string;
  state: "disabled" | "invited" | "enabled" | "declined";
  taxExempt: boolean;
  taxExemptions?: string[];
  verifiedEmail: boolean;
  totalSpent: string;
  ordersCount: number;
  defaultAddress?: ShopifyAddressDTO;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shopify Address DTO
 */
export interface ShopifyAddressDTO {
  id?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  provinceCode?: string;
  country?: string;
  countryCode?: string;
  zip?: string;
  phone?: string;
}

/**
 * Shopify Inventory DTOs
 */
export interface ShopifyInventoryLevelDTO {
  inventoryItemId: string;
  locationId: string;
  available: number;
  updatedAt: string;
}

export interface ShopifyInventoryItemDTO {
  id: string;
  sku?: string;
  tracked: boolean;
  requiresShipping: boolean;
  cost?: string;
  countryCodeOfOrigin?: string;
  provinceCodeOfOrigin?: string;
  harmonizedSystemCode?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shopify Location DTO
 */
export interface ShopifyLocationDTO {
  id: string;
  name: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
  active: boolean;
  isActive: boolean;
  isFulfillmentService: boolean;
}

// Note: Type aliases removed to avoid conflicts with main domain types in integrations.ts
// Use the DTO interfaces directly: ShopifyProductDTO, ShopifyOrderDTO, ShopifyCustomerDTO, etc.
