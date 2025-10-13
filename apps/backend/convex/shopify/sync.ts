import { v } from "convex/values";
import { SHOPIFY_CONFIG } from "../../libs/shopify/shopify.config";
import { ShopifyGraphQLClient } from "../../libs/shopify/ShopifyGraphQLClient";
import { createSimpleLogger } from "../../libs/logging/simple";
import { parseMoney, roundMoney } from "../../libs/utils/money";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { createJob, PRIORITY } from "../engine/workpool";
import { toStringArray } from "../utils/shopify";
import type {
  ShopifyLineItem,
  ShopifyOrderInput,
  ShopifyOrderNode,
  ShopifyProductNode,
  ShopifyProductVariant,
} from "./types";

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

const MAX_ERROR_SUMMARY_ITEMS = 3;

const shortenText = (input: string, maxWords: number) => {
  if (!input) return input;
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return words.slice(0, maxWords).join(" ");
};

const summarizeGraphQLErrors = (
  errors: Array<{ message?: string; extensions?: { code?: string } }>
) => {
  if (!errors.length) {
    return { count: 0, codes: [], samples: [] };
  }

  const byCode = new Map<string, number>();
  for (const error of errors) {
    const code = error.extensions?.code || "UNKNOWN";
    byCode.set(code, (byCode.get(code) ?? 0) + 1);
  }

  const samples: string[] = [];
  for (const error of errors) {
    if (!error.message) continue;
    const [firstLine] = error.message.split("\n");
    const sample = firstLine ?? error.message;
    if (!sample) continue;
    samples.push(shortenText(sample, 10));
    if (samples.length >= MAX_ERROR_SUMMARY_ITEMS) break;
  }

  return {
    count: errors.length,
    codes: Array.from(byCode.entries()).map(([code, occurrences]) => ({
      code,
      occurrences,
    })),
    samples,
  };
};

