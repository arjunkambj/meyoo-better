import { GraphQLClient } from "graphql-request";

import { SHOPIFY_CONFIG } from "./shopify.config.js";
import { createSimpleLogger } from "../logging/simple";

const logger = createSimpleLogger("ShopifyGraphQLClient");

export interface ShopifyGraphQLClientConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface ShopifyProduct {
  id: string;
  handle?: string;
  title?: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  status?: string;
  publishedAt?: string;
  templateSuffix?: string;
  tags?: string[];
  totalInventory?: number;
  variantsCount?: {
    count: number;
  };
  createdAt?: string;
  updatedAt?: string;
  featuredImage?: {
    url: string;
  };
  variants?: {
    edges: Array<{ node: ShopifyVariant }>;
    pageInfo: PageInfo;
  };
}

export interface ShopifyVariant {
  id: string;
  title?: string;
  sku?: string;
  barcode?: string;
  price?: string;
  compareAtPrice?: string;
  position?: number;
  inventoryQuantity?: number;
  taxable?: boolean;
  inventoryPolicy?: string;
  createdAt?: string;
  updatedAt?: string;
  inventoryItem?: {
    id: string;
    tracked?: boolean;
    requiresShipping?: boolean;
    unitCost?: {
      amount: string;
    };
    measurement?: {
      weight?: {
        value: number;
        unit: string;
      };
    };
  };
  selectedOptions?: Array<{
    name: string;
    value: string;
  }>;
}

export interface ShopifyCustomer {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  state?: string;
  tags?: string[];
  ordersCount?: {
    count: number;
  };
  totalSpent?: {
    amount: string;
    currencyCode: string;
  };
  defaultAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    provinceCode?: string;
    countryCodeV2?: string;
    company?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ShopifyOrder {
  id: string;
  name?: string;
  email?: string;
  currencyCode?: string;
  processedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  cancelledAt?: string;
  closedAt?: string;
  displayFinancialStatus?: string;
  displayFulfillmentStatus?: string;
  returnStatus?: string;
  totalPriceSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
  subtotalPriceSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
  totalTaxSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
  totalShippingPriceSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
  totalDiscountsSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
  totalRefundedSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
  lineItems?: {
    edges: Array<{ node: ShopifyLineItem }>;
    pageInfo: PageInfo;
  };
  fulfillments?: ShopifyFulfillment[];
  customer?: ShopifyCustomer;
  shippingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    provinceCode?: string;
    countryCodeV2?: string;
    company?: string;
  };
  billingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    country?: string;
    zip?: string;
    provinceCode?: string;
    countryCodeV2?: string;
    company?: string;
  };
  tags?: string[];
  note?: string;
  [key: string]: unknown;
}

export interface ShopifyLineItem {
  id: string;
  title?: string;
  quantity?: number;
  product?: {
    id: string;
  };
  variant?: {
    id: string;
    title?: string;
    sku?: string;
  };
  originalUnitPriceSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
  totalDiscountSet?: {
    shopMoney?: {
      amount: string;
      currencyCode: string;
    };
  };
}

export interface ShopifyFulfillment {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deliveredAt?: string;
  trackingInfo?: Array<{
    number?: string;
    url?: string;
    company?: string;
  }>;
}

export interface GraphQLResponse<T> {
  data: T;
  extensions?: {
    cost: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
      documentation?: string;
    };
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
  }>;
}

export class ShopifyGraphQLClient {
  private client: GraphQLClient;
  private readonly apiVersion: string;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly RATE_LIMIT_DELAY =
    (1000 / SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.RESTORE_RATE) * 20; // 400ms between requests
  private readonly MAX_REQUESTS_PER_SECOND = SHOPIFY_CONFIG.API.RATE_LIMIT.REST;

