import type {
  AnalyticsOrder,
  AnalyticsSourceData,
  AnalyticsSourceResponse,
  OrdersAnalyticsExportRow,
  OrdersAnalyticsResult,
  OrdersFulfillmentMetrics,
  OrdersOverviewMetrics,
} from '@repo/types';

import type { AnyRecord } from './shared';
import {
  ensureDataset,
  percentageChange,
  safeNumber,
  toStringId,
} from './shared';

export interface OrdersAnalyticsOptions {
  status?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

function normaliseStatus(status?: string | null): string {
  return (status || "").toString().trim().toLowerCase();
}

function isFulfilledStatus(status?: string | null): boolean {
  const normalized = normaliseStatus(status);
  if (!normalized || normalized.includes("unfulfilled")) {
    return false;
  }

  if (
    normalized.includes("fulfilled") ||
    normalized.includes("delivered") ||
    normalized.includes("complete")
  ) {
    return true;
  }

  return false;
}

function isPartialStatus(status?: string | null): boolean {
  const normalized = normaliseStatus(status);
  return normalized.startsWith("partial");
}

function matchesStatus(order: AnalyticsOrder, status?: string): boolean {
  if (!status || status === "all") return true;
  const normalized = status.toLowerCase();
  const fulfillment = normaliseStatus(order.fulfillmentStatus);
  const financial = normaliseStatus(order.financialStatus);
  const overall = normaliseStatus(order.status);

  switch (normalized) {
    case "unfulfilled":
      return fulfillment === "" || fulfillment === "unfulfilled";
    case "partial":
      return isPartialStatus(order.fulfillmentStatus) || isPartialStatus(order.status);
    case "fulfilled":
      return isFulfilledStatus(order.fulfillmentStatus) || isFulfilledStatus(order.status);
    case "cancelled":
      return overall.includes("cancel") || financial.includes("void");
    case "refunded":
      return financial.includes("refund");
    default:
      return true;
  }
}

function matchesSearch(order: AnalyticsOrder, term?: string): boolean {
  if (!term) return true;
  const value = term.trim().toLowerCase();
  if (!value) return true;
  return (
    order.orderNumber.toLowerCase().includes(value) ||
    order.customer.name.toLowerCase().includes(value) ||
    order.customer.email.toLowerCase().includes(value)
  );
}

function sortOrders(
  orders: AnalyticsOrder[],
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): AnalyticsOrder[] {
  if (!sortBy) {
    return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const modifier = sortOrder === "asc" ? 1 : -1;

  return [...orders].sort((a, b) => {
    switch (sortBy) {
      case "revenue":
        return (a.totalPrice - b.totalPrice) * modifier;
      case "profit":
        return (a.profit - b.profit) * modifier;
      case "orders":
        return (a.items - b.items) * modifier;
      case "status":
        return a.status.localeCompare(b.status) * modifier;
      default:
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ) * modifier;
    }
  });
}

function deriveOrderDocuments(data: AnalyticsSourceData<any>): {
  orders: AnyRecord[];
  orderItems: AnyRecord[];
  transactions: AnyRecord[];
  refunds: AnyRecord[];
  variantCosts: AnyRecord[];
  variants: AnyRecord[];
} {
  return {
    orders: (data.orders || []) as AnyRecord[],
    orderItems: (data.orderItems || []) as AnyRecord[],
    transactions: (data.transactions || []) as AnyRecord[],
    refunds: (data.refunds || []) as AnyRecord[],
    variantCosts: (data.variantCosts || []) as AnyRecord[],
    variants: (data.variants || []) as AnyRecord[],
  };
}

type DerivedOrders = {
  orders: AnalyticsOrder[];
  refundedOrderIds: Set<string>;
};

function deriveAnalyticsOrders(data: AnalyticsSourceData<any>): DerivedOrders {
  const { orders, orderItems, transactions, refunds, variantCosts, variants } =
    deriveOrderDocuments(data);

  const normalizeStatusCandidate = (value: unknown): string => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
  };

