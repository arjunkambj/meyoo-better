import { GraphQLClient } from "graphql-request";

import { SHOPIFY_CONFIG } from "./shopify.config.js";
import { createSimpleLogger } from "../logging/simple";

const logger = createSimpleLogger("ShopifyGraphQLClient");

type ShopifyGraphQLError = {
  message: string;
  extensions?: { code?: string; [key: string]: unknown };
  path?: ReadonlyArray<string | number>;
};

const MAX_ERROR_SUMMARY_ITEMS = 3;

const shortenText = (input: string, maxWords: number) => {
  if (!input) return input;
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }
  return words.slice(0, maxWords).join(" ");
};

const summarizeGraphQLErrors = (errors: ReadonlyArray<ShopifyGraphQLError>) => {
  const byCode = new Map<string, number>();
  for (const error of errors) {
    const code = error.extensions?.code || "UNKNOWN";
    byCode.set(code, (byCode.get(code) ?? 0) + 1);
  }

  const sampleMessages: string[] = [];
  const samplePaths: string[] = [];

  for (const error of errors) {
    if (sampleMessages.length < MAX_ERROR_SUMMARY_ITEMS && error.message) {
      const [firstLine] = error.message.split("\n");
      const sample = firstLine ?? error.message;
      if (sample) {
        sampleMessages.push(shortenText(sample, 10));
      }
    }
    if (samplePaths.length < MAX_ERROR_SUMMARY_ITEMS && error.path?.length) {
      samplePaths.push(error.path.join("."));
    }
    if (
      sampleMessages.length >= MAX_ERROR_SUMMARY_ITEMS &&
      samplePaths.length >= MAX_ERROR_SUMMARY_ITEMS
    ) {
      break;
    }
  }

  return {
    count: errors.length,
    codes: Array.from(byCode.entries()).map(([code, occurrences]) => ({
      code,
      occurrences,
    })),
    sampleMessages,
    samplePaths,
  };
};

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
  fulfillmentOrders?: {
    edges?: Array<{ node: ShopifyFulfillmentOrder }>;
  };
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
  shipmentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  deliveredAt?: string;
  location?: {
    id?: string | null;
  } | null;
  service?: {
    serviceName?: string | null;
  } | null;
  trackingInfo?: Array<{
    number?: string;
    url?: string;
    company?: string;
  }>;
  fulfillmentLineItems?: {
    edges?: Array<{
      node: {
        id?: string;
        quantity?: number;
        lineItem?: {
          id?: string | null;
        } | null;
      };
    }>;
  };
}

export interface ShopifyFulfillmentOrder {
  id: string;
  status?: string;
  assignedLocation?: {
    location?: {
      id?: string | null;
    } | null;
  } | null;
  deliveryMethod?: {
    methodType?: string | null;
    serviceName?: string | null;
  } | null;
  lineItems?: {
    edges?: Array<{
      node?: {
        id?: string | null;
        lineItem?: {
          id?: string | null;
        } | null;
      } | null;
    }>;
  };
}

