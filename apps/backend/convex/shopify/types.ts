export type ShopifyStoreLike = {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
};

export type ShopifyMoney = { amount?: string; currencyCode?: string };

export type ShopifyProductVariant = {
  id: string;
  title?: string;
  sku?: string;
  barcode?: string;
  price?: string | number;
  compareAtPrice?: string | number;
  position?: number;
  inventoryQuantity?: number;
  availableForSale?: boolean;
  taxable?: boolean;
  taxCode?: string;
  inventoryItem?: {
    id?: string;
    unitCost?: { amount?: string };
    measurement?: { weight?: { value?: number; unit?: string } };
  };
  selectedOptions?: Array<{ name?: string; value?: string }>;
  createdAt: string;
  updatedAt: string;
};

export type ShopifyProductNode = {
  id: string;
  handle?: string;
  title?: string;
  productType?: string;
  vendor?: string;
  status?: string;
  featuredImage?: { url?: string };
  totalInventory?: number | string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  variants?: { edges?: Array<{ node: ShopifyProductVariant }> };
};

export type ShopifyLineItem = {
  id: string;
  title?: string;
  name?: string;
  quantity?: number;
  sku?: string;
  variant?: { id?: string; sku?: string; product?: { id?: string } };
  originalUnitPriceSet?: { shopMoney?: ShopifyMoney };
  discountedUnitPriceSet?: { shopMoney?: ShopifyMoney };
  totalDiscountSet?: { shopMoney?: ShopifyMoney };
  fulfillableQuantity?: number;
  fulfillmentStatus?: string;
};

export type ShopifyTransaction = {
  id: string;
  kind?: string;
  status?: string;
  gateway?: string;
  amountSet?: { shopMoney?: ShopifyMoney };
  fees?: Array<{ amount?: { amount?: string } }>;
  paymentId?: string;
  createdAt: string;
  processedAt?: string;
};

export type ShopifyRefund = {
  id: string;
  note?: string;
  user?: { id?: string };
  totalRefundedSet?: { shopMoney?: ShopifyMoney };
  refundLineItems?: {
    edges?: Array<{
      node: {
        lineItem?: { id?: string };
        quantity?: number;
        subtotalSet?: { shopMoney?: ShopifyMoney };
      };
    }>;
  };
  createdAt?: string;
  processedAt?: string;
};

export type ShopifyFulfillment = {
  id: string;
  status: string;
  shipmentStatus?: string;
  trackingInfo?: Array<{ company?: string; number?: string; url?: string }>;
  location?: { id?: string | null } | null;
  service?: { serviceName?: string | null } | string | null;
  fulfillmentLineItems?: {
    edges?: Array<{
      node: {
        id?: string;
        quantity?: number;
        lineItem?: { id?: string | null } | null;
      };
    }>;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type ShopifyFulfillmentOrder = {
  id: string;
  status?: string;
  assignedLocation?: {
    location?: { id?: string | null } | null;
  } | null;
  deliveryMethod?: { methodType?: string | null; serviceName?: string | null } | null;
  lineItems?: {
    edges?: Array<{
      node?: {
        id?: string | null;
        lineItem?: { id?: string | null } | null;
      } | null;
    }>;
  };
};

export type ShopifyOrderNode = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  processedAt?: string;
  updatedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  currentTotalPriceSet?: { shopMoney?: ShopifyMoney };
  currentSubtotalPriceSet?: { shopMoney?: ShopifyMoney };
  currentTotalTaxSet?: { shopMoney?: ShopifyMoney };
  currentTotalDiscountsSet?: { shopMoney?: ShopifyMoney };
  totalShippingPriceSet?: { shopMoney?: ShopifyMoney };
  totalTipReceivedSet?: { shopMoney?: ShopifyMoney };
  subtotalLineItemsQuantity?: number | string;
  totalWeight?: string | number;
  tags?: string[];
  note?: string;
  risks?: Array<{ level?: string }>;
  shippingAddress?: {
    country?: string;
    provinceCode?: string;
    city?: string;
    zip?: string;
  };
  customer?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  lineItems?: { edges?: Array<{ node: ShopifyLineItem }> };
  transactions?: Array<ShopifyTransaction>;
  refunds?: Array<ShopifyRefund>;
  fulfillments?: Array<ShopifyFulfillment>;
  fulfillmentOrders?: { edges?: Array<{ node: ShopifyFulfillmentOrder }> };
  customerJourneySummary?: {
    firstVisit?: {
      source?: string;
      landingPage?: string;
      referrerUrl?: string;
      utmParameters?: {
        source?: string;
        medium?: string;
        campaign?: string;
        content?: string;
        term?: string;
      };
      id?: string;
      occurredAt?: string;
      device?: { type?: string };
    };
    momentsCount?: number;
  };
};

export type ShopifyOrderLineItemInput = {
  shopifyId: string;
  title: string;
  name?: string;
  quantity: number;
  sku?: string;
  shopifyVariantId?: string;
  shopifyProductId?: string;
  price: number;
  totalDiscount: number;
  discountedPrice?: number;
  fulfillableQuantity: number;
  fulfillmentStatus?: string;
};

export type ShopifyOrderInput = {
  shopifyId: string;
  orderNumber: string;
  name: string;
  email?: string;
  phone?: string;
  shopifyCreatedAt: number;
  processedAt?: number;
  updatedAt?: number;
  closedAt?: number;
  cancelledAt?: number;
  totalPrice: number;
  subtotalPrice: number;
  totalDiscounts: number;
  totalTip?: number;
  currency?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  totalItems: number;
  totalQuantity: number;
  totalWeight?: number;
  tags?: string[];
  note?: string;
  shippingAddress?: {
    country?: string;
    province?: string;
    city?: string;
    zip?: string;
  };
  customer?: {
    shopifyId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    shopifyCreatedAt?: number;
    shopifyUpdatedAt?: number;
  };
  lineItems: ShopifyOrderLineItemInput[];
  syncedAt?: number;
};