  const toStatusSlug = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const resolveFulfillmentStatus = (orderRaw: AnyRecord): string => {
    const directCandidates: Array<unknown> = [
      orderRaw.fulfillmentStatus,
      orderRaw.displayFulfillmentStatus,
      orderRaw.display_fulfillment_status,
      orderRaw.fulfillment_status,
      orderRaw.status,
    ];

    for (const candidate of directCandidates) {
      const normalized = normalizeStatusCandidate(candidate);
      if (normalized) {
        return normalized;
      }
    }

    const collectStatuses = (records: AnyRecord[] | undefined): string[] => {
      if (!Array.isArray(records)) return [];
      return records
        .map((entry) =>
          normalizeStatusCandidate(
            entry.status ??
              entry.displayStatus ??
              entry.display_status ??
              entry.state ??
              entry.fulfillmentStatus ??
              entry.fulfillment_status,
          ),
        )
        .filter((status): status is string => Boolean(status));
    };

    const flattenEdgeStatuses = (edgeContainer: AnyRecord | undefined): string[] => {
      if (!edgeContainer || typeof edgeContainer !== "object") return [];
      const edges = (edgeContainer as AnyRecord).edges;
      if (!Array.isArray(edges)) return [];
      return edges
        .map((edge) => {
          if (!edge || typeof edge !== "object") return "";
          const node = (edge as AnyRecord).node;
          if (!node || typeof node !== "object") return "";
          return normalizeStatusCandidate(
            (node as AnyRecord).status ??
              (node as AnyRecord).displayStatus ??
              (node as AnyRecord).display_status ??
              (node as AnyRecord).state ??
              (node as AnyRecord).fulfillmentStatus ??
              (node as AnyRecord).fulfillment_status,
          );
        })
        .filter((status): status is string => Boolean(status));
    };

    const statusBuckets: string[] = [];

    statusBuckets.push(
      ...collectStatuses(orderRaw.fulfillments as AnyRecord[] | undefined),
      ...collectStatuses(orderRaw.fulfillmentOrders as AnyRecord[] | undefined),
      ...collectStatuses(orderRaw.fulfillment_orders as AnyRecord[] | undefined),
      ...flattenEdgeStatuses(orderRaw.fulfillments as AnyRecord | undefined),
      ...flattenEdgeStatuses(orderRaw.fulfillmentOrders as AnyRecord | undefined),
      ...flattenEdgeStatuses(orderRaw.fulfillment_orders as AnyRecord | undefined),
    );

    if (!statusBuckets.length && Array.isArray(orderRaw.lineItems)) {
      statusBuckets.push(
        ...collectStatuses(orderRaw.lineItems as AnyRecord[]),
      );
    }

    const slugs = statusBuckets.map(toStatusSlug).filter(Boolean);
    if (!slugs.length) {
      return "";
    }

    const has = (match: string) => slugs.some((slug) => slug.includes(match));
    const all = (match: string) => slugs.every((slug) => slug.includes(match));

    if (all("fulfilled") || (has("success") && !has("open") && !has("pending"))) {
      return "fulfilled";
    }

    if (has("cancel")) {
      return "cancelled";
    }

    if (has("partial") || has("partially_fulfilled")) {
      return "partially_fulfilled";
    }

    if (has("out_for_delivery")) {
      return "out_for_delivery";
    }

    if (has("in_transit")) {
      return "in_transit";
    }

    if (has("ready_for_pickup")) {
      return "ready_for_pickup";
    }

    if (has("label_printed")) {
      return "label_printed";
    }

    if (has("label_purchased")) {
      return "label_purchased";
    }

    if (has("pending")) {
      return "pending";
    }

    if (has("scheduled")) {
      return "scheduled";
    }

    if (has("on_hold")) {
      return "on_hold";
    }

    if (has("shipped")) {
      return "shipped";
    }

    if (has("delivered")) {
      return "delivered";
    }

    if (has("returned")) {
      return "returned";
    }

    if (has("not_delivered")) {
      return "not_delivered";
    }

    if (has("unfulfilled")) {
      return "unfulfilled";
    }

    return statusBuckets[0] ?? "";
  };

  const toRecord = (value: unknown): AnyRecord | null =>
    value && typeof value === "object" ? (value as AnyRecord) : null;

