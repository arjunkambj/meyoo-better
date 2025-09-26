import { v } from "convex/values";
import { SHOPIFY_CONFIG } from "../../libs/shopify/shopify.config";
import { ShopifyGraphQLClient } from "../../libs/shopify/ShopifyGraphQLClient";
import { createSimpleLogger } from "../../libs/logging/simple";
import { parseMoney, roundMoney } from "../../libs/utils/money";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { createJob, PRIORITY } from "../engine/workpool";

// Minimal GraphQL types to avoid `any`
type ShopifyMoney = { amount?: string; currencyCode?: string };
type ShopifyProductVariant = {
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
type ShopifyProductNode = {
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
type ShopifyLineItem = {
  id: string;
  title?: string;
  name?: string;
  quantity?: number;
  sku?: string;
  variant?: { id?: string; product?: { id?: string } };
  originalUnitPriceSet?: { shopMoney?: ShopifyMoney };
  discountedUnitPriceSet?: { shopMoney?: ShopifyMoney };
  fulfillableQuantity?: number;
  fulfillmentStatus?: string;
};
type ShopifyTransaction = {
  id: string;
  kind?: string;
  status?: string;
  gateway?: string;
  amountSet?: { shopMoney?: ShopifyMoney };
  fees?: Array<{ amount?: { amount?: string } }>;
  paymentId?: string;
  paymentDetails?: {
    creditCardBin?: string;
    creditCardCompany?: string;
    creditCardNumber?: string;
  };
  createdAt: string;
  processedAt?: string;
};
type ShopifyRefund = {
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
type ShopifyFulfillment = {
  id: string;
  status: string;
  trackingInfo?: Array<{ company?: string; number?: string; url?: string }>;
  fulfillmentLineItems?: {
    edges?: Array<{ node: { id?: string; quantity?: number } }>;
  };
  createdAt?: string;
  updatedAt?: string;
};
type ShopifyOrderNode = {
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
  };
  lineItems?: { edges?: Array<{ node: ShopifyLineItem }> };
  transactions?: Array<ShopifyTransaction>;
  refunds?: Array<ShopifyRefund>;
  fulfillments?: Array<ShopifyFulfillment>;
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

// Shape used when reading orders with attribution from our DB
type AttributedOrder = {
  _id: Id<"shopifyOrders">;
  shopifyCreatedAt: number | string;
  totalPrice?: number;
  sourceUrl?: string;
  landingSite?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  shippingAddress?: { country?: string; province?: string; city?: string };
  customerJourneySummary?: {
    firstVisit?: {
      id?: string;
      occurredAt?: string;
      referrerInfo?: { source?: string; domain?: string };
      landingPage?: string;
      utmParameters?: {
        source?: string;
        medium?: string;
        campaign?: string;
        content?: string;
        term?: string;
      };
      device?: { type?: string };
    };
    momentsCount?: number;
  };
};

const logger = createSimpleLogger("ShopifySync");

type OrderPersistencePayload = {
  order: ShopifyOrderInput;
  transactions: Array<Record<string, unknown>>;
  refunds: Array<Record<string, unknown>>;
  fulfillments: Array<Record<string, unknown>>;
};

const toOptional = (value: unknown): string | undefined =>
  value === null || value === undefined || value === ""
    ? undefined
    : typeof value === "string"
      ? value
      : String(value);

type ShopifyOrderLineItemInput = {
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

type ShopifyOrderInput = {
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
  totalTax: number;
  totalDiscounts: number;
  totalShippingPrice: number;
  totalTip?: number;
  currency?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  totalItems: number;
  totalQuantity: number;
  totalWeight?: number;
  tags?: string[];
  note?: string;
  riskLevel?: string;
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
  };
  lineItems: ShopifyOrderLineItemInput[];
  sourceUrl?: string;
  landingSite?: string;
  referringSite?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  syncedAt?: number;
};

function mapOrderNodeToPersistence(
  order: ShopifyOrderNode,
  organizationId: Id<"organizations">,
): OrderPersistencePayload {
  const orderId = String(order.id).replace("gid://shopify/Order/", "");

  let sourceUrl: string | undefined;
  let landingSite: string | undefined;
  let referringSite: string | undefined;
  let utmSource: string | undefined;
  let utmMedium: string | undefined;
  let utmCampaign: string | undefined;

  if (order.customerJourneySummary?.firstVisit) {
    const journey = order.customerJourneySummary.firstVisit;
    sourceUrl = toOptional(journey.source);
    landingSite = toOptional(journey.landingPage);
    referringSite = toOptional(journey.referrerUrl);
    if (journey.utmParameters) {
      utmSource = toOptional(journey.utmParameters.source);
      utmMedium = toOptional(journey.utmParameters.medium);
      utmCampaign = toOptional(journey.utmParameters.campaign);
    }
  }

  const orderData: ShopifyOrderInput = {
    shopifyId: orderId,
    orderNumber: order.name?.replace("#", "") || orderId,
    name: order.name || orderId,
    email: toOptional(order.email),
    phone: toOptional(order.phone),
    shopifyCreatedAt: Date.parse(String(order.createdAt ?? Date.now())),
    processedAt: order.processedAt ? Date.parse(String(order.processedAt)) : undefined,
    updatedAt: order.updatedAt ? Date.parse(String(order.updatedAt)) : undefined,
    closedAt: order.closedAt ? Date.parse(String(order.closedAt)) : undefined,
    cancelledAt: order.cancelledAt ? Date.parse(String(order.cancelledAt)) : undefined,
    totalPrice: parseMoney(order.currentTotalPriceSet?.shopMoney?.amount),
    subtotalPrice: parseMoney(order.currentSubtotalPriceSet?.shopMoney?.amount),
    totalTax: parseMoney(order.currentTotalTaxSet?.shopMoney?.amount),
    totalDiscounts: parseMoney(order.currentTotalDiscountsSet?.shopMoney?.amount),
    totalShippingPrice: parseMoney(order.totalShippingPriceSet?.shopMoney?.amount),
    totalTip: order.totalTipReceivedSet
      ? parseMoney(order.totalTipReceivedSet.shopMoney?.amount)
      : undefined,
    currency: toOptional(order.currentTotalPriceSet?.shopMoney?.currencyCode),
    financialStatus: toOptional((order as any).displayFinancialStatus),
    fulfillmentStatus: toOptional((order as any).displayFulfillmentStatus),
    totalItems: order.lineItems?.edges?.length || 0,
    totalQuantity:
      order.subtotalLineItemsQuantity !== undefined
        ? parseInt(String(order.subtotalLineItemsQuantity), 10) || 0
        : 0,
    totalWeight: order.totalWeight
      ? roundMoney(parseFloat(String(order.totalWeight)))
      : undefined,
    tags: Array.isArray(order.tags)
      ? order.tags.filter((tag) => Boolean(toOptional(tag)))
      : [],
    note: toOptional(order.note),
    riskLevel: toOptional(order.risks?.[0]?.level),
    shippingAddress: order.shippingAddress
      ? {
          country: toOptional(order.shippingAddress.country),
          province: toOptional(order.shippingAddress.provinceCode),
          city: toOptional(order.shippingAddress.city),
          zip: toOptional(order.shippingAddress.zip),
        }
      : undefined,
    customer: order.customer
      ? {
          shopifyId: String(order.customer.id).replace(
            "gid://shopify/Customer/",
            "",
          ),
          email: toOptional(order.customer.email),
          firstName: toOptional(order.customer.firstName),
          lastName: toOptional(order.customer.lastName),
          phone: toOptional(order.customer.phone),
        }
      : undefined,
    lineItems:
      order.lineItems?.edges?.map((itemEdge: { node: ShopifyLineItem }) => {
        const item = itemEdge.node;
        const basePrice = parseMoney(item.originalUnitPriceSet?.shopMoney?.amount);
        const discounted = item.discountedUnitPriceSet
          ? parseMoney(item.discountedUnitPriceSet.shopMoney?.amount)
          : undefined;

        return {
          shopifyId: String(item.id).replace("gid://shopify/LineItem/", ""),
          title: toOptional(item.title) ?? toOptional((item as any).name) ?? "",
          name: toOptional((item as any).name),
          quantity: item.quantity ?? 0,
          sku: toOptional(item.sku),
          shopifyVariantId: item.variant?.id
            ? String(item.variant.id).replace("gid://shopify/ProductVariant/", "")
            : undefined,
          shopifyProductId: (item.variant as any)?.product?.id
            ? String((item.variant as any).product.id).replace(
                "gid://shopify/Product/",
                "",
              )
            : undefined,
          price: basePrice,
          totalDiscount:
            discounted !== undefined ? Math.max(0, basePrice - discounted) : 0,
          discountedPrice: discounted,
          fulfillableQuantity: item.fulfillableQuantity ?? item.quantity ?? 0,
          fulfillmentStatus: toOptional(item.fulfillmentStatus),
        };
      }) || [],
    sourceUrl,
    landingSite,
    referringSite,
    utmSource,
    utmMedium,
    utmCampaign,
    syncedAt: Date.now(),
  };

  const transactions: Array<Record<string, unknown>> = [];

  if (order.transactions && Array.isArray(order.transactions)) {
    for (const transaction of order.transactions) {
      transactions.push({
        organizationId,
        shopifyOrderId: orderId,
        shopifyId: transaction.id.replace(
          "gid://shopify/OrderTransaction/",
          "",
        ),
        kind: transaction.kind,
        status: transaction.status,
        gateway: transaction.gateway,
        amount: parseMoney(
          String(transaction.amountSet?.shopMoney?.amount ?? "0"),
        ),
        fee:
          transaction.fees && transaction.fees.length > 0
            ? parseMoney(String(transaction.fees[0]?.amount?.amount))
            : undefined,
        paymentId: transaction.paymentId,
        paymentDetails: transaction.paymentDetails
          ? {
              creditCardBin: transaction.paymentDetails.creditCardBin,
              creditCardCompany: transaction.paymentDetails.creditCardCompany,
              creditCardNumber: transaction.paymentDetails.creditCardNumber,
            }
          : undefined,
        shopifyCreatedAt: Date.parse(transaction.createdAt),
        processedAt: transaction.processedAt
          ? Date.parse(transaction.processedAt)
          : undefined,
      });
    }
  }

  const refunds: Array<Record<string, unknown>> = [];

  if (order.refunds && Array.isArray(order.refunds)) {
    for (const refund of order.refunds) {
      refunds.push({
        organizationId,
        shopifyOrderId: orderId,
        shopifyId: refund.id.replace("gid://shopify/Refund/", ""),
        note: refund.note || undefined,
        userId: refund.user?.id || undefined,
        totalRefunded: parseMoney(refund.totalRefundedSet?.shopMoney?.amount),
        refundLineItems:
          refund.refundLineItems?.edges?.map((edge) => {
            const item = edge.node;
            return {
              lineItemId: item.lineItem?.id
                ? String(item.lineItem.id).replace("gid://shopify/LineItem/", "")
                : "",
              quantity: item.quantity || 0,
              subtotal: parseMoney(item.subtotalSet?.shopMoney?.amount),
            };
          }) || [],
        shopifyCreatedAt: Date.parse(
          String(refund.createdAt || new Date().toISOString()),
        ),
        processedAt: refund.processedAt
          ? Date.parse(String(refund.processedAt))
          : undefined,
      });
    }
  }

  const fulfillments: Array<Record<string, unknown>> = [];

  if (order.fulfillments && Array.isArray(order.fulfillments)) {
    for (const fulfillment of order.fulfillments) {
      fulfillments.push({
        organizationId,
        shopifyOrderId: orderId,
        shopifyId: fulfillment.id.replace("gid://shopify/Fulfillment/", ""),
        status: fulfillment.status,
        shipmentStatus: undefined,
        trackingCompany: fulfillment.trackingInfo?.[0]?.company || undefined,
        trackingNumbers: fulfillment.trackingInfo?.map((t) => t.number) || [],
        trackingUrls: fulfillment.trackingInfo?.map((t) => t.url) || [],
        locationId: undefined,
        service: undefined,
        lineItems:
          fulfillment.fulfillmentLineItems?.edges?.map((edge) => {
            const item = edge.node;
            return {
              id: item.id,
              quantity: item.quantity || 0,
            };
          }) || [],
        shopifyCreatedAt: Date.parse(
          String(fulfillment.createdAt || new Date().toISOString()),
        ),
        shopifyUpdatedAt: fulfillment.updatedAt
          ? Date.parse(String(fulfillment.updatedAt))
          : undefined,
      });
    }
  }

  return {
    order: orderData,
    transactions,
    refunds,
    fulfillments,
  };
}

/**
 * Shopify Sync Functions
 * Handles initial and incremental data synchronization
 */

/**
 * Initial sync - fetch 60 days of historical data
 */
export const initial = internalAction({
  args: {
    organizationId: v.id("organizations"),
    syncSessionId: v.optional(v.id("syncSessions")),
    dateRange: v.optional(
      v.object({
        daysBack: v.number(),
      })
    ),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    recordsProcessed: number;
    dataChanged: boolean;
    errors?: string[];
    batchStats: {
      batchesScheduled: number;
      ordersQueued: number;
      jobIds: string[];
    };
    productsProcessed: number;
    customersProcessed: number;
  }> => {
    const processId = Math.random().toString(36).substring(7);
    const daysBack = args.dateRange?.daysBack || 60;

    logger.info("Starting initial sync", {
      organizationId: args.organizationId,
      daysBack,
      processId,
      startedAt: new Date().toISOString(),
    });

    try {
      // Get store credentials from database
      const store = await ctx.runQuery(
        internal.integrations.shopify.getActiveStoreInternal,
        {
          organizationId: args.organizationId,
        }
      );

      if (!store) {
        throw new Error("No active Shopify store found");
      }

      // Store the storeId for use in all data mappings
      const storeId = store._id;

      logger.debug("Store found", {
        storeId,
        shopDomain: store.shopDomain,
      });

      // Initialize Shopify client
      const client = new ShopifyGraphQLClient({
        shopDomain: store.shopDomain,
        accessToken: store.accessToken,
        apiVersion: store.apiVersion,
      });

      let totalRecordsProcessed = 0;
      const errors: string[] = [];

      // Calculate date range for orders in the shop's timezone, converted to UTC
      const { shopDaysBackRange } = await import("../../libs/time/range");
      const range = await shopDaysBackRange(ctx, args.organizationId, daysBack);
      const startIso = `${range.startDate}T00:00:00.000Z`;
      const endIso = `${range.endDate}T23:59:59.999Z`;
      const dateQuery = `created_at:>='${startIso}' AND created_at:<='${endIso}'`;

      // Parallel fetch products, orders, and customers
      // 1. Fetch Products
      const productsPromise = (async () => {
          try {
            logger.info("Starting products fetch", {
              timestamp: new Date().toISOString(),
              storeId: store._id,
              domain: store.shopDomain,
              hasAccessToken: !!store.accessToken,
              apiVersion: store.apiVersion,
            });
            const products: Array<Record<string, unknown>> = [];
            let hasNextPage = true;
            let cursor = null;
            let pageCount = 0;

            while (hasNextPage) {
              pageCount++;
              logger.debug(`Fetching products page ${pageCount}`, {
                cursor,
                batchSize: SHOPIFY_CONFIG.QUERIES.PRODUCTS_BATCH_SIZE,
              });

              const response: any = await client.getProducts(
                SHOPIFY_CONFIG.QUERIES.PRODUCTS_BATCH_SIZE,
                cursor,
                undefined,
              );

              // Log the full response structure for debugging
              logger.debug("Product API Response", {
                hasData: !!response.data,
                hasProducts: !!response.data?.products,
                hasEdges: !!response.data?.products?.edges,
                edgeCount: response.data?.products?.edges?.length || 0,
                pageInfo: response.data?.products?.pageInfo,
                errors: response.errors,
                extensions: response.extensions,
              });

              // Check for errors first
              if (response.errors && response.errors.length > 0) {
                logger.error("GraphQL errors in product fetch", {
                  errors: response.errors,
                  extensions: response.extensions,
                });
                throw new Error(
                  `GraphQL errors: ${JSON.stringify(response.errors)}`
                );
              }

              // Also log if we have data but in a different structure
              if (!response.data) {
                logger.error("No data in response", {
                  fullResponse: JSON.stringify(response, null, 2),
                });
              } else if (!response.data.products) {
                logger.error("No products field in data", {
                  dataKeys: Object.keys(response.data),
                  data: JSON.stringify(response.data, null, 2),
                });
              }

              if (
                response.data?.products?.edges &&
                response.data.products.edges.length > 0
              ) {
                logger.info(
                  `Processing ${response.data.products.edges.length} products from page ${pageCount}`
                );
                // Map product edges
                const batch = response.data.products.edges.map(
                  (edge: { node: ShopifyProductNode }) => {
                    const product = edge.node;

                    // Parse variants
                    const variants: Array<Record<string, unknown>> = [];

                    const variantsEdges =
                      (product.variants?.edges as Array<{
                        node: ShopifyProductVariant;
                      }>) || [];
                    if (variantsEdges.length > 0) {
                      for (const variantEdge of variantsEdges) {
                        const variant = variantEdge.node;

                        const variantData = {
                          shopifyId: String(variant.id).replace(
                            "gid://shopify/ProductVariant/",
                            ""
                          ),
                          title: variant.title,
                          sku: variant.sku || undefined,
                          barcode: variant.barcode || undefined,
                          price: parseMoney(String(variant.price)),
                          compareAtPrice: variant.compareAtPrice
                            ? parseMoney(String(variant.compareAtPrice))
                            : undefined,
                          position: variant.position,
                          inventoryQuantity: variant.inventoryQuantity || 0,
                          available: variant.availableForSale !== false,
                          taxable: variant.taxable,
                          inventoryItemId:
                            variant.inventoryItem?.id?.replace(
                              "gid://shopify/InventoryItem/",
                              ""
                            ) || undefined,
                          costPerItem: variant.inventoryItem?.unitCost?.amount
                            ? parseMoney(
                                String(variant.inventoryItem.unitCost.amount)
                              )
                            : undefined,
                          weight:
                            variant.inventoryItem?.measurement?.weight?.value ||
                            undefined,
                          weightUnit:
                            variant.inventoryItem?.measurement?.weight?.unit ||
                            undefined,
                          shopifyCreatedAt: Date.parse(variant.createdAt),
                          shopifyUpdatedAt: Date.parse(variant.updatedAt),
                          option1: variant.selectedOptions?.[0]?.value,
                          option2: variant.selectedOptions?.[1]?.value,
                          option3: variant.selectedOptions?.[2]?.value,
                          inventoryLevels: [],
                        };

                        variants.push(variantData);
                      }
                    }

                    return {
                      organizationId:
                        args.organizationId as Id<"organizations">,
                      storeId,
                      shopifyId: String(product.id).replace(
                        "gid://shopify/Product/",
                        ""
                      ),
                      handle: product.handle,
                      title: product.title,
                      productType: product.productType || undefined,
                      vendor: product.vendor || undefined,
                      status: product.status,
                      featuredImage: product.featuredImage?.url || undefined,
                      totalInventory: product.totalInventory
                        ? parseInt(String(product.totalInventory), 10)
                        : 0,
                      totalVariants: variants.length,
                      tags: product.tags || [],
                      shopifyCreatedAt: Date.parse(String(product.createdAt)),
                      shopifyUpdatedAt: Date.parse(String(product.updatedAt)),
                      publishedAt: product.publishedAt
                        ? Date.parse(String(product.publishedAt))
                        : undefined,
                      syncedAt: Date.now(),
                      variants,
                    };
                  }
                );

                products.push(...batch);

                hasNextPage = response.data.products.pageInfo.hasNextPage;
                cursor = response.data.products.pageInfo.endCursor;
                logger.debug(`Page ${pageCount} complete`, {
                  hasNextPage,
                  nextCursor: cursor,
                  totalProductsSoFar: products.length,
                });
              } else {
                logger.warn("No products in response", {
                  pageCount,
                  response: JSON.stringify(response, null, 2),
                });
                hasNextPage = false;
              }
            }

            // Fetch inventory levels separately to reduce query cost
            if (products.length > 0) {
              logger.info("Fetching inventory levels for all variants");

              // Collect all inventory item IDs
              const inventoryItemIds: string[] = [];
              const inventoryItemToVariant = new Map<
                string,
                Record<string, unknown>
              >();

              for (const product of products) {
                const variants = (product.variants as any[]) || [];
                for (const variant of variants) {
                  if (variant.inventoryItemId) {
                    const gid = `gid://shopify/InventoryItem/${variant.inventoryItemId}`;

                    inventoryItemIds.push(gid);
                    inventoryItemToVariant.set(gid, variant);
                  }
                }
              }

              logger.debug(
                `Found ${inventoryItemIds.length} inventory items to fetch`
              );

              // Fetch inventory in batches
              const batchSize = SHOPIFY_CONFIG.QUERIES.INVENTORY_BATCH_SIZE;

              for (let i = 0; i < inventoryItemIds.length; i += batchSize) {
                const batch = inventoryItemIds.slice(i, i + batchSize);

                logger.debug(
                  `Fetching inventory batch ${Math.floor(i / batchSize) + 1}`,
                  {
                    batchSize: batch.length,
                    from: i,
                    to: Math.min(i + batchSize, inventoryItemIds.length),
                  }
                );

                try {
                  const invResponse: any =
                    await client.getInventoryLevels(batch);

                  if (invResponse.data?.nodes) {
                    // Map inventory data back to variants
                    for (const node of invResponse.data.nodes) {
                      const variant = inventoryItemToVariant.get(node.id);

                      if (variant && node.inventoryLevels?.edges) {
                        variant.inventoryLevels =
                          node.inventoryLevels.edges.map(
                            (edge: {
                              node: {
                                available?: number | null;
                                incoming?: number | null;
                                committed?: number | null;
                                location?:
                                  | {
                                      id?: string | null;
                                      name?: string | null;
                                    }
                                  | null;
                              };
                            }) => {
                              const location = edge.node.location;
                              return {
                                locationId:
                                  location?.id?.replace(
                                    "gid://shopify/Location/",
                                    ""
                                  ) || "",
                                locationName:
                                  location?.name?.trim() || undefined,
                                available:
                                  typeof edge.node.available === "number"
                                    ? edge.node.available
                                    : 0,
                                incoming:
                                  typeof edge.node.incoming === "number"
                                    ? edge.node.incoming
                                    : 0,
                                committed:
                                  typeof edge.node.committed === "number"
                                    ? edge.node.committed
                                    : 0,
                              };
                            }
                          );
                      }
                    }
                  }
                } catch (error) {
                  logger.error("Failed to fetch inventory batch", {
                    batch: i / batchSize + 1,
                    error:
                      error instanceof Error
                        ? error.message
                        : JSON.stringify(error),
                  });
                  // Continue with other batches even if one fails
                }
              }

              logger.info("Inventory levels fetched successfully");
            }

            // Store products in database
            if (products.length > 0) {
              await ctx.runMutation(
                internal.integrations.shopify.storeProductsInternal,
                {
                  organizationId: args.organizationId as Id<"organizations">,
                  storeId, // pass through to avoid race on active store lookup
                  products,
                }
              );
              
              // Calculate COGS coverage statistics
              const variantsWithCogs = products.reduce((acc, p) => {
                const variants = (p.variants as any[]) || [];
                return acc + variants.filter(v => v.costPerItem !== undefined).length;
              }, 0);
              const totalVariants = products.reduce((acc, p) => {
                const variants = (p.variants as any[]) || [];
                return acc + variants.length;
              }, 0);
              const cogsPercentage = totalVariants > 0 
                ? Math.round((variantsWithCogs / totalVariants) * 100)
                : 0;
              
              logger.info("COGS Coverage Report", {
                variantsWithCogs,
                totalVariants,
                cogsPercentage: `${cogsPercentage}%`,
                missingCogs: totalVariants - variantsWithCogs,
              });
              
              // Create product cost components for variants with COGS
              const variantsToCreateCostComponents: Array<{
                variantId: string;
                cogsPerUnit: number;
              }> = [];
              
              for (const product of products) {
                const variants = (product.variants as any[]) || [];
                for (const variant of variants) {
                  if (variant.costPerItem !== undefined && variant.costPerItem > 0) {
                    variantsToCreateCostComponents.push({
                      variantId: variant.shopifyId,
                      cogsPerUnit: variant.costPerItem,
                    });
                  }
                }
              }
              
              if (variantsToCreateCostComponents.length > 0) {
                logger.info("Creating product cost components", {
                  count: variantsToCreateCostComponents.length,
                });
                
                await ctx.runMutation(
                  internal.core.costs.createProductCostComponents,
                  {
                    organizationId: args.organizationId as Id<"organizations">,
                    components: variantsToCreateCostComponents,
                  }
                );
              }
            }

            logger.info("Products fetched", {
              count: products.length,
              completedAt: new Date().toISOString(),
            });

            return products.length;
          } catch (error) {
            errors.push(`Product sync failed: ${error}`);
            logger.error("Product sync failed", error);

            return 0;
          }
        })();

      // 2. Fetch Orders with full details in paginated batches and enqueue persistence jobs
      const ordersPromise = (async () => {
        const startTime = Date.now();
        const persistBatchSize =
          SHOPIFY_CONFIG.SYNC?.ORDERS_PERSIST_BATCH_SIZE ?? 25;

        try {
          logger.info("Starting orders fetch", {
            timestamp: new Date().toISOString(),
            dateQuery,
            startDate: startIso,
            endDate: endIso,
            daysBack,
            persistBatchSize,
          });

          const ordersBatch: Array<Record<string, unknown>> = [];
          const transactionsBatch: Array<Record<string, unknown>> = [];
          const refundsBatch: Array<Record<string, unknown>> = [];
          const fulfillmentsBatch: Array<Record<string, unknown>> = [];

          let hasNextPage = true;
          let cursor: string | null = null;
          let pageCount = 0;
          let totalOrdersSeen = 0;
          let batchesScheduled = 0;
          let ordersQueued = 0;
          const jobIds: string[] = [];

          const flushOrderBatch = async () => {
            if (!ordersBatch.length) return;

            const ordersPayload = [...ordersBatch];
            const transactionsPayload =
              transactionsBatch.length > 0 ? [...transactionsBatch] : undefined;
            const refundsPayload =
              refundsBatch.length > 0 ? [...refundsBatch] : undefined;
            const fulfillmentsPayload =
              fulfillmentsBatch.length > 0
                ? [...fulfillmentsBatch]
                : undefined;

            const jobId = await createJob(
              ctx,
              "sync:shopifyOrdersBatch",
              PRIORITY.HIGH,
              {
                organizationId: args.organizationId as Id<"organizations">,
                storeId,
                syncSessionId: args.syncSessionId,
                batchNumber: batchesScheduled + 1,
                cursor: cursor ?? undefined,
                orders: ordersPayload,
                transactions: transactionsPayload,
                refunds: refundsPayload,
                fulfillments: fulfillmentsPayload,
              },
            );

            batchesScheduled += 1;
            ordersQueued += ordersPayload.length;
            jobIds.push(jobId);

            ordersBatch.length = 0;
            transactionsBatch.length = 0;
            refundsBatch.length = 0;
            fulfillmentsBatch.length = 0;
          };

          while (hasNextPage) {
            pageCount += 1;
            logger.debug(`Fetching orders page ${pageCount}`, {
              cursor,
              dateQuery,
            });

            const response: any = await client.getOrders(
              SHOPIFY_CONFIG.QUERIES.ORDERS_BATCH_SIZE,
              cursor,
              dateQuery,
            );

            logger.debug("Orders API Response", {
              hasData: !!response.data,
              hasOrders: !!response.data?.orders,
              hasEdges: !!response.data?.orders?.edges,
              edgeCount: response.data?.orders?.edges?.length || 0,
              errors: response.errors,
              extensions: response.extensions,
            });

            if (response.errors && response.errors.length > 0) {
              logger.error("GraphQL errors in orders fetch", {
                errors: response.errors,
                extensions: response.extensions,
                dateQuery,
              });
            }

            if (
              response.data?.orders?.edges &&
              response.data.orders.edges.length > 0
            ) {
              const pageOrders =
                response.data.orders.edges as Array<{ node: ShopifyOrderNode }>;

              totalOrdersSeen += pageOrders.length;

              if (totalOrdersSeen % 100 === 0 || pageCount === 1) {
                logger.info(
                  `🔄 Order sync progress: ${totalOrdersSeen} orders processed`,
                  {
                    organizationId: args.organizationId as Id<"organizations">,
                    pageCount,
                  },
                );
              }

              for (const edge of pageOrders) {
                const { order: mappedOrder, transactions, refunds, fulfillments } =
                  mapOrderNodeToPersistence(
                    edge.node,
                    args.organizationId as Id<"organizations">,
                  );

                ordersBatch.push(mappedOrder);

                if (transactions.length) {
                  transactionsBatch.push(...transactions);
                }

                if (refunds.length) {
                  refundsBatch.push(...refunds);
                }

                if (fulfillments.length) {
                  fulfillmentsBatch.push(...fulfillments);
                }

                if (ordersBatch.length >= persistBatchSize) {
                  await flushOrderBatch();
                }
              }

              hasNextPage = response.data.orders.pageInfo.hasNextPage;
              cursor = response.data.orders.pageInfo.endCursor;
            } else {
              hasNextPage = false;
            }
          }

          await flushOrderBatch();

          logger.info("✅ Orders fetch completed and batches queued", {
            batchesScheduled,
            ordersQueued,
            jobIds,
            runtimeMs: Date.now() - startTime,
          });

          return {
            batchesScheduled,
            ordersQueued,
            jobIds,
            recordsProcessed: ordersQueued,
          };
        } catch (error) {
          errors.push(`Order sync failed: ${error}`);
          logger.error("Order sync failed", error);

          return {
            batchesScheduled: 0,
            ordersQueued: 0,
            jobIds: [],
            recordsProcessed: 0,
          };
        }
      })();


      // 3. Fetch Customers with complete data
      const customersPromise = (async () => {
          try {
            logger.debug("Fetching customers with complete data", {
              timestamp: new Date().toISOString(),
            });
            const customers = [];
            let hasNextPage = true;
            let cursor = null;

            while (hasNextPage) {
              const response: any = await client.getCustomers(
                SHOPIFY_CONFIG.QUERIES.CUSTOMERS_BATCH_SIZE,
                cursor
              );

              if (response.data?.customers?.edges) {
                // Fix customer processing with proper type handling
                const batch = response.data.customers.edges.map(
                  (edge: { node: { [key: string]: unknown } }) => {
                    const customer = edge.node;

                    // Extract customer ID without gid prefix
                    const customerId = String(customer.id).replace(
                      "gid://shopify/Customer/",
                      ""
                    );

                    return {
                      organizationId: args.organizationId,
                      storeId,
                      shopifyId: customerId,
                      email: customer.email || undefined,
                      phone: customer.phone || undefined,
                      firstName: customer.firstName || undefined,
                      lastName: customer.lastName || undefined,
                      ordersCount: parseInt(
                        String((customer as any).numberOfOrders?.count || 0),
                        10
                      ),
                      totalSpent: parseMoney(
                        String((customer as any).amountSpent?.amount)
                      ),
                      state: customer.state || undefined,
                      verifiedEmail: customer.verifiedEmail || false,
                      acceptsMarketing: customer.acceptsMarketing || false,
                      acceptsMarketingUpdatedAt:
                        customer.acceptsMarketingUpdatedAt
                          ? Date.parse(
                              String(customer.acceptsMarketingUpdatedAt)
                            )
                          : undefined,
                      taxExempt: customer.taxExempt || false,
                      defaultAddress: (customer as any).addresses?.[0]
                        ? {
                            country:
                              (customer as any).addresses[0].country ||
                              undefined,
                            province:
                              (customer as any).addresses[0].provinceCode ||
                              undefined,
                            city:
                              (customer as any).addresses[0].city || undefined,
                            zip:
                              (customer as any).addresses[0].zip ||
                              (customer as any).addresses[0].zipCode ||
                              undefined,
                          }
                        : undefined,
                      tags: customer.tags || [],
                      note: customer.note || undefined,
                      shopifyCreatedAt: Date.parse(String(customer.createdAt)),
                      shopifyUpdatedAt: Date.parse(String(customer.updatedAt)),
                      syncedAt: Date.now(),
                    };
                  }
                );

                customers.push(...batch);

                hasNextPage = response.data.customers.pageInfo.hasNextPage;
                cursor = response.data.customers.pageInfo.endCursor;
              } else {
                hasNextPage = false;
              }
            }

            // Store customers in database
            if (customers.length > 0) {
              await ctx.runMutation(
                internal.integrations.shopify.storeCustomersInternal,
                {
                  organizationId: args.organizationId,
                  customers,
                }
              );
            }

            logger.info("Customers fetched with complete data", {
              count: customers.length,
              completedAt: new Date().toISOString(),
            });

            return customers.length;
          } catch (error) {
            errors.push(`Customer sync failed: ${error}`);
            logger.error("Customer sync failed", error);

            return 0;
          }
        })();

      // Execute all syncs in parallel
      logger.info("Executing parallel API calls", {
        count: 3,
      });
      const startTime = Date.now();
      const [productsCount, orderStats, customersCount] = await Promise.all([
        productsPromise,
        ordersPromise,
        customersPromise,
      ]);
      const duration = Date.now() - startTime;

      logger.info("Parallel fetch completed", { durationMs: duration });
      totalRecordsProcessed =
        productsCount + orderStats.recordsProcessed + customersCount;

      logger.info("Initial sync completed", {
        totalRecordsProcessed,
        completedAt: new Date().toISOString(),
        durationMs: duration,
      });

      try {
        await ctx.runMutation(
          (internal.integrations.shopify as any).updateStoreLastSyncInternal,
          {
            storeId,
            timestamp: Date.now(),
          },
        );
      } catch (error) {
        logger.warn("Failed to update store last sync timestamp", {
          error,
          storeId,
        });
      }

      // Validate and monitor cost data completeness
      const validationReport: any = await ctx.runQuery(
        internal.core.costs.validateCostDataCompleteness,
        {
          organizationId: args.organizationId,
        }
      );
      
      if (validationReport) {
        logger.info("Cost Data Completeness Report", validationReport);
        
        // Notify if cost data is incomplete
        if (validationReport.completenessPercentage < 50) {
          logger.warn("Low cost data completeness detected", {
            organizationId: args.organizationId,
            completeness: `${validationReport.completenessPercentage}%`,
            recommendation: "Consider updating product costs in Shopify or manually setting costs in the application",
          });
        }
      }

      return {
        success: errors.length === 0,
        recordsProcessed: totalRecordsProcessed,
        dataChanged: totalRecordsProcessed > 0,
        errors: errors.length > 0 ? errors : undefined,
        batchStats: {
          batchesScheduled: orderStats.batchesScheduled,
          ordersQueued: orderStats.ordersQueued,
          jobIds: orderStats.jobIds,
        },
        productsProcessed: productsCount,
        customersProcessed: customersCount,
      };
    } catch (error) {
      logger.error("Initial sync failed", error, {
        organizationId: args.organizationId,
      });
      throw error;
    }
  },
});

/**
 * Incremental sync - fetch recent updates
 */
export const incremental = internalAction({
  args: {
    organizationId: v.id("organizations"),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    logger.info("Starting incremental sync", {
      organizationId: args.organizationId,
    });

    try {
      const store = await ctx.runQuery(
        internal.integrations.shopify.getActiveStoreInternal,
        {
          organizationId: args.organizationId,
        },
      );

      if (!store) {
        throw new Error("No active Shopify store found");
      }

      const storeId = store._id as Id<"shopifyStores">;
      const fallbackWindowMs = 6 * 60 * 60 * 1000; // 6 hours
      const sinceMs = args.since ?? store.lastSyncAt ?? Date.now() - fallbackWindowMs;
      const sinceIso = new Date(sinceMs).toISOString();

      const client = new ShopifyGraphQLClient({
        shopDomain: store.shopDomain,
        accessToken: store.accessToken,
        apiVersion: store.apiVersion,
      });

      const orders: ShopifyOrderInput[] = [];
      const transactions: Array<Record<string, unknown>> = [];
      const refunds: Array<Record<string, unknown>> = [];
      const fulfillments: Array<Record<string, unknown>> = [];

      let hasNextPage = true;
      let cursor: string | null = null;

      while (hasNextPage) {
        const response: any = await client.getOrders(
          SHOPIFY_CONFIG.QUERIES.ORDERS_BATCH_SIZE,
          cursor,
          `updated_at:>=${sinceIso}`,
        );

        if (response.errors && response.errors.length > 0) {
          logger.warn("Incremental orders query returned errors", {
            errors: response.errors,
          });
        }

        const edges = (response.data?.orders?.edges ?? []) as Array<{
          node: ShopifyOrderNode;
        }>;

        for (const edge of edges) {
          const { order, transactions: txs, refunds: rfs, fulfillments: ffs } =
            mapOrderNodeToPersistence(edge.node, args.organizationId as Id<"organizations">);

          orders.push(order);

          if (txs.length) transactions.push(...txs);
          if (rfs.length) refunds.push(...rfs);
          if (ffs.length) fulfillments.push(...ffs);
        }

        hasNextPage = response.data?.orders?.pageInfo?.hasNextPage || false;
        cursor = response.data?.orders?.pageInfo?.endCursor || null;
      }

      if (orders.length > 0) {
        await ctx.runMutation(
          internal.integrations.shopify.storeOrdersInternal,
          {
            organizationId: args.organizationId,
            storeId,
            orders,
          },
        );
      }

      if (transactions.length > 0) {
        await ctx.runMutation(
          internal.integrations.shopify.storeTransactionsInternal,
          {
            organizationId: args.organizationId,
            transactions,
          },
        );
      }

      if (refunds.length > 0) {
        await ctx.runMutation(
          internal.integrations.shopify.storeRefundsInternal,
          {
            organizationId: args.organizationId,
            refunds,
          },
        );
      }

      if (fulfillments.length > 0) {
        await ctx.runMutation(
          internal.integrations.shopify.storeFulfillmentsInternal,
          {
            organizationId: args.organizationId,
            fulfillments,
          },
        );
      }

      await ctx.runMutation(
        (internal.integrations.shopify as any).updateStoreLastSyncInternal,
        {
          storeId,
          timestamp: Date.now(),
        },
      );

      const recordsProcessed = orders.length;

      logger.info("Incremental sync completed", {
        organizationId: args.organizationId,
        recordsProcessed,
        sinceIso,
      });

      return {
        success: true,
        recordsProcessed,
        dataChanged: recordsProcessed > 0,
      };
    } catch (error) {
      logger.error("Incremental sync failed", error, {
        organizationId: args.organizationId,
      });
      throw error;
    }
  },
});

/**
 * Sync Shopify sessions and analytics data
 */
export const syncSessions = internalAction({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    dateRange: v.object({
      startDate: v.string(), // YYYY-MM-DD
      endDate: v.string(), // YYYY-MM-DD
    }),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sessionsProcessed: number;
    ordersProcessed: number;
  }> => {
    logger.info("Starting session sync", {
      organizationId: args.organizationId,
      dateRange: args.dateRange,
    });

    try {
      // Get store credentials
      const store = await ctx.runQuery(
        internal.integrations.shopify.getActiveStoreInternal,
        {
          organizationId: args.organizationId,
        }
      );

      if (!store) {
        throw new Error("No active Shopify store found");
      }

      // Initialize Shopify client
      const client = new ShopifyGraphQLClient({
        shopDomain: store.shopDomain,
        accessToken: store.accessToken,
      });

      let analyticsEntriesProcessed = 0;

      // Attempt to fetch Shopify analytics data (sessions, visitors, conversion)
      try {
        const analyticsResponse = await client.getAnalyticsSessions(
          args.dateRange.startDate,
          args.dateRange.endDate
        );

        const tableData =
          analyticsResponse.data?.shop?.shopifyAnalytics?.report?.tableData;

        if (tableData?.columns && tableData.rows) {
          const columnNames = tableData.columns
            .map((c) => (c?.name ?? "").toLowerCase())
            .map((name) => name.trim());

          type Accumulator = {
            date: string;
            source: string;
            sessions: number;
            visitors: number;
            pageViews: number;
            bounceWeighted: number;
            conversionWeighted: number;
            weightedSessions: number;
          };

          const aggregates = new Map<string, Accumulator>();

          const parseNumber = (value: string | undefined | null) => {
            if (!value) return 0;
            const cleaned = value.replace(/%/g, "").trim();
            const parsed = Number(cleaned);
            return Number.isFinite(parsed) ? parsed : 0;
          };

          for (const row of tableData.rows) {
            const cells = row.cells ?? [];
            const values: Record<string, string> = {};

            columnNames.forEach((col, idx) => {
              if (!col) return;
              values[col] = cells[idx]?.value ?? "";
            });

            const dateRaw = values["date"] || values["day"] || "";
            if (!dateRaw) continue;

            const date = new Date(dateRaw).toISOString().substring(0, 10);
            const sourceRaw =
              values["referrer_source"] || values["traffic_source"] || "unknown";
            const source = sourceRaw.toLowerCase() || "unknown";

            const sessions = parseNumber(values["sessions"]);
            if (sessions <= 0) continue;

            const visitors = parseNumber(values["visitors"]);
            const pageViews = parseNumber(values["page_views"]);
            const bounceRate = parseNumber(values["bounce_rate"]);
            const conversionRate = parseNumber(values["conversion_rate"]);

            const key = `${date}::${source}`;
            const acc = aggregates.get(key) ?? {
              date,
              source,
              sessions: 0,
              visitors: 0,
              pageViews: 0,
              bounceWeighted: 0,
              conversionWeighted: 0,
              weightedSessions: 0,
            };

            acc.sessions += sessions;
            acc.visitors += visitors;
            acc.pageViews += pageViews;
            acc.bounceWeighted += bounceRate * sessions;
            acc.conversionWeighted += conversionRate * sessions;
            acc.weightedSessions += sessions;

            aggregates.set(key, acc);
          }

          const entries = Array.from(aggregates.values()).map((acc) => {
            const averageBounce =
              acc.weightedSessions > 0
                ? acc.bounceWeighted / acc.weightedSessions
                : undefined;
            const averageConversion =
              acc.weightedSessions > 0
                ? acc.conversionWeighted / acc.weightedSessions
                : undefined;
            const conversions =
              averageConversion !== undefined
                ? (averageConversion / 100) * acc.sessions
                : undefined;

            return {
              date: acc.date,
              trafficSource: acc.source || "unknown",
              sessions: acc.sessions,
              visitors: acc.visitors || undefined,
              pageViews: acc.pageViews || undefined,
              bounceRate:
                averageBounce !== undefined ? Number(averageBounce.toFixed(2)) : undefined,
              conversionRate:
                averageConversion !== undefined
                  ? Number(averageConversion.toFixed(2))
                  : undefined,
              conversions:
                conversions !== undefined ? Number(conversions.toFixed(2)) : undefined,
              dataSource: "shopify_analytics",
            };
          });

          if (entries.length > 0) {
            await ctx.runMutation(
              internal.integrations.shopify.storeAnalyticsInternal,
              {
                organizationId: args.organizationId,
                storeId: args.storeId,
                entries,
              }
            );
            analyticsEntriesProcessed = entries.length;
          }
        } else if (analyticsResponse.errors && analyticsResponse.errors.length) {
          logger.warn("Shopify analytics query returned errors", {
            organizationId: args.organizationId,
            errors: analyticsResponse.errors,
          });
        }
      } catch (analyticsError) {
        logger.info("Falling back to order-derived sessions", {
          organizationId: args.organizationId,
          reason:
            analyticsError instanceof Error
              ? analyticsError.message
              : String(analyticsError),
        });
      }

      // Note: Shopify Analytics API requires Shopify Plus
      // For regular stores, we'll extract session data from orders as a fallback

      const ordersWithAttribution = (await ctx.runQuery(
        internal.integrations.shopify.getOrdersWithAttribution,
        {
          startDate: args.dateRange.startDate,
          endDate: args.dateRange.endDate,
          organizationId: args.organizationId,
        }
      )) as Array<AttributedOrder>;

      let sessionsProcessed = 0;

      // Process orders to extract session information
      for (const order of ordersWithAttribution) {
        const journey = order.customerJourneySummary;
        if (journey && typeof journey === "object") {
          // Create session record from customer journey
          const sessionData = {
            organizationId: args.organizationId,
            storeId: args.storeId,
            sessionId: `${order._id}_session`,
            visitorToken: journey.firstVisit?.id,
            startTime: journey.firstVisit?.occurredAt
              ? new Date(journey.firstVisit.occurredAt).getTime()
              : new Date(order.shopifyCreatedAt).getTime(),
            endTime: new Date(order.shopifyCreatedAt).getTime(),
            referrerSource:
              journey.firstVisit?.referrerInfo?.source || order.sourceUrl,
            referrerDomain: journey.firstVisit?.referrerInfo?.domain,
            landingPage: journey.firstVisit?.landingPage || order.landingSite,
            utmSource:
              journey.firstVisit?.utmParameters?.source || order.utmSource,
            utmMedium:
              journey.firstVisit?.utmParameters?.medium || order.utmMedium,
            utmCampaign:
              journey.firstVisit?.utmParameters?.campaign || order.utmCampaign,
            utmContent: journey.firstVisit?.utmParameters?.content,
            utmTerm: journey.firstVisit?.utmParameters?.term,
            pageViews: journey.momentsCount || 1,
            hasConverted: true,
            conversionValue: order.totalPrice || 0,
            deviceType: journey.firstVisit?.device?.type,
            country: order.shippingAddress?.country,
            region: order.shippingAddress?.province,
            city: order.shippingAddress?.city,
            syncedAt: Date.now(),
          };

          // Store session
          const existingSession = await ctx.runQuery(
            internal.integrations.shopify.getSessionByIdInternal,
            {
              sessionId: sessionData.sessionId,
            }
          );

          if (!existingSession) {
            await ctx.runMutation(
              internal.integrations.shopify.createSessionInternal,
              sessionData
            );
            sessionsProcessed++;
          }

          // Link order to session
          await ctx.runMutation(
            internal.integrations.shopify.updateOrderSessionInternal,
            {
              orderId: order._id,
              sessionId: sessionData.sessionId,
              visitorToken: sessionData.visitorToken,
              sessionSource: sessionData.referrerSource,
              sessionLandingPage: sessionData.landingPage,
              sessionPageViews: sessionData.pageViews,
            }
          );
        }
      }

      logger.info("Session sync completed", {
        sessionsProcessed,
        ordersProcessed: ordersWithAttribution.length,
        analyticsEntriesProcessed,
      });

      return {
        success: true,
        sessionsProcessed,
        ordersProcessed: ordersWithAttribution.length,
      };
    } catch (error) {
      logger.error("Session sync failed", error, {
        organizationId: args.organizationId,
      });
      throw error;
    }
  },
});