  constructor(config: ShopifyGraphQLClientConfig) {
    this.apiVersion = config.apiVersion || SHOPIFY_CONFIG.API.VERSION;
    const endpoint = `https://${config.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;

    this.client = new GraphQLClient(endpoint, {
      headers: {
        "X-Shopify-Access-Token": config.accessToken,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Fetch products with minimal fields to reduce query cost
   */
  async getProductsSimple(
    first: number = SHOPIFY_CONFIG.QUERIES.PRODUCTS_BATCH_SIZE,
    after?: string | null
  ) {
    const query = `
      query GetProductsSimple($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              handle
              title
              descriptionHtml
              productType
              vendor
              status
              publishedAt
              templateSuffix
              tags
              totalInventory
              variantsCount {
                count
              }
              createdAt
              updatedAt
              featuredImage {
                url
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      first,
      after,
    };

    logger.info("[ShopifyGraphQLClient] Fetching products", { first, after });

    const result = await this.makeRequest<{
      products: {
        edges: Array<{ node: ShopifyProduct }>;
        pageInfo: PageInfo;
      };
    }>(query, variables);

    if (result.errors && result.errors.length > 0) {
      logger.warn(
        "[ShopifyGraphQLClient] Products query returned with errors",
        {
          errorCount: result.errors.length,
          errors: result.errors.map((e) => ({
            message: e.message,
            code: e.extensions?.code,
            path: e.path,
          })),
        }
      );
    }

    logger.info("[ShopifyGraphQLClient] Products response", {
      productsCount: result.data?.products?.edges?.length || 0,
      hasNextPage: result.data?.products?.pageInfo?.hasNextPage,
      hasErrors: !!(result.errors && result.errors.length > 0),
    });

    return result;
  }

  /**
   * Fetch variants for a specific product
   */
  async getProductVariants(
    productId: string,
    first: number = 100,
    after?: string | null
  ) {
    const query = `
      query GetProductVariants($productId: ID!, $first: Int!, $after: String) {
        product(id: $productId) {
          id
          variants(first: $first, after: $after) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                position
                inventoryQuantity
                taxable
                inventoryPolicy
                createdAt
                updatedAt
                inventoryItem {
                  id
                  tracked
                  requiresShipping
                  unitCost {
                    amount
                  }
                  measurement {
                    weight {
                      value
                      unit
                    }
                  }
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const variables = {
      productId,
      first,
      after,
    };

    return this.makeRequest<{
      product: {
        id: string;
        variants: {
          edges: Array<{ node: ShopifyVariant }>;
          pageInfo: PageInfo;
        };
      };
    }>(query, variables);
  }

  /**
   * Fetch inventory levels for a variant
   */
  async getVariantInventoryLevels(inventoryItemId: string) {
    const query = `
      query GetInventoryLevels($inventoryItemId: ID!) {
        inventoryItem(id: $inventoryItemId) {
          id
          inventoryLevels(first: 50) {
            edges {
              node {
                available
                incoming
                committed
                location {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      inventoryItemId,
    };

    return this.makeRequest<{
      inventoryItem: {
        id: string;
        inventoryLevels: {
          edges: Array<{
            node: {
              available?: number | null;
              incoming?: number | null;
              committed?: number | null;
              location?: {
                id?: string | null;
                name?: string | null;
              } | null;
            };
          }>;
        };
      };
    }>(query, variables);
  }

  /**
   * Fetch products with all available fields
   */
  async getProducts(first: number = 250, after?: string | null) {
    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              handle
              title
              descriptionHtml
              productType
              vendor
              status
              publishedAt
              templateSuffix
              tags
              totalInventory
              variantsCount {
                count
              }
              createdAt
              updatedAt
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              compareAtPriceRange {
                minVariantCompareAtPrice {
                  amount
                  currencyCode
                }
                maxVariantCompareAtPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 25) {
                edges {
                  node {
                    id
                    title
                    sku
                    barcode
                    price
                    compareAtPrice
                    position
                    inventoryQuantity
                    availableForSale
                    taxable
                    inventoryPolicy
                    createdAt
                    updatedAt
                    inventoryItem {
                      id
                      tracked
                      requiresShipping
                      unitCost {
                        amount
                      }
                      measurement {
                        weight {
                          value
                          unit
                        }
                      }
                    }
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      first,
      after,
    };

    return this.makeRequest<{
      products: {
        edges: Array<{ node: ShopifyProduct }>;
        pageInfo: PageInfo;
      };
    }>(query, variables);
  }

  /**
   * Fetch orders with basic fields to reduce query cost
   */
  async getOrdersSimple(
    first: number = SHOPIFY_CONFIG.QUERIES.ORDERS_BATCH_SIZE,
    after?: string | null,
    query?: string
  ) {
    const graphqlQuery = `
      query GetOrdersSimple($first: Int!, $after: String, $query: String) {
        orders(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              name
              email
              phone
              createdAt
              updatedAt
              processedAt
              closedAt
              cancelledAt
              displayFinancialStatus
              displayFulfillmentStatus
              cancelReason
              currentTotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              currentSubtotalPriceSet {
                shopMoney {
                  amount
                }
              }
              currentTotalTaxSet {
                shopMoney {
                  amount
                }
              }
              currentTotalDiscountsSet {
                shopMoney {
                  amount
                }
              }
              totalShippingPriceSet {
                shopMoney {
                  amount
                }
              }
              totalTipReceivedSet {
                shopMoney {
                  amount
                }
              }
              totalWeight
              subtotalLineItemsQuantity
              tags
              note
              customerJourneySummary {
                firstVisit {
                  landingPage
                  referrerUrl
                  source
                  utmParameters {
                    source
                    medium
                    campaign
                  }
                }
              }
              shippingAddress {
                country
                provinceCode
                city
                zip
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      first,
      after,
      query,
    };

    return this.makeRequest<{
      orders: {
        edges: Array<{ node: ShopifyProduct }>;
        pageInfo: PageInfo;
      };
    }>(graphqlQuery, variables);
  }

  /**
   * Get customers with optional filtering
   */
  async getCustomers(
    first: number = 50,
    after: string | null = null,
    query?: string
  ) {
    const graphqlQuery = `
      query GetCustomers($first: Int!, $after: String, $query: String) {
        customers(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              email
              phone
              firstName
              lastName
              state
              verifiedEmail
              taxExempt
              tags
              note
              createdAt
              updatedAt
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              addresses {
                country
                provinceCode
                city
                zip
                address1
                address2
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      first,
      after,
      query,
    };

    const result = await this.makeRequest<{
      customers: {
        edges: Array<{ node: ShopifyProduct }>;
        pageInfo: PageInfo;
      };
    }>(graphqlQuery, variables);

    if (result.errors && result.errors.length > 0) {
      logger.warn(
        "[ShopifyGraphQLClient] Customers query returned with errors",
        {
          errorCount: result.errors.length,
          errors: result.errors.map((e) => ({
            message: e.message,
            code: e.extensions?.code,
            path: e.path,
            locations: e.locations,
          })),
        }
      );
    }

    logger.info("[ShopifyGraphQLClient] Customers response", {
      customersCount: result.data?.customers?.edges?.length || 0,
      hasNextPage: result.data?.customers?.pageInfo?.hasNextPage,
      hasErrors: !!(result.errors && result.errors.length > 0),
    });

    return result;
  }

  /**
   * Fetch order details including line items and customer
   */
  async getOrderDetails(orderId: string) {
    const graphqlQuery = `
      query GetOrderDetails($orderId: ID!) {
        order(id: $orderId) {
          id
          customer {
            id
            email
            firstName
            lastName
            phone
            taxExempt
            verifiedEmail
            createdAt
            updatedAt
            numberOfOrders
            amountSpent {
              amount
              currencyCode
            }
            defaultAddress {
              country
              provinceCode
              city
            }
            tags
            note
            state
          }
          lineItems(first: 250) {
            edges {
              node {
                id
                title
                name
                quantity
                sku
                variant {
                  id
                  product {
                    id
                  }
                }
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                fulfillableQuantity
                fulfillmentStatus
                customAttributes {
                  key
                  value
                }
              }
            }
          }
          risks {
            level
            message
          }
        }
      }
    `;

    const variables = {
      orderId,
    };

    return this.makeRequest<{
      order: ShopifyOrder;
    }>(graphqlQuery, variables);
  }

  /**
   * Fetch orders with all available fields (optimized for query cost)
   */
  async getOrders(first: number = 50, after?: string | null, query?: string) {
    const graphqlQuery = `
      query GetOrders($first: Int!, $after: String, $query: String) {
        orders(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              name
              email
              phone
              createdAt
              updatedAt
              processedAt
              closedAt
              cancelledAt
              displayFinancialStatus
              displayFulfillmentStatus
              cancelReason
              currentTotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              currentSubtotalPriceSet {
                shopMoney {
                  amount
                }
              }
              currentTotalTaxSet {
                shopMoney {
                  amount
                }
              }
              currentTotalDiscountsSet {
                shopMoney {
                  amount
                }
              }
              totalShippingPriceSet {
                shopMoney {
                  amount
                }
              }
              totalTipReceivedSet {
                shopMoney {
                  amount
                }
              }
              totalWeight
              subtotalLineItemsQuantity
              tags
              note
              shippingAddress {
                country
                provinceCode
                city
                zip
              }
              customerJourneySummary {
                firstVisit {
                  landingPage
                  referrerUrl
                  source
                  utmParameters {
                    source
                    medium
                    campaign
                  }
                }
              }
              customer {
                id
                email
                firstName
                lastName
                phone
                taxExempt
                verifiedEmail
                createdAt
                updatedAt
                numberOfOrders
                amountSpent {
                  amount
                  currencyCode
                }
                defaultAddress {
                  country
                  provinceCode
                  city
                }
                tags
                note
                state
              }
              lineItems(first: 25) {
                edges {
                  node {
                    id
                    title
                    name
                    quantity
                    sku
                    variant {
                      id
                      product {
                        id
                      }
                    }
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    discountedUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    fulfillableQuantity
                    fulfillmentStatus
                  }
                }
              }
              transactions(first: 10) {
                id
                kind
                status
                gateway
                amountSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                fees {
                  amount {
                    amount
                    currencyCode
                  }
                  type
                }
                paymentId
                createdAt
                processedAt
              }
              refunds(first: 5) {
                id
                note
                createdAt
                totalRefundedSet {
                  shopMoney {
                    amount
                  }
                }
                refundLineItems(first: 10) {
                  edges {
                    node {
                      lineItem {
                        id
                      }
                      quantity
                      subtotalSet {
                        shopMoney {
                          amount
                        }
                      }
                    }
                  }
                }
              }
              fulfillments(first: 10) {
                id
                status
                trackingInfo {
                  company
                  number
                  url
                }
                location {
                  id
                }
                service {
                  serviceName
                }
                createdAt
                updatedAt
                fulfillmentLineItems(first: 25) {
                  edges {
                    node {
                      id
                      quantity
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      first,
      after,
      query,
    };

    logger.info("[ShopifyGraphQLClient] Fetching orders", {
      first,
      after,
      queryFilter: query,
    });

    const result = await this.makeRequest<{
      orders: {
        edges: Array<{ node: ShopifyOrder }>;
        pageInfo: PageInfo;
      };
    }>(graphqlQuery, variables);

    if (result.errors && result.errors.length > 0) {
      logger.warn("[ShopifyGraphQLClient] Orders query returned with errors", {
        errorCount: result.errors.length,
        errors: result.errors.map((e) => ({
          message: e.message,
          code: e.extensions?.code,
          path: e.path,
        })),
      });
    }

    logger.info("[ShopifyGraphQLClient] Orders response", {
      ordersCount: result.data?.orders?.edges?.length || 0,
      hasNextPage: result.data?.orders?.pageInfo?.hasNextPage,
      hasErrors: !!(result.errors && result.errors.length > 0),
    });

    return result;
  }

  /**
   * Make GraphQL request with error handling and rate limiting
   */
  private async makeRequest<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    // Implement rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Track requests per second
    if (timeSinceLastRequest < 1000) {
      this.requestCount++;
      if (this.requestCount >= this.MAX_REQUESTS_PER_SECOND) {
        const delay = 1000 - timeSinceLastRequest;

        await new Promise((resolve) => setTimeout(resolve, delay));
        this.requestCount = 0;
      }
    } else {
      this.requestCount = 0;
    }

    this.lastRequestTime = Date.now();

    try {
      const response = await this.client.request<T>(query, variables);

      // Log successful responses for products queries during debugging
      if (query.includes("products") && query.includes("first")) {
        logger.debug("[ShopifyGraphQLClient] Products query response", {
          hasData: !!response,
          dataKeys: response ? Object.keys(response) : [],
          querySnippet: query.substring(0, 100),
        });
      }

      return { data: response };
    } catch (error) {
      // Handle GraphQL errors
      const graphQLError = error as {
        response?: {
          errors?: Array<{ message: string }>;
          extensions?: unknown;
          data?: T;
        };
        message?: string;
        code?: string;
      };

      if (graphQLError.response) {
        const { errors, extensions, data } = graphQLError.response as {
          errors?: Array<{
            message: string;
            extensions?: { code?: string };
            path?: string[];
            locations?: Array<{ line: number; column: number }>;
          }>;
          extensions?: unknown;
          data?: T;
        };

        // Log GraphQL errors
        if (errors && errors.length > 0) {
          logger.error("[ShopifyGraphQLClient] GraphQL errors", {
            errors,
            extensions,
            query: query.substring(0, 200),
            variables,
          });
        }

        // Check for rate limiting
        const costExtensions = extensions as unknown as {
          cost?: {
            throttleStatus?: {
              currentlyAvailable?: number;
              restoreRate?: number;
            };
          };
        };

        if (
          costExtensions?.cost?.throttleStatus?.currentlyAvailable !==
            undefined &&
          costExtensions.cost.throttleStatus.currentlyAvailable <= 0
        ) {
          // Calculate wait time based on restore rate
          const restoreRate =
            costExtensions.cost.throttleStatus.restoreRate || 50;
          const waitTime = Math.ceil(1000 / restoreRate) * 2; // Double for safety

          logger.info(
            `[ShopifyGraphQLClient] Rate limited. Waiting ${waitTime}ms before retry...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));

          // Retry the request
          return this.makeRequest<T>(query, variables);
        }

        // Return with errors for proper handling upstream
        return {
          data: (data ?? ({} as T)) as T,
          errors: (errors as Array<{
            message: string;
            extensions?: { code?: string };
            path?: string[];
            locations?: Array<{ line: number; column: number }>;
          }>) || [
            {
              message: graphQLError.message || "Unknown error",
              extensions: { code: "UNKNOWN" },
            },
          ],
          extensions: extensions as GraphQLResponse<T>["extensions"],
        } as GraphQLResponse<T>;
      }

      // Log network errors
      logger.error("[ShopifyGraphQLClient] Network/Request error", {
        message: graphQLError.message,
        code: graphQLError.code,
        query: query.substring(0, 200),
        variables,
      });

      // Network or other errors
      throw new ShopifyAPIError(
        graphQLError.message || "Unknown error occurred",
        "NETWORK_ERROR",
        graphQLError
      );
    }
  }

  /**
   * Fetch inventory levels for multiple inventory items
   * Used separately from products query to reduce query cost
   */
  async getInventoryLevels(inventoryItemIds: string[]) {
    if (inventoryItemIds.length === 0) {
      return { data: { nodes: [] } };
    }

    const query = `
      query GetInventoryLevels($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on InventoryItem {
            id
            inventoryLevels(first: 10) {
              edges {
                node {
                  available
                  incoming
                  committed
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.makeRequest<{
      nodes: Array<{
        id: string;
        inventoryLevels: {
          edges: Array<{
            node: {
              available?: number | null;
              incoming?: number | null;
              committed?: number | null;
              location?: {
                id?: string | null;
                name?: string | null;
              } | null;
            };
          }>;
        };
      }>;
    }>(query, { ids: inventoryItemIds });
  }

  /**
   * Fetch Shopify analytics report data (sessions, visitors, etc.)
   */
  async getAnalyticsSessions(startDate: string, endDate: string) {
    const query = `
      query getAnalytics($startDate: DateTime!, $endDate: DateTime!) {
        shop {
          shopifyAnalytics {
            report(
              query: {
                name: "sessions_over_time"
                dimensions: ["date", "referrer_source"]
                metrics: [
                  "sessions"
                  "visitors"
                  "page_views"
                  "bounce_rate"
                  "conversion_rate"
                ]
                filters: [
                  { key: "date", operator: ">=", value: $startDate }
                  { key: "date", operator: "<=", value: $endDate }
                ]
              }
            ) {
              tableData {
                columns {
                  name
                }
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

    const startIso = new Date(`${startDate}T00:00:00Z`).toISOString();
    const endIso = new Date(`${endDate}T23:59:59Z`).toISOString();

    const variables = {
      startDate: startIso,
      endDate: endIso,
    };

    return this.makeRequest<{
      shop?: {
        shopifyAnalytics?: {
          report?: {
            tableData?: {
              columns?: Array<{ name: string }>;
              rows?: Array<{
                cells?: Array<{ value?: string | null }>;
              }>;
            };
          };
        };
      };
    }>(query, variables);
  }

  /**
   * Fetch orders with attribution data for session tracking
   */
  async fetchOrdersWithAttribution(startDate: string, endDate: string) {
    const query = `
      query GetOrdersWithAttribution($startDate: DateTime!, $endDate: DateTime!) {
        orders(first: 250, query: "created_at:>=$startDate AND created_at:<=$endDate") {
          edges {
            node {
              id
              createdAt
              totalPriceSet {
                presentmentMoney {
                  amount
                  currencyCode
                }
              }
              customerJourneySummary {
                momentsCount
                firstVisit {
                  id
                  occurredAt
                  landingPage
                  referrerInfo {
                    source
                    domain
                  }
                  utmParameters {
                    source
                    medium
                    campaign
                    content
                    term
                  }
                  device {
                    type
                    browser
                    operatingSystem
                  }
                }
                lastVisit {
                  occurredAt
                  landingPage
                }
              }
              billingAddress {
                country
                province
                city
              }
              sourceUrl
              landingSite
              utmSource
              utmMedium
              utmCampaign
            }
          }
        }
      }
    `;

    const response = await this.makeRequest<{
      orders: {
        edges: Array<{
          node: ShopifyOrder;
        }>;
      };
    }>(query, { startDate, endDate });

    return response.data.orders.edges.map((edge) => edge.node);
  }

  /**
   * Get store info
   */
  async getShopInfo() {
    const query = `
      query GetShopInfo {
        shop {
          id
          name
          email
          currencyCode
          primaryDomain {
            url
          }
          billingAddress {
            country
            province
            city
          }
          timezoneAbbreviation
          timezoneOffset
          timezoneOffsetMinutes
          paymentSettings {
            supportedDigitalWallets
          }
        }
      }
    `;

    return this.makeRequest<{
      shop: {
        id: string;
        name: string;
        email: string;
        currencyCode: string;
        primaryDomain: { url: string };
        billingAddress: {
          country: string;
          province: string;
          city: string;
        };
        timezoneAbbreviation: string;
        timezoneOffset: string;
        timezoneOffsetMinutes?: number;
        paymentSettings?: {
          supportedDigitalWallets: string[];
        };
      };
    }>(query);
  }
}

export class ShopifyAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ShopifyAPIError";
  }
}