  const resolveShippingCost = (orderRaw: AnyRecord): number => {
    let fallback: number | null = null;
    let primary: number | null = null;

    const consider = (value: unknown) => {
      if (value === undefined || value === null) {
        return;
      }
      const resolved = safeNumber(value);
      if (fallback === null) {
        fallback = resolved;
      }
      if (primary === null && resolved !== 0) {
        primary = resolved;
      }
    };

    consider(orderRaw.shippingCosts);
    consider(orderRaw.totalShippingCost);
    consider(orderRaw.totalShipping);
    consider(orderRaw.shippingCost);
    consider(orderRaw.shipping_cost);
    consider(orderRaw.shippingTotal);
    consider(orderRaw.total_shipping);
    consider(orderRaw.totalShippingPrice);
    consider(orderRaw.totalShippingAmount);
    consider(orderRaw.totalShippingAmountSet);

    const totalsRecord = toRecord(orderRaw.totals);
    if (totalsRecord) {
      consider(totalsRecord.shipping);
      consider(totalsRecord.shippingPrice);
      consider(totalsRecord.shipping_price);
    }

    const totalShippingPriceSet =
      toRecord(orderRaw.total_shipping_price_set) ??
      toRecord(orderRaw.totalShippingPriceSet);
    if (totalShippingPriceSet) {
      const shopMoney =
        toRecord(totalShippingPriceSet.shop_money) ??
        toRecord(totalShippingPriceSet.shopMoney);
      if (shopMoney) {
        consider(shopMoney.amount);
      }
      const presentmentMoney =
        toRecord(totalShippingPriceSet.presentment_money) ??
        toRecord(totalShippingPriceSet.presentmentMoney);
      if (presentmentMoney) {
        consider(presentmentMoney.amount);
      }
    }

    const considerCollection = (collection: AnyRecord[] | undefined) => {
      if (!collection || collection.length === 0) {
        return;
      }

      const total = collection.reduce((sum, entry) => {
        if (!entry || typeof entry !== "object") {
          return sum;
        }

        const amountCandidates: Array<unknown> = [
          (entry as AnyRecord).price,
          (entry as AnyRecord).discountedPrice,
          (entry as AnyRecord).discounted_price,
          (entry as AnyRecord).originalPrice,
          (entry as AnyRecord).original_price,
          (entry as AnyRecord).amount,
          (entry as AnyRecord).value,
          (entry as AnyRecord).cost,
        ];

        let lineValue: number | null = null;
        for (const candidate of amountCandidates) {
          if (candidate === undefined || candidate === null) continue;
          const resolved = safeNumber(candidate);
          if (lineValue === null) {
            lineValue = resolved;
          }
          if (resolved !== 0) {
            lineValue = resolved;
            break;
          }
        }

        return sum + (lineValue ?? 0);
      }, 0);

      if (primary === null && total !== 0) {
        primary = total;
      }
      if (fallback === null) {
        fallback = total;
      }
    };

    const shippingLinesArray = orderRaw.shippingLines ?? orderRaw.shipping_lines;
    if (Array.isArray(shippingLinesArray)) {
      considerCollection(shippingLinesArray as AnyRecord[]);
    }

    const edgeContainers = [
      toRecord(orderRaw.shippingLines as AnyRecord | undefined),
      toRecord(orderRaw.shipping_lines as AnyRecord | undefined),
    ];

    for (const container of edgeContainers) {
      if (!container) continue;
      const edges = container.edges;
      if (!Array.isArray(edges)) continue;
      const nodes = edges
        .map((edge) =>
          edge && typeof edge === "object"
            ? toRecord((edge as AnyRecord).node)
            : null,
        )
        .filter((node): node is AnyRecord => Boolean(node));
      considerCollection(nodes);
    }

    const adjustments = orderRaw.shippingAdjustments ?? orderRaw.shipping_adjustments;
    if (Array.isArray(adjustments)) {
      considerCollection(adjustments as AnyRecord[]);
    }

    if (primary !== null) {
      return primary;
    }

    return fallback ?? 0;
  };

  const variantMap = new Map<string, AnyRecord>();
  for (const variant of variants) {
    variantMap.set(toStringId(variant._id ?? variant.id ?? variant.variantId), variant);
  }

  const componentMap = new Map<string, AnyRecord>();
  for (const component of variantCosts) {
    const variantId = toStringId(component.variantId ?? component.variant_id);
    if (!variantId) continue;
    const current = componentMap.get(variantId);
    const currentTime = safeNumber(current?.updatedAt ?? current?.createdAt ?? 0);
    const componentTime = safeNumber(component.updatedAt ?? component.createdAt ?? 0);
    if (!current || componentTime > currentTime) {
      componentMap.set(variantId, component);
    }
  }

  const orderItemsByOrder = new Map<string, AnyRecord[]>();
  for (const item of orderItems) {
    const orderId = toStringId(item.orderId ?? item.order_id);
    if (!orderId) continue;
    const collection = orderItemsByOrder.get(orderId) ?? [];
    collection.push(item);
    orderItemsByOrder.set(orderId, collection);
  }

