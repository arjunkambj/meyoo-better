import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { computeOverviewMetrics } from "@/libs/analytics/aggregations";
import type { AnalyticsSourceData } from "@/libs/analytics/aggregations";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";

import type { FulfillmentData } from "@/components/dashboard/(analytics)/orders-insights/components/FulfillmentAnalysis";
import type { OrdersOverviewMetrics } from "@/components/dashboard/(analytics)/orders/components/OrdersOverviewCards";
import type { Order } from "@/components/dashboard/(analytics)/orders/components/OrdersTable";

interface UseOrdersAnalyticsParams {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  status?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const DEFAULT_PAGE_SIZE = 50;

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toStringId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("id" in (value as Record<string, unknown>) && typeof (value as any).id === "string") {
      return (value as any).id;
    }
    if ("_id" in (value as Record<string, unknown>) && typeof (value as any)._id === "string") {
      return (value as any)._id;
    }
  }
  return String(value ?? "");
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

function matchesStatus(order: Order, status?: string): boolean {
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

function matchesSearch(order: Order, term?: string): boolean {
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
  orders: Order[],
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): Order[] {
  if (!sortBy) {
    return [...orders].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
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

export function useOrdersAnalytics(params: UseOrdersAnalyticsParams = {}) {
  const { timezone } = useOrganizationTimeZone();

  const {
    dateRange,
    status,
    searchTerm,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy,
    sortOrder = "desc",
  } = params;

  const effectiveDateRange = dateRange ?? (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  })();

  const dateArgs = toUtcRangeStrings(effectiveDateRange, timezone);

  const rawOverview = useQuery(api.web.orders.getOrdersOverview, {
    dateRange: dateArgs,
  });
  const rawFulfillment = useQuery(api.web.orders.getFulfillmentMetrics, {
    dateRange: dateArgs,
  });

  const overviewAggregation = useMemo(
    () => computeOverviewMetrics(rawOverview ?? undefined),
    [rawOverview],
  );

  const processed = useMemo(() => {
    const dataset = rawOverview ?? rawFulfillment;
    if (!dataset?.data) {
      return null;
    }

    const data = dataset.data as AnalyticsSourceData<any>;
    const ordersRaw = (data.orders || []) as any[];
    const orderItems = (data.orderItems || []) as any[];
    const transactions = (data.transactions || []) as any[];
    const productCostComponents = (data.productCostComponents || []) as any[];
    const variants = (data.variants || []) as any[];
    const refunds = (data.refunds || []) as any[];

    const variantMap = new Map<string, any>();
    for (const variant of variants) {
      variantMap.set(
        toStringId(variant._id ?? variant.id ?? variant.variantId),
        variant,
      );
    }

    const componentMap = new Map<string, any>();
    for (const component of productCostComponents) {
      const variantId = toStringId(component.variantId ?? component.variant_id);
      if (!variantId) continue;
      const current = componentMap.get(variantId);
      if (
        !current ||
        safeNumber(component.effectiveFrom) > safeNumber(current?.effectiveFrom)
      ) {
        componentMap.set(variantId, component);
      }
    }

    const orderItemsByOrder = new Map<string, any[]>();
    for (const item of orderItems) {
      const orderId = toStringId(item.orderId ?? item.order_id);
      if (!orderId) continue;
      const collection = orderItemsByOrder.get(orderId) ?? [];
      collection.push(item);
      orderItemsByOrder.set(orderId, collection);
    }

    const transactionsByOrder = new Map<string, any[]>();
    for (const tx of transactions) {
      const orderId = toStringId(tx.orderId ?? tx.order_id);
      if (!orderId) continue;
      const collection = transactionsByOrder.get(orderId) ?? [];
      collection.push(tx);
      transactionsByOrder.set(orderId, collection);
    }

    const processedOrders: Order[] = ordersRaw.map((orderRaw) => {
      const orderId = toStringId(orderRaw._id ?? orderRaw.id);
      const items = orderItemsByOrder.get(orderId) ?? [];
      const txs = transactionsByOrder.get(orderId) ?? [];

      const lineItems = items.map((item) => {
        const variantId = toStringId(item.variantId ?? item.variant_id);
        const component = componentMap.get(variantId);
        const variant = variantMap.get(variantId);
        const perUnit = safeNumber(
          component?.cogsPerUnit ?? component?.costPerUnit ?? variant?.costPerItem ?? 0,
        );
        return {
          id: toStringId(item._id ?? item.id ?? `${orderId}-${item.sku ?? item.title}`),
          name: String(item.title ?? item.productTitle ?? "Item"),
          quantity: safeNumber(item.quantity),
          price: safeNumber(item.price),
          cost: perUnit * safeNumber(item.quantity),
        };
      });

      const revenue = safeNumber(orderRaw.totalPrice);
      const shippingCost = safeNumber(orderRaw.totalShippingPrice);
      const taxAmount = safeNumber(orderRaw.totalTax);
      const cogs = lineItems.reduce((total, item) => total + item.cost, 0);
      const transactionFee = txs.reduce((total, tx) => total + safeNumber(tx.fee), 0);

      const totalCost = cogs + shippingCost + taxAmount + transactionFee;
      const profit = revenue - totalCost;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const itemCount = lineItems.reduce((total, item) => total + item.quantity, 0);

      const shippingAddress = orderRaw.shippingAddress || orderRaw.shipping_address || {};

      return {
        id: orderId,
        orderNumber: String(orderRaw.orderNumber ?? orderRaw.name ?? orderRaw.shopifyId ?? orderId),
        customer: {
          name: String(
            orderRaw.customerName ??
              orderRaw.customer?.name ??
              `${orderRaw.customer?.firstName ?? ""} ${orderRaw.customer?.lastName ?? ""}`.trim() ??
              "Customer",
          ),
          email: String(orderRaw.email ?? orderRaw.customer?.email ?? ""),
        },
        status: String(orderRaw.orderStatus ?? orderRaw.status ?? ""),
        fulfillmentStatus: String(orderRaw.fulfillmentStatus ?? ""),
        financialStatus: String(orderRaw.financialStatus ?? ""),
        items: itemCount,
        totalPrice: revenue,
        totalCost,
        profit,
        profitMargin,
        taxAmount,
        shippingCost,
        paymentMethod: String(txs[0]?.gateway ?? txs[0]?.paymentMethod ?? ""),
        tags:
          (Array.isArray(orderRaw.tags)
            ? orderRaw.tags
            : typeof orderRaw.tags === "string"
              ? orderRaw.tags.split(",").map((tag: string) => tag.trim())
              : undefined) || [],
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
      };
    });

    const filtered = processedOrders.filter(
      (order) => matchesStatus(order, status) && matchesSearch(order, searchTerm),
    );

    const sorted = sortOrders(filtered, sortBy, sortOrder);

    const total = sorted.length;
    const effectivePageSize = Math.max(1, pageSize);
    const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * effectivePageSize;
    const paginated = sorted.slice(start, start + effectivePageSize);

    const aggregates = sorted.reduce(
      (acc, order) => {
        acc.revenue += order.totalPrice;
        acc.totalCost += order.totalCost;
        acc.netProfit += order.profit;
        acc.tax += order.taxAmount;
        acc.shipping += order.shippingCost;
        acc.transaction += order.totalCost - order.shippingCost - order.taxAmount - (order.lineItems?.reduce((sum, item) => sum + item.cost, 0) ?? 0);
        acc.cogs += order.lineItems?.reduce((sum, item) => sum + item.cost, 0) ?? 0;
        acc.unitsSold += order.items;
        if (isFulfilledStatus(order.fulfillmentStatus)) {
          acc.fulfilled += 1;
        }
        return acc;
      },
      {
        revenue: 0,
        totalCost: 0,
        netProfit: 0,
        tax: 0,
        shipping: 0,
        transaction: 0,
        cogs: 0,
        unitsSold: 0,
        fulfilled: 0,
      },
    );

    const refundedOrders = new Set(
      refunds.map((refund) => toStringId(refund.orderId ?? refund.order_id)),
    );

    return {
      processedOrders,
      filteredOrders: sorted,
      paginatedOrders: paginated,
      total,
      totalPages,
      currentPage,
      aggregates,
      refundedCount: refundedOrders.size,
    };
  }, [rawOverview, rawFulfillment, status, searchTerm, sortBy, sortOrder, page, pageSize]);

  const overview: OrdersOverviewMetrics | undefined = useMemo(() => {
    if (!processed) return undefined;

    const { aggregates, total, refundedCount } = processed;
    const summary = overviewAggregation?.summary;

    const averageOrderValue = total > 0 ? aggregates.revenue / total : 0;
    const grossMargin =
      aggregates.revenue > 0
        ? ((aggregates.revenue - aggregates.cogs) / aggregates.revenue) * 100
        : 0;
    const fulfillmentRate =
      total > 0 ? (aggregates.fulfilled / total) * 100 : 0;

    return {
      totalOrders: total,
      totalRevenue: aggregates.revenue,
      totalCosts: aggregates.totalCost,
      netProfit: aggregates.netProfit,
      totalTax: aggregates.tax,
      avgOrderValue: averageOrderValue,
      customerAcquisitionCost: summary?.customerAcquisitionCost ?? 0,
      grossMargin,
      fulfillmentRate,
      changes: {
        totalOrders: 0,
        revenue: 0,
        netProfit: 0,
        avgOrderValue: 0,
        cac: 0,
        margin: 0,
        fulfillmentRate: 0,
      },
    };
  }, [processed, overviewAggregation?.summary]);

  const ordersResult = useMemo(() => {
    if (!processed) return undefined;

    return {
      data: processed.paginatedOrders,
      pagination: {
        page: processed.currentPage,
        total: processed.total,
      },
    };
  }, [processed]);

  const fulfillmentMetrics: FulfillmentData | undefined = useMemo(() => {
    if (!processed) return undefined;

    const { total, aggregates, refundedCount } = processed;

    return {
      avgProcessingTime: 0,
      avgShippingTime: 0,
      avgDeliveryTime: 0,
      onTimeDeliveryRate: total > 0 ? (aggregates.fulfilled / total) * 100 : 0,
      fulfillmentAccuracy: total > 0 ? (aggregates.fulfilled / total) * 100 : 0,
      returnRate: total > 0 ? (refundedCount / total) * 100 : 0,
      avgFulfillmentCost: total > 0 ? aggregates.shipping / total : 0,
      totalOrders: total,
    };
  }, [processed]);

  const exportData = useMemo(() => {
    if (!processed) return [];

    return processed.filteredOrders.map((order) => ({
      "Order Number": order.orderNumber,
      Customer: order.customer.name,
      Email: order.customer.email,
      Status: order.status,
      "Fulfillment Status": order.fulfillmentStatus,
      "Financial Status": order.financialStatus,
      Items: order.items,
      Revenue: order.totalPrice,
      Costs: order.totalCost,
      Profit: order.profit,
      "Profit Margin": order.profitMargin,
      Shipping: order.shippingCost,
      Tax: order.taxAmount,
      Payment: order.paymentMethod,
      "Ship To": `${order.shippingAddress.city}, ${order.shippingAddress.country}`.trim(),
      "Created At": order.createdAt,
      "Updated At": order.updatedAt,
    }));
  }, [processed]);

  const loadingStates = {
    overview: rawOverview === undefined,
    orders: rawOverview === undefined,
    fulfillment: rawFulfillment === undefined,
  };

  const isLoading = Object.values(loadingStates).some(Boolean);
  const isInitialLoading = loadingStates.overview;

  return {
    overview,
    orders: ordersResult,
    fulfillmentMetrics,
    exportData,
    isLoading,
    isInitialLoading,
    loadingStates,
    orderOverview: overview ?? undefined,
  };
}
