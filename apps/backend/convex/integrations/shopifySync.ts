import { v } from "convex/values";
import { SHOPIFY_CONFIG } from "../../libs/shopify/shopify.config";
import { ShopifyGraphQLClient } from "../../libs/shopify/ShopifyGraphQLClient";
import { createSimpleLogger } from "../../libs/logging/simple";
import { parseMoney, roundMoney } from "../../libs/utils/money";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

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
      const syncPromises = [];

      // 1. Fetch Products
      syncPromises.push(
        (async () => {
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
                cursor
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
                            (edge: { node: Record<string, unknown> }) => {
                              const location = edge.node.location as
                                | { id?: string; name?: string }
                                | undefined;
                              const quantities = edge.node.quantities as
                                | Array<{ quantity?: number }>
                                | undefined;
                              return {
                                locationId:
                                  location?.id?.replace(
                                    "gid://shopify/Location/",
                                    ""
                                  ) || "",
                                locationName: location?.name || undefined,
                                available: quantities?.[0]?.quantity || 0,
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
        })()
      );

      // 2. Fetch Orders with full details
      syncPromises.push(
        (async () => {
          const startTime = Date.now();

          try {
            logger.info("Starting orders fetch", {
              timestamp: new Date().toISOString(),
              dateQuery,
              startDate: startIso,
              endDate: endIso,
              daysBack,
            });
            const orders = [];
            const transactions = [];
            const refunds = [];
            const fulfillments = [];
            let hasNextPage = true;
            let cursor = null;
            let pageCount = 0;
            let totalOrders = 0;

            while (hasNextPage) {
              pageCount++;
              logger.debug(`Fetching orders page ${pageCount}`, {
                cursor,
                dateQuery,
              });

              // Use the full getOrders query to get all details
              const response: any = await client.getOrders(
                SHOPIFY_CONFIG.QUERIES.ORDERS_BATCH_SIZE,
                cursor,
                dateQuery
              );

              // Log response structure
              logger.debug("Orders API Response", {
                hasData: !!response.data,
                hasOrders: !!response.data?.orders,
                hasEdges: !!response.data?.orders?.edges,
                edgeCount: response.data?.orders?.edges?.length || 0,
                errors: response.errors,
                extensions: response.extensions,
              });

              // Check for errors first
              if (response.errors && response.errors.length > 0) {
                logger.error("GraphQL errors in orders fetch", {
                  errors: response.errors,
                  extensions: response.extensions,
                  dateQuery,
                });
                // Don't throw, just log and continue with empty results
                // Some stores might not have orders in the date range
              }

              if (
                response.data?.orders?.edges &&
                response.data.orders.edges.length > 0
              ) {
                const batchSize = response.data.orders.edges.length;

                totalOrders += batchSize;

                logger.info(
                  `Processing ${batchSize} orders from page ${pageCount} (Total: ${totalOrders})`
                );

                // Log progress every 100 orders
                if (totalOrders % 100 === 0 || totalOrders === batchSize) {
                  logger.info(
                    `🔄 Order sync progress: ${totalOrders} orders processed`,
                    {
                      organizationId:
                        args.organizationId as Id<"organizations">,
                      pageCount,
                      estimatedTime: `${Math.round(totalOrders / 50)} seconds`,
                    }
                  );
                }

                for (const edge of response.data.orders.edges as Array<{
                  node: ShopifyOrderNode;
                }>) {
                  const order = edge.node;

                  // Extract order ID without gid prefix
                  const orderId = String(order.id).replace(
                    "gid://shopify/Order/",
                    ""
                  );

                  // Parse UTM attribution from customer journey
                  let _utmSource: string | undefined;
                  let _utmMedium: string | undefined;
                  let _utmCampaign: string | undefined;
                  let _sourceUrl: string | undefined;
                  let _landingSite: string | undefined;
                  let _referringSite: string | undefined;

                  if (order.customerJourneySummary?.firstVisit) {
                    const journey = order.customerJourneySummary.firstVisit;

                    _sourceUrl = journey.source || undefined;
                    _landingSite = journey.landingPage || undefined;
                    _referringSite = journey.referrerUrl || undefined;

                    if (journey.utmParameters) {
                      _utmSource = journey.utmParameters.source || undefined;
                      _utmMedium = journey.utmParameters.medium || undefined;
                      _utmCampaign =
                        journey.utmParameters.campaign || undefined;
                    }
                  }

                  // Map order data
                  const orderData = {
                    shopifyId: orderId,
                    orderNumber: order.name?.replace("#", "") || orderId,
                    name: order.name || orderId,
                    email: order.email || undefined,
                    phone: order.phone || undefined,
                    shopifyCreatedAt: Date.parse(String(order.createdAt)),
                    processedAt: order.processedAt
                      ? Date.parse(String(order.processedAt))
                      : undefined,
                    updatedAt: order.updatedAt
                      ? Date.parse(String(order.updatedAt))
                      : undefined,
                    closedAt: order.closedAt
                      ? Date.parse(String(order.closedAt))
                      : undefined,
                    cancelledAt: order.cancelledAt
                      ? Date.parse(String(order.cancelledAt))
                      : undefined,
                    totalPrice: parseMoney(
                      order.currentTotalPriceSet?.shopMoney?.amount
                    ),
                    subtotalPrice: parseMoney(
                      order.currentSubtotalPriceSet?.shopMoney?.amount
                    ),
                    totalTax: parseMoney(
                      order.currentTotalTaxSet?.shopMoney?.amount
                    ),
                    totalDiscounts: parseMoney(
                      order.currentTotalDiscountsSet?.shopMoney?.amount
                    ),
                    totalShippingPrice: parseMoney(
                      order.totalShippingPriceSet?.shopMoney?.amount
                    ),
                    totalTip: order.totalTipReceivedSet
                      ? parseMoney(order.totalTipReceivedSet.shopMoney?.amount)
                      : undefined,
                    currency:
                      order.currentTotalPriceSet?.shopMoney?.currencyCode ||
                      undefined,
                    financialStatus:
                      (order as any).displayFinancialStatus || undefined,
                    fulfillmentStatus:
                      (order as any).displayFulfillmentStatus || undefined,
                    totalItems: order.lineItems?.edges?.length || 0,
                    totalQuantity:
                      parseInt(String(order.subtotalLineItemsQuantity), 10) ||
                      0,
                    totalWeight: order.totalWeight
                      ? roundMoney(parseFloat(String(order.totalWeight)))
                      : undefined,
                    tags: order.tags || [],
                    note: order.note || undefined,
                    riskLevel: order.risks?.[0]?.level || undefined,
                    shippingAddress: order.shippingAddress
                      ? {
                          country: order.shippingAddress.country || undefined,
                          province:
                            order.shippingAddress.provinceCode || undefined,
                          city: order.shippingAddress.city || undefined,
                          zip: order.shippingAddress.zip || undefined,
                        }
                      : undefined,
                    // Customer data for linking
                    customer: order.customer
                      ? {
                          shopifyId: String(order.customer.id).replace(
                            "gid://shopify/Customer/",
                            ""
                          ),
                          email: order.customer.email || undefined,
                          firstName: order.customer.firstName || undefined,
                          lastName: order.customer.lastName || undefined,
                          phone: order.customer.phone || undefined,
                        }
                      : undefined,
                    // Line items
                    lineItems:
                      order.lineItems?.edges?.map(
                        (itemEdge: { node: ShopifyLineItem }) => {
                          const item = itemEdge.node;
                          const basePrice = parseMoney(
                            item.originalUnitPriceSet?.shopMoney?.amount
                          );
                          const discounted = item.discountedUnitPriceSet
                            ? parseMoney(
                                item.discountedUnitPriceSet?.shopMoney?.amount
                              )
                            : undefined;

                          return {
                            shopifyId: String(item.id).replace(
                              "gid://shopify/LineItem/",
                              ""
                            ),
                            title: item.title || item.name || "",
                            name: item.name || undefined,
                            quantity: item.quantity ?? 0,
                            sku: item.sku || undefined,
                            shopifyVariantId: item.variant?.id
                              ? String(item.variant.id).replace(
                                  "gid://shopify/ProductVariant/",
                                  ""
                                )
                              : undefined,
                            shopifyProductId: item.variant?.product?.id
                              ? String(item.variant.product.id).replace(
                                  "gid://shopify/Product/",
                                  ""
                                )
                              : undefined,
                            price: basePrice,
                            totalDiscount:
                              discounted !== undefined
                                ? Math.max(0, basePrice - discounted)
                                : 0,
                            discountedPrice: discounted,
                            fulfillableQuantity: item.fulfillableQuantity,
                            fulfillmentStatus:
                              item.fulfillmentStatus || undefined,
                          };
                        }
                      ) || [],
                  };

                  orders.push(orderData);

                  // Extract transactions
                  if (order.transactions && Array.isArray(order.transactions)) {
                    for (const transaction of order.transactions) {
                      transactions.push({
                        organizationId:
                          args.organizationId as Id<"organizations">,
                        shopifyOrderId: orderId,
                        shopifyId: transaction.id.replace(
                          "gid://shopify/OrderTransaction/",
                          ""
                        ),
                        kind: transaction.kind,
                        status: transaction.status,
                        gateway: transaction.gateway,
                        amount: parseMoney(
                          String(transaction.amountSet?.shopMoney?.amount ?? "0")
                        ),
                        fee:
                          transaction.fees && transaction.fees.length > 0
                            ? parseMoney(
                                String(transaction.fees[0]!.amount?.amount)
                              )
                            : undefined,
                        paymentId: transaction.paymentId || undefined,
                        paymentDetails: transaction.paymentDetails
                          ? {
                              creditCardBin:
                                transaction.paymentDetails.creditCardBin ||
                                undefined,
                              creditCardCompany:
                                transaction.paymentDetails.creditCardCompany ||
                                undefined,
                              creditCardNumber:
                                transaction.paymentDetails.creditCardNumber ||
                                undefined,
                            }
                          : undefined,
                        shopifyCreatedAt: Date.parse(transaction.createdAt),
                        processedAt: transaction.processedAt
                          ? Date.parse(transaction.processedAt)
                          : undefined,
                      });
                    }
                  }

                  // Extract refunds
                  if (order.refunds && Array.isArray(order.refunds)) {
                    for (const refund of order.refunds as Array<ShopifyRefund>) {
                      refunds.push({
                        organizationId: args.organizationId,
                        shopifyOrderId: orderId,
                        shopifyId: refund.id.replace(
                          "gid://shopify/Refund/",
                          ""
                        ),
                        note: refund.note || undefined,
                        userId: refund.user?.id || undefined,
                        totalRefunded: parseMoney(
                          refund.totalRefundedSet?.shopMoney?.amount
                        ),
                        refundLineItems:
                          refund.refundLineItems?.edges?.map(
                            (edge: {
                              node: {
                                lineItem?: { id?: string };
                                quantity?: number;
                                subtotalSet?: { shopMoney?: ShopifyMoney };
                              };
                            }) => {
                              const item = edge.node;

                              return {
                                lineItemId: item.lineItem?.id
                                  ? String(item.lineItem.id).replace(
                                      "gid://shopify/LineItem/",
                                      ""
                                    )
                                  : "",
                                quantity: item.quantity || 0,
                                subtotal: parseMoney(
                                  item.subtotalSet?.shopMoney?.amount
                                ),
                              };
                            }
                          ) || [],
                        shopifyCreatedAt: Date.parse(
                          String(refund.createdAt || new Date().toISOString())
                        ),
                        processedAt: refund.processedAt
                          ? Date.parse(String(refund.processedAt))
                          : undefined,
                      });
                    }
                  }

                  // Extract fulfillments
                  if (order.fulfillments && Array.isArray(order.fulfillments)) {
                    for (const fulfillment of order.fulfillments as Array<ShopifyFulfillment>) {
                      fulfillments.push({
                        organizationId: args.organizationId,
                        shopifyOrderId: orderId,
                        shopifyId: fulfillment.id.replace(
                          "gid://shopify/Fulfillment/",
                          ""
                        ),
                        status: fulfillment.status,
                        shipmentStatus: undefined, // Field doesn't exist in current API
                        trackingCompany:
                          fulfillment.trackingInfo?.[0]?.company || undefined,
                        trackingNumbers:
                          fulfillment.trackingInfo?.map((t) => t.number) || [],
                        trackingUrls:
                          fulfillment.trackingInfo?.map((t) => t.url) || [],
                        locationId: undefined, // Not available in current interface
                        service: undefined, // Not available in current interface
                        lineItems:
                          fulfillment.fulfillmentLineItems?.edges?.map(
                            (edge: {
                              node: { id?: string; quantity?: number };
                            }) => {
                              const item = edge.node;
                              return {
                                id: item.id,
                                quantity: item.quantity || 0,
                              };
                            }
                          ) || [],
                        shopifyCreatedAt: Date.parse(
                          String(
                            fulfillment.createdAt || new Date().toISOString()
                          )
                        ),
                        shopifyUpdatedAt: fulfillment.updatedAt
                          ? Date.parse(String(fulfillment.updatedAt))
                          : undefined,
                      });
                    }
                  }
                }

                hasNextPage = response.data.orders.pageInfo.hasNextPage;
                cursor = response.data.orders.pageInfo.endCursor;
              } else {
                hasNextPage = false;
              }
            }

            // Store all data in database
            if (orders.length > 0) {
              logger.info(`💾 Storing ${orders.length} orders to database`, {
                organizationId: args.organizationId,
                batchSize: SHOPIFY_CONFIG.BULK_OPS?.INSERT_SIZE || 100,
              });

              // Store orders with line items and customer data
              await ctx.runMutation(
                internal.integrations.shopify.storeOrdersInternal,
                {
                  organizationId: args.organizationId as Id<"organizations">,
                  storeId, // pass through to avoid race on active store lookup
                  orders: orders as any,
                }
              );

              // Store transactions
              if (transactions.length > 0) {
                await ctx.runMutation(
                  internal.integrations.shopify.storeTransactionsInternal,
                  {
                    organizationId: args.organizationId as Id<"organizations">,
                    transactions,
                  }
                );
              }

              // Store refunds
              if (refunds.length > 0) {
                await ctx.runMutation(
                  internal.integrations.shopify.storeRefundsInternal,
                  {
                    organizationId: args.organizationId as Id<"organizations">,
                    refunds,
                  }
                );
              }

              // Store fulfillments
              if (fulfillments.length > 0) {
                await ctx.runMutation(
                  internal.integrations.shopify.storeFulfillmentsInternal,
                  {
                    organizationId: args.organizationId as Id<"organizations">,
                    fulfillments,
                  }
                );
              }
              
              // Global average tax calculation removed; taxes managed per-variant
            }

            logger.info("✅ Orders sync completed successfully", {
              ordersCount: orders.length,
              transactionsCount: transactions.length,
              refundsCount: refunds.length,
              fulfillmentsCount: fulfillments.length,
              processingTime: `${Math.round((Date.now() - startTime) / 1000)}s`,
              avgTimePerOrder:
                orders.length > 0
                  ? `${Math.round((Date.now() - startTime) / orders.length)}ms`
                  : "N/A",
              completedAt: new Date().toISOString(),
            });

            return (
              orders.length +
              transactions.length +
              refunds.length +
              fulfillments.length
            );
          } catch (error) {
            errors.push(`Order sync failed: ${error}`);
            logger.error("Order sync failed", error);

            return 0;
          }
        })()
      );

      // 3. Fetch Customers with complete data
      syncPromises.push(
        (async () => {
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
        })()
      );

      // Execute all syncs in parallel
      logger.info("Executing parallel API calls", {
        count: syncPromises.length,
      });
      const startTime = Date.now();
      const results = await Promise.all(syncPromises);
      const duration = Date.now() - startTime;

      logger.info("Parallel fetch completed", { durationMs: duration });
      totalRecordsProcessed = results.reduce((sum, count) => sum + count, 0);

      logger.info("Initial sync completed", {
        totalRecordsProcessed,
        completedAt: new Date().toISOString(),
        durationMs: duration,
      });
      
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
  handler: async (_ctx, args) => {
    logger.info("Starting incremental sync", {
      organizationId: args.organizationId,
    });

    try {
      // TODO: Implement incremental sync
      // 1. Get last sync timestamp
      // 2. Fetch only updated records since then
      // 3. Update database

      const recordsProcessed = 0;

      logger.info("Incremental sync completed", {
        recordsProcessed,
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
      const _client = new ShopifyGraphQLClient({
        shopDomain: store.shopDomain,
        accessToken: store.accessToken,
      });

      // Fetch analytics data including sessions
      const _analyticsQuery = `
        query getAnalytics($startDate: DateTime!, $endDate: DateTime!) {
          shop {
            shopifyAnalytics {
              report(
                query: {
                  name: "sessions_over_time"
                  dimensions: ["date", "referrer_source", "landing_page"]
                  metrics: ["sessions", "visitors", "page_views", "bounce_rate", "conversion_rate"]
                  filters: [
                    { key: "date", operator: ">=", value: $startDate }
                    { key: "date", operator: "<=", value: $endDate }
                  ]
                }
              ) {
                tableData {
                  rows {
                    cells {
                      value
                    }
                  }
                }
              }
            }
          }
        }
      `;

      // Note: Shopify Analytics API requires Shopify Plus
      // For regular stores, we'll extract session data from orders
      // This is a fallback approach using order attribution data

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