  const transactionsByOrder = new Map<string, AnyRecord[]>();
  for (const tx of transactions) {
    const orderId = toStringId(tx.orderId ?? tx.order_id);
    if (!orderId) continue;
    const collection = transactionsByOrder.get(orderId) ?? [];
    collection.push(tx);
    transactionsByOrder.set(orderId, collection);
  }

  const analyticsOrders: AnalyticsOrder[] = orders.map((orderRaw) => {
    const orderId = toStringId(orderRaw._id ?? orderRaw.id);
    const items = orderItemsByOrder.get(orderId) ?? [];
    const txs = transactionsByOrder.get(orderId) ?? [];

    const lineItems = items.map((item) => {
      const variantId = toStringId(item.variantId ?? item.variant_id);
      const component = componentMap.get(variantId);
      const perUnit = safeNumber(component?.cogsPerUnit ?? 0);
      return {
        id: toStringId(item._id ?? item.id ?? `${orderId}-${item.sku ?? item.title}`),
        name: String(item.title ?? item.productTitle ?? "Item"),
        quantity: safeNumber(item.quantity),
        price: safeNumber(item.price),
        cost: perUnit * safeNumber(item.quantity),
      };
    });

    const revenue = safeNumber(orderRaw.totalPrice);
    const shippingCost = resolveShippingCost(orderRaw);
    const taxAmount = safeNumber(orderRaw.taxesCollected ?? 0);
    const cogsAmount = lineItems.reduce((total, item) => total + item.cost, 0);
    const transactionFee = txs.reduce((total, tx) => total + safeNumber(tx.fee), 0);

    const totalCost = cogsAmount + shippingCost + taxAmount + transactionFee;
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const itemCount = lineItems.reduce((total, item) => total + item.quantity, 0);

    const shippingAddressRaw =
      (orderRaw.shippingAddress as AnyRecord | undefined) ??
      (orderRaw.shipping_address as AnyRecord | undefined) ??
      {};
    const billingAddressRaw =
      (orderRaw.billingAddress as AnyRecord | undefined) ??
      (orderRaw.billing_address as AnyRecord | undefined) ??
      {};

    const extractName = (record: AnyRecord | undefined): string => {
      if (!record || typeof record !== "object") return "";
      const nameCandidates: Array<unknown> = [
        record.name,
        record.displayName,
        record.display_name,
        [record.firstName ?? record.first_name ?? "", record.lastName ?? record.last_name ?? ""].join(" "),
      ];
      for (const candidate of nameCandidates) {
        if (typeof candidate !== "string") continue;
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
      return "";
    };

    const shippingAddress = shippingAddressRaw ?? {};

    const tagsArray = Array.isArray(orderRaw.tags)
      ? (orderRaw.tags as string[])
      : typeof orderRaw.tags === "string"
        ? (orderRaw.tags as string)
            .split(",")
            .map((tag: string) => tag.trim())
            .filter(Boolean)
        : [];

    const customerRecord = orderRaw.customer as AnyRecord | undefined;
    const customerNameCandidates: Array<unknown> = [
      orderRaw.customerName,
      customerRecord?.displayName,
      customerRecord?.display_name,
      customerRecord?.name,
      [customerRecord?.firstName ?? customerRecord?.first_name ?? "", customerRecord?.lastName ?? customerRecord?.last_name ?? ""].join(" "),
      extractName(shippingAddressRaw),
      extractName(billingAddressRaw),
      orderRaw.contactName,
      orderRaw.contact_name,
    ];

    let resolvedCustomerName = customerNameCandidates
      .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
      .find((candidate) => candidate.length > 0);

    if (!resolvedCustomerName) {
      resolvedCustomerName = "Guest Checkout";
    }

    const resolvedCustomerEmail = (() => {
      const emailCandidate =
        orderRaw.email ??
        customerRecord?.email ??
        shippingAddressRaw?.email ??
        billingAddressRaw?.email ??
        orderRaw.contactEmail ??
        orderRaw.contact_email;
      return typeof emailCandidate === "string" ? emailCandidate : "";
    })();

    const fallbackPayment =
      orderRaw.paymentMethod ??
      orderRaw.paymentGateway ??
      orderRaw.gateway ??
      orderRaw.payment_methods ??
      "";

    return {
      id: orderId,
      orderNumber: String(
        orderRaw.orderNumber ??
          orderRaw.name ??
          orderRaw.shopifyId ??
          orderId,
      ),
      customer: {
        name: String(resolvedCustomerName),
        email: String(resolvedCustomerEmail),
      },
      status: String(orderRaw.status ?? ""),
      fulfillmentStatus: resolveFulfillmentStatus(orderRaw),
      financialStatus: String(orderRaw.financialStatus ?? ""),
      items: itemCount,
      totalPrice: revenue,
      totalCost,
      profit,
      profitMargin,
      taxAmount,
      shippingCost,
      paymentMethod: String(txs[0]?.gateway ?? txs[0]?.paymentMethod ?? fallbackPayment ?? ""),
      tags: tagsArray,
      shippingAddress: {
        city: String(shippingAddress.city ?? shippingAddress.province ?? ""),
        country: String(shippingAddress.country ?? shippingAddress.countryCode ?? ""),
      },
      createdAt: new Date(
        safeNumber(orderRaw.shopifyCreatedAt ?? orderRaw.createdAt),
      ).toISOString(),
      updatedAt: new Date(
        safeNumber(orderRaw.shopifyUpdatedAt ?? orderRaw.updatedAt ?? orderRaw.shopifyCreatedAt),
      ).toISOString(),
      lineItems,
    } satisfies AnalyticsOrder;
  });

  const refundedOrders = new Set(
    refunds.map((refund) => toStringId(refund.orderId ?? refund.order_id)),
  );

  return {
    orders: analyticsOrders,
    refundedOrderIds: refundedOrders,
  } satisfies DerivedOrders;
}

type OrdersAggregateSummary = {
  totalOrders: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  totalTax: number;
  grossMargin: number;
  avgOrderValue: number;
  fulfillmentRate: number;
  avgFulfillmentCost: number;
  returnRate: number;
  prepaidRate: number;
  repeatRate: number;
  rtoRevenueLoss: number;
  abandonedCustomers: number;
};

function aggregateOrdersMetrics(
  orders: AnalyticsOrder[],
  refundedOrderIds: Set<string>,
): OrdersAggregateSummary {
  let totalRevenue = 0;
  let totalCosts = 0;
  let netProfit = 0;
  let totalTax = 0;
  let shippingTotal = 0;
  let cogsTotal = 0;
  let fulfilledCount = 0;
  let returnCount = 0;

  for (const order of orders) {
    totalRevenue += order.totalPrice;
    totalCosts += order.totalCost;
    netProfit += order.profit;
    totalTax += order.taxAmount;
    shippingTotal += order.shippingCost;

    const orderCogs = order.lineItems?.reduce((sum, item) => sum + item.cost, 0) ?? 0;
    cogsTotal += orderCogs;

    if (isFulfilledStatus(order.fulfillmentStatus)) {
      fulfilledCount += 1;
    }

    if (refundedOrderIds.has(order.id)) {
      returnCount += 1;
    }
  }

  const totalOrders = orders.length;
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - cogsTotal) / totalRevenue) * 100 : 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const fulfillmentRate = totalOrders > 0 ? (fulfilledCount / totalOrders) * 100 : 0;
  const avgFulfillmentCost = totalOrders > 0 ? shippingTotal / totalOrders : 0;
  const returnRate = totalOrders > 0 ? (returnCount / totalOrders) * 100 : 0;
  const prepaidRate = 0;
  const repeatRate = 0;
  const rtoRevenueLoss = 0;
  const abandonedCustomers = 0;

  return {
    totalOrders,
    totalRevenue,
    totalCosts,
    netProfit,
    totalTax,
    grossMargin,
    avgOrderValue,
    fulfillmentRate,
    avgFulfillmentCost,
    returnRate,
    prepaidRate,
    repeatRate,
    rtoRevenueLoss,
    abandonedCustomers,
  } satisfies OrdersAggregateSummary;
}