function mapOrderNodeToPersistence(
  order: ShopifyOrderNode,
  organizationId: Id<"organizations">
): OrderPersistencePayload {
  const orderId = String(order.id).replace("gid://shopify/Order/", "");

  const orderData: ShopifyOrderInput = {
    shopifyId: orderId,
    orderNumber: order.name?.replace("#", "") || orderId,
    name: order.name || orderId,
    email: toOptional(order.email),
    phone: toOptional(order.phone),
    shopifyCreatedAt: Date.parse(String(order.createdAt ?? Date.now())),
    processedAt: order.processedAt
      ? Date.parse(String(order.processedAt))
      : undefined,
    updatedAt: order.updatedAt
      ? Date.parse(String(order.updatedAt))
      : undefined,
    closedAt: order.closedAt ? Date.parse(String(order.closedAt)) : undefined,
    cancelledAt: order.cancelledAt
      ? Date.parse(String(order.cancelledAt))
      : undefined,
    totalPrice: parseMoney(order.currentTotalPriceSet?.shopMoney?.amount),
    subtotalPrice: parseMoney(order.currentSubtotalPriceSet?.shopMoney?.amount),
    totalDiscounts: parseMoney(
      order.currentTotalDiscountsSet?.shopMoney?.amount
    ),
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
            ""
          ),
          email: toOptional(order.customer.email),
          firstName: toOptional(order.customer.firstName),
          lastName: toOptional(order.customer.lastName),
          phone: toOptional(order.customer.phone),
          shopifyCreatedAt: order.customer.createdAt
            ? Date.parse(String(order.customer.createdAt))
            : undefined,
          shopifyUpdatedAt: order.customer.updatedAt
            ? Date.parse(String(order.customer.updatedAt))
            : undefined,
        }
      : undefined,
    lineItems:
      order.lineItems?.edges?.map((itemEdge: { node: ShopifyLineItem }) => {
        const item = itemEdge.node;
        const basePrice = parseMoney(
          item.originalUnitPriceSet?.shopMoney?.amount
        );
        const discounted = item.discountedUnitPriceSet
          ? parseMoney(item.discountedUnitPriceSet.shopMoney?.amount)
          : undefined;
        const quantity = item.quantity ?? 0;
        const rawDiscount = parseMoney(
          item.totalDiscountSet?.shopMoney?.amount
        );
        const perUnitDiscount =
          discounted !== undefined ? Math.max(0, basePrice - discounted) : 0;
        const computedDiscount =
          quantity > 0 ? roundMoney(perUnitDiscount * quantity) : 0;
        const totalDiscount = rawDiscount > 0 ? rawDiscount : computedDiscount;
        const sku = toOptional(item.sku) ?? toOptional(item.variant?.sku);

        return {
          shopifyId: String(item.id).replace("gid://shopify/LineItem/", ""),
          title: toOptional(item.title) ?? toOptional((item as any).name) ?? "",
          name: toOptional((item as any).name),
          quantity,
          sku,
          shopifyVariantId: item.variant?.id
            ? String(item.variant.id).replace(
                "gid://shopify/ProductVariant/",
                ""
              )
            : undefined,
          shopifyProductId: (item.variant as any)?.product?.id
            ? String((item.variant as any).product.id).replace(
                "gid://shopify/Product/",
                ""
              )
            : undefined,
          price: basePrice,
          totalDiscount,
          discountedPrice: discounted,
          fulfillableQuantity: item.fulfillableQuantity ?? item.quantity ?? 0,
          fulfillmentStatus: toOptional(item.fulfillmentStatus),
        };
      }) || [],
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
            ? parseMoney(String(transaction.fees[0]?.amount?.amount))
            : undefined,
        paymentId: transaction.paymentId,
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
                ? String(item.lineItem.id).replace(
                    "gid://shopify/LineItem/",
                    ""
                  )
                : "",
              quantity: item.quantity || 0,
              subtotal: parseMoney(item.subtotalSet?.shopMoney?.amount),
            };
          }) || [],
        shopifyCreatedAt: Date.parse(
          String(refund.createdAt || new Date().toISOString())
        ),
        processedAt: refund.processedAt
          ? Date.parse(String(refund.processedAt))
          : undefined,
      });
    }
  }

  const fulfillmentOrderLineInfo = new Map<
    string,
    {
      locationId?: string;
      serviceName?: string;
      methodType?: string;
      status?: string;
    }
  >();

  if (order.fulfillmentOrders?.edges) {
    for (const edge of order.fulfillmentOrders.edges) {
      const fulfillmentOrder = edge?.node;
      if (!fulfillmentOrder) continue;

      const locationId = fulfillmentOrder.assignedLocation?.location?.id
        ? String(fulfillmentOrder.assignedLocation.location.id).replace(
            "gid://shopify/Location/",
            ""
          )
        : undefined;
      const serviceName = fulfillmentOrder.deliveryMethod?.serviceName
        ? String(fulfillmentOrder.deliveryMethod.serviceName)
        : undefined;
      const methodType = fulfillmentOrder.deliveryMethod?.methodType
        ? String(fulfillmentOrder.deliveryMethod.methodType)
        : undefined;

      if (fulfillmentOrder.lineItems?.edges) {
        for (const lineEdge of fulfillmentOrder.lineItems.edges) {
          const lineNode = lineEdge?.node;
          const orderLineId = lineNode?.lineItem?.id
            ? String(lineNode.lineItem.id).replace(
                "gid://shopify/LineItem/",
                ""
              )
            : undefined;
          if (!orderLineId) continue;

          fulfillmentOrderLineInfo.set(orderLineId, {
            locationId,
            serviceName,
            methodType,
            status: fulfillmentOrder.status
              ? String(fulfillmentOrder.status)
              : undefined,
          });
        }
      }
    }
  }

  const fulfillments: Array<Record<string, unknown>> = [];

  if (order.fulfillments && Array.isArray(order.fulfillments)) {
    for (const fulfillment of order.fulfillments) {
      const trackingNumbers = toStringArray(
        fulfillment.trackingInfo?.map((t) => t.number)
      );
      const trackingUrls = toStringArray(
        fulfillment.trackingInfo?.map((t) => t.url)
      );
      const locationId =
        typeof fulfillment.location?.id === "string"
          ? fulfillment.location.id.replace("gid://shopify/Location/", "")
          : undefined;
      const serviceName =
        typeof fulfillment.service === "object" && fulfillment.service !== null
          ? (fulfillment.service as { serviceName?: string | null })
              .serviceName || undefined
          : (fulfillment.service ?? undefined);
      const trackingCompany = toOptional(
        fulfillment.trackingInfo?.[0]?.company
      );
      let derivedLocationId = locationId;
      let derivedServiceName = serviceName;
      let derivedShipmentStatus = fulfillment.shipmentStatus
        ? String(fulfillment.shipmentStatus)
        : undefined;

      const fulfillmentLineItems =
        fulfillment.fulfillmentLineItems?.edges ?? [];
      const normalizedLineItems = fulfillmentLineItems.map((edge) => {
        const item = edge.node;
        const quantity = item?.quantity || 0;
        const id = item?.id || "";
        const orderLineId = item?.lineItem?.id
          ? String(item.lineItem.id).replace("gid://shopify/LineItem/", "")
          : undefined;

        if (orderLineId) {
          const info = fulfillmentOrderLineInfo.get(orderLineId);
          if (info) {
            if (!derivedLocationId && info.locationId) {
              derivedLocationId = info.locationId;
            }
            if (!derivedServiceName && info.serviceName) {
              derivedServiceName = info.serviceName;
            }
            if (!derivedServiceName && info.methodType) {
              derivedServiceName = info.methodType;
            }
            if (!derivedShipmentStatus && info.status) {
              derivedShipmentStatus = info.status;
            }
          }
        }

        return {
          id,
          quantity,
        };
      });

      fulfillments.push({
        organizationId,
        shopifyOrderId: orderId,
        shopifyId: fulfillment.id.replace("gid://shopify/Fulfillment/", ""),
        status: fulfillment.status,
        shipmentStatus: toOptional(derivedShipmentStatus),
        trackingCompany,
        trackingNumbers: trackingNumbers ?? [],
        trackingUrls: trackingUrls ?? [],
        locationId: derivedLocationId,
        service: toOptional(derivedServiceName),
        lineItems: normalizedLineItems,
        shopifyCreatedAt: Date.parse(
          String(fulfillment.createdAt || new Date().toISOString())
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
  handler: async (
    ctx,
    args
  ): Promise<{
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
      type StageState = "pending" | "processing" | "completed" | "failed";
      type StageMetadataPatch = {
        stageStatus?: Partial<
          Record<"products" | "inventory" | "customers" | "orders", StageState>
        >;
        syncedEntities?: string[];
        lastCursor?: string | null;
        currentPage?: number;
        totalOrdersSeen?: number;
        totalPages?: number;
      };

      const patchSyncMetadata = async (metadata: StageMetadataPatch) => {
        if (!args.syncSessionId) return;
        await ctx.runMutation(internal.jobs.helpers.patchSyncSessionMetadata, {
          sessionId: args.syncSessionId,
          metadata: metadata as any,
        });
      };

      // Get store credentials from database
      const store = await ctx.runQuery(
        internal.shopify.internalQueries.getActiveStoreInternal,
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
      const fetchProducts = async () => {
        try {
          await patchSyncMetadata({
            stageStatus: {
              products: "processing",
              inventory: "processing",
            },
          });
          logger.info("Starting products fetch", {
            timestamp: new Date().toISOString(),
            storeId: store._id,
            domain: store.shopDomain,
            hasAccessToken: !!store.accessToken,
            apiVersion: store.apiVersion,
          });
          const products: Array<Record<string, unknown>> = [];
          const variantsToCreateCostComponents: Array<{
            variantId: string;
            cogsPerUnit: number;
          }> = [];
          let totalVariants = 0;
          let variantsWithCogs = 0;
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
              undefined
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

                      const unitCost = variant.inventoryItem?.unitCost?.amount
                        ? parseMoney(
                            String(variant.inventoryItem.unitCost.amount)
                          )
                        : undefined;

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
                      totalVariants += 1;
                      if (typeof unitCost === "number" && unitCost > 0) {
                        variantsToCreateCostComponents.push({
                          variantId: variantData.shopifyId,
                          cogsPerUnit: unitCost,
                        });
                        variantsWithCogs += 1;
                      }
                    }
                  }

                  return {
                    organizationId: args.organizationId as Id<"organizations">,
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
                const invResponse: any = await client.getInventoryLevels(batch);

                if (invResponse.data?.nodes) {
                  // Map inventory data back to variants
                  for (const node of invResponse.data.nodes) {
                    const variant = inventoryItemToVariant.get(node.id);

                    if (variant && node.inventoryLevels?.edges) {
                      variant.inventoryLevels = node.inventoryLevels.edges.map(
                        (edge: {
                          node: {
                            available?: number | null;
                            availableQuantity?: number | null;
                            incoming?: number | null;
                            incomingQuantity?: number | null;
                            committed?: number | null;
                            reservedQuantity?: number | null;
                            location?: {
                              id?: string | null;
                            } | null;
                          };
                        }) => {
                          const location = edge.node.location;
                          const availableValue =
                            typeof edge.node.availableQuantity === "number"
                              ? edge.node.availableQuantity
                              : typeof edge.node.available === "number"
                                ? edge.node.available
                                : 0;
                          const incomingValue =
                            typeof edge.node.incomingQuantity === "number"
                              ? edge.node.incomingQuantity
                              : typeof edge.node.incoming === "number"
                                ? edge.node.incoming
                                : 0;
                          const reservedValue =
                            typeof edge.node.reservedQuantity === "number"
                              ? edge.node.reservedQuantity
                              : typeof edge.node.committed === "number"
                                ? edge.node.committed
                                : 0;
                          return {
                            locationId:
                              location?.id?.replace(
                                "gid://shopify/Location/",
                                ""
                              ) || "",
                            available: availableValue,
                            incoming: incomingValue,
                            committed: reservedValue,
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
              internal.shopify.productMutations.storeProductsInternal,
              {
                organizationId: args.organizationId as Id<"organizations">,
                storeId, // pass through to avoid race on active store lookup
                products,
              }
            );

            // Calculate COGS coverage statistics
            const cogsPercentage =
              totalVariants > 0
                ? Math.round((variantsWithCogs / totalVariants) * 100)
                : 0;

            logger.info("COGS Coverage Report", {
              variantsWithCogs,
              totalVariants,
              cogsPercentage: `${cogsPercentage}%`,
              missingCogs: totalVariants - variantsWithCogs,
            });

            // Create product cost components for variants with COGS
            if (variantsToCreateCostComponents.length > 0) {
              logger.info("Creating product cost components", {
                count: variantsToCreateCostComponents.length,
              });

              await ctx.runMutation(internal.core.costs.createVariantCosts, {
                organizationId: args.organizationId as Id<"organizations">,
                components: variantsToCreateCostComponents,
              });
            }
          }

          logger.info("Products fetched", {
            count: products.length,
            completedAt: new Date().toISOString(),
          });

          await patchSyncMetadata({
            stageStatus: {
              products: "completed",
              inventory: "completed",
            },
            syncedEntities: ["products", "inventory"],
          });

          return products.length;
        } catch (error) {
          errors.push(`Product sync failed: ${error}`);
          logger.error("Product sync failed", error);

          await patchSyncMetadata({
            stageStatus: {
              products: "failed",
              inventory: "failed",
            },
          });

          return 0;
        }
      };

      // 2. Fetch Orders with full details in paginated batches and enqueue persistence jobs
      const fetchOrders = async () => {
        const startTime = Date.now();
        const persistBatchSize =
          SHOPIFY_CONFIG.SYNC?.ORDERS_PERSIST_BATCH_SIZE ?? 25;

        try {
          await patchSyncMetadata({
            stageStatus: {
              orders: "processing",
            },
          });
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
          const MIN_ORDERS_PAGE_SIZE =
            SHOPIFY_CONFIG.SYNC?.ORDERS_MIN_BATCH_SIZE ?? 25;
          const COST_BACKOFF_MS =
            SHOPIFY_CONFIG.SYNC?.ORDERS_COST_BACKOFF_MS ?? 250;
          let currentPageSize: number =
            SHOPIFY_CONFIG.QUERIES?.ORDERS_BATCH_SIZE ?? MIN_ORDERS_PAGE_SIZE;
          if (currentPageSize < MIN_ORDERS_PAGE_SIZE) {
            currentPageSize = MIN_ORDERS_PAGE_SIZE;
          }
          const sleep = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));

          const flushOrderBatch = async () => {
            if (!ordersBatch.length) return;

            const ordersPayload = [...ordersBatch];
            const transactionsPayload =
              transactionsBatch.length > 0 ? [...transactionsBatch] : undefined;
            const refundsPayload =
              refundsBatch.length > 0 ? [...refundsBatch] : undefined;
            const fulfillmentsPayload =
              fulfillmentsBatch.length > 0 ? [...fulfillmentsBatch] : undefined;

            const batchNum = batchesScheduled + 1;
            const jobId = await createJob(
              ctx,
              "sync:shopifyOrdersBatch",
              PRIORITY.HIGH,
              {
                organizationId: args.organizationId as Id<"organizations">,
                storeId,
                syncSessionId: args.syncSessionId,
                batchNumber: batchNum,
                cursor: cursor ?? undefined,
                orders: ordersPayload,
                transactions: transactionsPayload,
                refunds: refundsPayload,
                fulfillments: fulfillmentsPayload,
              }
            );

            logger.info(`Created order batch job ${batchNum}`, {
              jobId,
              batchNumber: batchNum,
              ordersCount: ordersPayload?.length || 0,
              transactionsCount: transactionsPayload?.length || 0,
            });

            if (args.syncSessionId) {
              await ctx.runMutation(
                internal.jobs.helpers.patchSyncSessionMetadata,
                {
                  sessionId: args.syncSessionId,
                  metadata: {
                    lastCursor: cursor ?? null,
                    currentPage: pageCount,
                    totalOrdersSeen,
                  },
                }
              );
            }

            batchesScheduled += 1;
            ordersQueued += ordersPayload.length;
            jobIds.push(jobId);

            ordersBatch.length = 0;
            transactionsBatch.length = 0;
            refundsBatch.length = 0;
            fulfillmentsBatch.length = 0;
          };

          while (hasNextPage) {
            logger.debug(
              `Fetching orders page ${pageCount + 1} with page size ${currentPageSize}`,
              {
                cursor,
                dateQuery,
              }
            );

            const response: any = await client.getOrders(
              currentPageSize,
              cursor,
              dateQuery
            );

            const errorSummary =
              response.errors && response.errors.length > 0
                ? summarizeGraphQLErrors(response.errors)
                : undefined;

            logger.debug("Orders API response snapshot logged", {
              hasData: !!response.data,
              hasOrders: !!response.data?.orders,
              hasEdges: !!response.data?.orders?.edges,
              edgeCount: response.data?.orders?.edges?.length || 0,
              errorSummary,
            });

            if (errorSummary) {
              logger.warn("Orders fetch GraphQL errors noted", {
                errorSummary,
                dateQuery,
              });

              const costError = response.errors.find(
                (error: { extensions?: { code?: string } }) =>
                  error.extensions?.code === "MAX_COST_EXCEEDED"
              );

              if (costError) {
                const previousPageSize = currentPageSize;
                const nextPageSize = Math.max(
                  MIN_ORDERS_PAGE_SIZE,
                  Math.floor(previousPageSize / 2)
                );

                if (nextPageSize === previousPageSize) {
                  throw new Error(
                    `Shopify orders query exceeded cost limit even at minimum page size ${MIN_ORDERS_PAGE_SIZE}`
                  );
                }

                currentPageSize = nextPageSize;
                logger.warn(
                  "Reducing orders page size due to Shopify query cost limit",
                  {
                    previousPageSize,
                    nextPageSize,
                    dateQuery,
                  }
                );
                // Retry the same cursor with the smaller page size
                await sleep(COST_BACKOFF_MS);
                continue;
              }
            }

            if (
              response.data?.orders?.edges &&
              response.data.orders.edges.length > 0
            ) {
              pageCount += 1;
              const pageOrders = response.data.orders.edges as Array<{
                node: ShopifyOrderNode;
              }>;

              totalOrdersSeen += pageOrders.length;

              if (totalOrdersSeen % 100 === 0 || pageCount === 1) {
                logger.info(
                  `🔄 Order sync progress: ${totalOrdersSeen} orders processed`,
                  {
                    organizationId: args.organizationId as Id<"organizations">,
                    pageCount,
                  }
                );
              }

              for (const edge of pageOrders) {
                const {
                  order: mappedOrder,
                  transactions,
                  refunds,
                  fulfillments,
                } = mapOrderNodeToPersistence(
                  edge.node,
                  args.organizationId as Id<"organizations">
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

          if (args.syncSessionId) {
            await ctx.runMutation(
              internal.jobs.helpers.patchSyncSessionMetadata,
              {
                sessionId: args.syncSessionId,
                metadata: {
                  lastCursor: null,
                  totalPages: pageCount,
                  totalOrdersSeen,
                },
              }
            );
          }

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

          await patchSyncMetadata({
            stageStatus: {
              orders: "failed",
            },
          });

          return {
            batchesScheduled: 0,
            ordersQueued: 0,
            jobIds: [],
            recordsProcessed: 0,
          };
        }
      };

      // 3. Fetch Customers with complete data
      const fetchCustomers = async () => {
        try {
          await patchSyncMetadata({
            stageStatus: {
              customers: "processing",
            },
          });
          logger.debug("Fetching customers with complete data", {
            timestamp: new Date().toISOString(),
          });

          const configuredMax = SHOPIFY_CONFIG.SYNC?.CUSTOMERS_MAX_RECORDS;
          const maxCustomers =
            typeof configuredMax === "number" && configuredMax > 0
              ? configuredMax
              : Number.POSITIVE_INFINITY;
          const persistBatchSize = Math.max(
            1,
            SHOPIFY_CONFIG.SYNC?.CUSTOMERS_PERSIST_BATCH_SIZE ?? 200
          );
          const pageSizeBase = Math.max(
            1,
            SHOPIFY_CONFIG.QUERIES?.CUSTOMERS_BATCH_SIZE ?? 200
          );

          let hasNextPage = true;
          let cursor: string | null = null;
          let totalPersisted = 0;
          let truncated = false;

          const pending: Array<Record<string, unknown>> = [];

          const persistCustomers = async (count: number) => {
            const batchToPersist = pending.splice(0, count);
            if (!batchToPersist.length) return;
            await ctx.runMutation(
              internal.shopify.customerMutations.storeCustomersInternal,
              {
                organizationId: args.organizationId,
                customers: batchToPersist,
              }
            );

            totalPersisted += batchToPersist.length;
          };

          const flushReadyChunks = async () => {
            while (
              pending.length >= persistBatchSize &&
              totalPersisted < maxCustomers
            ) {
              const remainingCapacity = maxCustomers - totalPersisted;
              if (remainingCapacity <= 0) {
                break;
              }

              const chunkSize = Math.min(persistBatchSize, remainingCapacity);
              await persistCustomers(chunkSize);
            }
          };

          while (hasNextPage && totalPersisted < maxCustomers) {
            const remaining = maxCustomers - totalPersisted;
            if (remaining <= 0) {
              hasNextPage = false;
              break;
            }

            const pageSize = Math.min(pageSizeBase, remaining);

            const response: any = await client.getCustomers(pageSize, cursor);

            if (response.data?.customers?.edges) {
              const batch = response.data.customers.edges.map(
                (edge: { node: { [key: string]: unknown } }) => {
                  const customer = edge.node;
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
                    taxExempt: customer.taxExempt || false,
                    defaultAddress: (customer as any).addresses?.[0]
                      ? {
                          country:
                            (customer as any).addresses[0].country || undefined,
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

              if (batch.length) {
                pending.push(...batch);
                await flushReadyChunks();
              }

              const pageInfo = response.data.customers.pageInfo;
              hasNextPage = pageInfo.hasNextPage;
              cursor = pageInfo.endCursor;

              if (totalPersisted >= maxCustomers && hasNextPage) {
                truncated = true;
                hasNextPage = false;
              }
            } else {
              hasNextPage = false;
            }
          }

          if (pending.length && totalPersisted < maxCustomers) {
            const remainingCapacity = maxCustomers - totalPersisted;
            if (remainingCapacity > 0) {
              await persistCustomers(
                Math.min(pending.length, remainingCapacity)
              );
            }
          }

          pending.length = 0;

          if (truncated) {
            logger.warn("Customer fetch truncated due to configured limit", {
              maxCustomers,
              totalPersisted,
            });
          }

          logger.info("Customers fetched with complete data", {
            count: totalPersisted,
            completedAt: new Date().toISOString(),
          });

          await patchSyncMetadata({
            stageStatus: {
              customers: "completed",
            },
            syncedEntities: ["customers"],
          });

          return totalPersisted;
        } catch (error) {
          errors.push(`Customer sync failed: ${error}`);
          logger.error("Customer sync failed", error);

          await patchSyncMetadata({
            stageStatus: {
              customers: "failed",
            },
          });

          return 0;
        }
      };

      // Execute stages sequentially: products/inventory -> customers -> orders
      logger.info("Executing staged Shopify sync", {
        stages: ["products+inventory", "customers", "orders"],
      });
      const startTime = Date.now();
      const productsCount = await fetchProducts();
      const customersCount = await fetchCustomers();
      const orderStats = await fetchOrders();
      const duration = Date.now() - startTime;

      logger.info("Staged fetch completed", { durationMs: duration });
      totalRecordsProcessed =
        productsCount + orderStats.recordsProcessed + customersCount;

      logger.info("Initial sync completed", {
        totalRecordsProcessed,
        completedAt: new Date().toISOString(),
        durationMs: duration,
      });

      try {
        await ctx.runMutation(
          (internal.shopify.storeMetadata as any).updateStoreLastSyncInternal,
          {
            storeId,
            timestamp: Date.now(),
          }
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
            recommendation:
              "Consider updating product costs in Shopify or manually setting costs in the application",
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
        internal.shopify.internalQueries.getActiveStoreInternal,
        {
          organizationId: args.organizationId,
        }
      );

      if (!store) {
        throw new Error("No active Shopify store found");
      }

      const storeId = store._id as Id<"shopifyStores">;
      const fallbackWindowMs = 6 * 60 * 60 * 1000; // 6 hours
      const sinceMs =
        args.since ?? store.lastSyncAt ?? Date.now() - fallbackWindowMs;
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
          `updated_at:>=${sinceIso}`
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
          const {
            order,
            transactions: txs,
            refunds: rfs,
            fulfillments: ffs,
          } = mapOrderNodeToPersistence(
            edge.node,
            args.organizationId as Id<"organizations">
          );

          orders.push(order);

          if (txs.length) transactions.push(...txs);
          if (rfs.length) refunds.push(...rfs);
          if (ffs.length) fulfillments.push(...ffs);
        }

        hasNextPage = response.data?.orders?.pageInfo?.hasNextPage || false;
        cursor = response.data?.orders?.pageInfo?.endCursor || null;
      }

      let analyticsEligibility: boolean | undefined;
      const ensureAnalyticsEligibility = async () => {
        if (analyticsEligibility === undefined) {
          analyticsEligibility = await ctx.runQuery(
            internal.shopify.status.getInitialSyncStatusInternal,
            {
              organizationId: args.organizationId,
            }
          );
        }

        return analyticsEligibility;
      };

      if (orders.length > 0) {
        await ctx.runMutation(
          internal.shopify.orderMutations.storeOrdersInternal,
          {
            organizationId: args.organizationId,
            storeId,
            orders,
            shouldScheduleAnalytics: await ensureAnalyticsEligibility(),
          }
        );
      }

      if (transactions.length > 0) {
        await ctx.runMutation(
          internal.shopify.orderMutations.storeTransactionsInternal,
          {
            organizationId: args.organizationId,
            transactions,
            shouldScheduleAnalytics: await ensureAnalyticsEligibility(),
          }
        );
      }

      if (refunds.length > 0) {
        await ctx.runMutation(
          internal.shopify.orderMutations.storeRefundsInternal,
          {
            organizationId: args.organizationId,
            refunds,
            shouldScheduleAnalytics: await ensureAnalyticsEligibility(),
          }
        );
      }

      if (fulfillments.length > 0) {
        await ctx.runMutation(
          internal.shopify.orderMutations.storeFulfillmentsInternal,
          {
            organizationId: args.organizationId,
            fulfillments,
          }
        );
      }

      await ctx.runMutation(
        (internal.shopify.storeMetadata as any).updateStoreLastSyncInternal,
        {
          storeId,
          timestamp: Date.now(),
        }
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