export interface GraphQLResponse<T> {
  data: T;
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      actualQueryCost?: number;
      throttleStatus?: {
        maximumAvailable?: number;
        currentlyAvailable?: number;
        restoreRate?: number;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  errors?: ReadonlyArray<{
    message: string;
    extensions?: {
      code?: string;
      documentation?: string;
      [key: string]: unknown;
    };
    locations?: ReadonlyArray<{
      line: number;
      column: number;
    }>;
    path?: ReadonlyArray<string | number>;
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
  private readonly MAX_GRAPHQL_RETRIES =
    SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.MAX_RETRIES ?? 5;
  private readonly BASE_THROTTLE_DELAY =
    SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.THROTTLE_BACKOFF_MS ??
    Math.ceil(1000 / SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.RESTORE_RATE) * 2;
  private readonly BACKOFF_MULTIPLIER =
    SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.BACKOFF_MULTIPLIER ?? 2;
  private readonly MAX_THROTTLE_DELAY =
    SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.MAX_BACKOFF_MS ?? 12000;
  private readonly SAFETY_BUFFER =
    SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.SAFETY_BUFFER ?? 200;

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

    logger.info("Fetching Shopify products right now", { first, after });

    const result = await this.makeRequest<{
      products: {
        edges: Array<{ node: ShopifyProduct }>;
        pageInfo: PageInfo;
      };
    }>(query, variables);

    if (result.errors && result.errors.length > 0) {
      logger.warn(
        "Products query errors detected now",
        summarizeGraphQLErrors(result.errors),
      );
    }

    logger.info("Products response summary ready now", {
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
  async getProducts(
    first: number = 250,
    after?: string | null,
    filter?: string,
  ) {
    const graphqlQuery = `
      query GetProducts($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query) {
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
      query: filter,
    };

    return this.makeRequest<{
      products: {
        edges: Array<{ node: ShopifyProduct }>;
        pageInfo: PageInfo;
      };
    }>(graphqlQuery, variables);
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
        "Customer query errors detected now",
        summarizeGraphQLErrors(result.errors),
      );
    }

    logger.info("Customers response summary ready now", {
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
                  sku
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
                totalDiscountSet {
                  shopMoney {
                    amount
                  }
                }
                fulfillableQuantity
                fulfillmentStatus
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
                      sku
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
                    totalDiscountSet {
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
                createdAt
                updatedAt
                fulfillmentLineItems(first: 25) {
                  edges {
                    node {
                      id
                      quantity
                      lineItem {
                        id
                      }
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

    logger.info("Fetching Shopify orders right now", {
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
      logger.warn(
        "Orders query errors detected now",
        summarizeGraphQLErrors(result.errors),
      );
    }

    logger.info("Orders response summary ready now", {
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
    variables?: Record<string, unknown>,
    attempt = 0
  ): Promise<GraphQLResponse<T>> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      await this.delay(delay);
    }

    if (timeSinceLastRequest < 1000) {
      this.requestCount++;
      if (this.requestCount >= this.MAX_REQUESTS_PER_SECOND) {
        const delay = 1000 - timeSinceLastRequest;
        await this.delay(delay);
        this.requestCount = 0;
      }
    } else {
      this.requestCount = 0;
    }

    this.lastRequestTime = Date.now();

    try {
      const rawResponse = await this.client.rawRequest<T>(query, variables);
      const throttleStatus = this.extractThrottleStatus(rawResponse.extensions);
      await this.applyThrottleBuffer(throttleStatus);

      if (query.includes("products") && query.includes("first")) {
        logger.debug("Products query raw response logged", {
          hasData: !!rawResponse.data,
          dataKeys: rawResponse.data ? Object.keys(rawResponse.data) : [],
          querySnippet: query.substring(0, 100),
        });
      }

      return {
        data: rawResponse.data,
        extensions: rawResponse.extensions as GraphQLResponse<T>["extensions"],
        errors: rawResponse.errors as GraphQLResponse<T>["errors"],
      };
    } catch (error) {
      const graphQLError = error as {
        response?: {
          errors?: Array<{
            message: string;
            extensions?: { code?: string };
            path?: string[];
            locations?: Array<{ line: number; column: number }>;
          }>;
          extensions?: unknown;
          data?: T;
        };
        message?: string;
        code?: string;
      };

      if (graphQLError.response) {
        const { errors, extensions, data } = graphQLError.response;
        const throttleStatus = this.extractThrottleStatus(extensions);

        const throttleError = errors?.find(
          (err) =>
            err.extensions?.code === "THROTTLED" ||
            /throttled/i.test(err.message ?? ""),
        );

        const shouldRetryThrottle =
          (throttleError ||
            (throttleStatus &&
              throttleStatus.currentlyAvailable !== undefined &&
              throttleStatus.currentlyAvailable <= 0)) &&
          attempt < this.MAX_GRAPHQL_RETRIES;

        if (shouldRetryThrottle) {
          const waitTime = this.calculateThrottleDelay(throttleStatus, attempt);
          logger.warn(`GraphQL throttled attempt retry ${attempt + 1}`, {
            waitMs: waitTime,
            maxRetries: this.MAX_GRAPHQL_RETRIES,
            code: throttleError?.extensions?.code,
          });
          await this.delay(waitTime);
          return this.makeRequest<T>(query, variables, attempt + 1);
        }

        if (throttleError) {
          throw new ShopifyAPIError(
            "Shopify GraphQL request throttled",
            "THROTTLED",
            {
              attempts: attempt + 1,
              errors,
              extensions,
            },
          );
        }

        if (errors && errors.length > 0) {
          logger.error("GraphQL errors during request detected", {
            summary: summarizeGraphQLErrors(errors),
            querySnippet: query.substring(0, 120),
          });
        }

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

      logger.error("Network request error detected now", {
        message: graphQLError.message,
        code: graphQLError.code,
        querySnippet: query.substring(0, 120),
      });

      throw new ShopifyAPIError(
        graphQLError.message || "Unknown error occurred",
        "NETWORK_ERROR",
        graphQLError,
      );
    }
  }

  private extractThrottleStatus(
    extensions: unknown,
  ): {
    currentlyAvailable?: number;
    restoreRate?: number;
    maximumAvailable?: number;
  } | null {
    if (!extensions || typeof extensions !== "object") return null;
    const cost = (extensions as any).cost;
    if (!cost || typeof cost !== "object") return null;
    const throttleStatus = cost.throttleStatus;
    if (!throttleStatus || typeof throttleStatus !== "object") return null;
    return throttleStatus as {
      currentlyAvailable?: number;
      restoreRate?: number;
      maximumAvailable?: number;
    };
  }

  private calculateThrottleDelay(
    throttleStatus: {
      currentlyAvailable?: number;
      restoreRate?: number;
      maximumAvailable?: number;
    } | null,
    attempt: number,
  ): number {
    const multiplier = Math.max(1, this.BACKOFF_MULTIPLIER);
    const attemptDelay = Math.min(
      this.BASE_THROTTLE_DELAY * Math.pow(multiplier, attempt),
      this.MAX_THROTTLE_DELAY,
    );

    if (!throttleStatus) {
      return attemptDelay;
    }

    const restoreRate = throttleStatus.restoreRate ||
      SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.RESTORE_RATE;
    const currentlyAvailable = throttleStatus.currentlyAvailable ?? 0;

    if (!restoreRate) {
      return attemptDelay;
    }

    const deficit = Math.max(0, this.SAFETY_BUFFER - currentlyAvailable);
    const computedDelay = deficit > 0
      ? Math.ceil(deficit / restoreRate) * 1000
      : 0;

    const delay = Math.max(attemptDelay, computedDelay);
    const jitter = 0.9 + Math.random() * 0.2;
    return Math.min(Math.round(delay * jitter), this.MAX_THROTTLE_DELAY);
  }

  private async applyThrottleBuffer(
    throttleStatus: {
      currentlyAvailable?: number;
      restoreRate?: number;
      maximumAvailable?: number;
    } | null,
  ): Promise<void> {
    if (!throttleStatus) return;

    const currentlyAvailable = throttleStatus.currentlyAvailable ?? 0;
    if (currentlyAvailable >= this.SAFETY_BUFFER) return;

    const restoreRate = throttleStatus.restoreRate ||
      SHOPIFY_CONFIG.API.RATE_LIMIT.GRAPHQL.RESTORE_RATE;
    if (!restoreRate) return;

    const deficit = this.SAFETY_BUFFER - currentlyAvailable;
    const waitTime = Math.min(
      Math.ceil(deficit / restoreRate) * 1000,
      this.MAX_THROTTLE_DELAY,
    );

    if (waitTime > 0) {
      logger.debug("Cooling down after response now", {
        waitTime,
        currentlyAvailable,
      });
      await this.delay(waitTime);
    }
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
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