export function computeOrdersAnalytics(
  response: AnalyticsSourceResponse<any> | null | undefined,
  options: OrdersAnalyticsOptions = {},
  previousResponse?: AnalyticsSourceResponse<any> | null | undefined,
): OrdersAnalyticsResult {
  if (!response) {
    return {
      overview: null,
      orders: null,
      fulfillment: null,
      exportRows: [],
    } satisfies OrdersAnalyticsResult;
  }

  const data = ensureDataset(response);
  if (!data) {
    return {
      overview: null,
      orders: null,
      fulfillment: null,
      exportRows: [],
    } satisfies OrdersAnalyticsResult;
  }

  const { orders: analyticsOrders, refundedOrderIds } = deriveAnalyticsOrders(data);

  const filtered = analyticsOrders.filter(
    (order) => matchesStatus(order, options.status) && matchesSearch(order, options.searchTerm),
  );

  const sorted = sortOrders(filtered, options.sortBy, options.sortOrder ?? "desc");

  const total = sorted.length;
  const pageSize = Math.max(1, options.pageSize ?? 50);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(options.page ?? 1, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  const aggregates = aggregateOrdersMetrics(sorted, refundedOrderIds);

  let previousAggregates: OrdersAggregateSummary | null = null;
  if (previousResponse) {
    const previousData = ensureDataset(previousResponse);
    if (previousData) {
      const { orders: previousOrders, refundedOrderIds: previousRefunded } =
        deriveAnalyticsOrders(previousData);
      const previousFiltered = previousOrders.filter(
        (order) => matchesStatus(order, options.status) && matchesSearch(order, options.searchTerm),
      );
      previousAggregates = aggregateOrdersMetrics(previousFiltered, previousRefunded);
    }
  }

  const overview: OrdersOverviewMetrics = {
    totalOrders: aggregates.totalOrders,
    totalRevenue: aggregates.totalRevenue,
    totalCosts: aggregates.totalCosts,
    netProfit: aggregates.netProfit,
    totalTax: aggregates.totalTax,
    avgOrderValue: aggregates.avgOrderValue,
    customerAcquisitionCost: 0,
    grossMargin: aggregates.grossMargin,
    fulfillmentRate: aggregates.fulfillmentRate,
    prepaidRate: aggregates.prepaidRate,
    repeatRate: aggregates.repeatRate,
    rtoRevenueLoss: aggregates.rtoRevenueLoss,
    abandonedCustomers: aggregates.abandonedCustomers,
    changes: {
      totalOrders: percentageChange(
        aggregates.totalOrders,
        previousAggregates?.totalOrders ?? 0,
      ),
      revenue: percentageChange(
        aggregates.totalRevenue,
        previousAggregates?.totalRevenue ?? 0,
      ),
      netProfit: percentageChange(
        aggregates.netProfit,
        previousAggregates?.netProfit ?? 0,
      ),
      avgOrderValue: percentageChange(
        aggregates.avgOrderValue,
        previousAggregates?.avgOrderValue ?? 0,
      ),
      cac: percentageChange(0, 0),
      margin: percentageChange(
        aggregates.grossMargin,
        previousAggregates?.grossMargin ?? 0,
      ),
      fulfillmentRate: percentageChange(
        aggregates.fulfillmentRate,
        previousAggregates?.fulfillmentRate ?? 0,
      ),
      prepaidRate: percentageChange(
        aggregates.prepaidRate,
        previousAggregates?.prepaidRate ?? 0,
      ),
      repeatRate: percentageChange(
        aggregates.repeatRate,
        previousAggregates?.repeatRate ?? 0,
      ),
      rtoRevenueLoss: percentageChange(
        aggregates.rtoRevenueLoss,
        previousAggregates?.rtoRevenueLoss ?? 0,
      ),
      abandonedCustomers: percentageChange(
        aggregates.abandonedCustomers,
        previousAggregates?.abandonedCustomers ?? 0,
      ),
    },
  };

  const fulfillment: OrdersFulfillmentMetrics = {
    avgProcessingTime: 0,
    avgShippingTime: 0,
    avgDeliveryTime: 0,
    onTimeDeliveryRate: overview.fulfillmentRate,
    fulfillmentAccuracy: overview.fulfillmentRate,
    returnRate: aggregates.returnRate,
    avgFulfillmentCost: aggregates.avgFulfillmentCost,
    totalOrders: aggregates.totalOrders,
  };

  const exportRows: OrdersAnalyticsExportRow[] = sorted.map((order) => ({
    orderNumber: order.orderNumber,
    customerEmail: order.customer.email,
    email: order.customer.email,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    financialStatus: order.financialStatus,
    items: order.items,
    revenue: order.totalPrice,
    costs: order.totalCost,
    profit: order.profit,
    profitMargin: order.profitMargin,
    shipping: order.shippingCost,
    tax: order.taxAmount,
    payment: order.paymentMethod,
    shipTo: `${order.shippingAddress.city}, ${order.shippingAddress.country}`.trim(),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }));

  return {
    overview,
    orders: {
      data: paginated,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
      },
    },
    fulfillment,
    exportRows,
  } satisfies OrdersAnalyticsResult;
}
