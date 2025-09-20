import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";
import type { FulfillmentData } from "@/components/dashboard/(analytics)/orders-insights/components/FulfillmentAnalysis";
import type { OrdersOverviewMetrics } from "@/components/dashboard/(analytics)/orders/components/OrdersOverviewCards";
import type { Order } from "@/components/dashboard/(analytics)/orders/components/OrdersTable";

import { api } from "@/libs/convexApi";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";

// Import types from components

// Define hook parameters
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

export function useOrdersAnalytics(params: UseOrdersAnalyticsParams = {}) {
  const { timezone } = useOrganizationTimeZone();
  const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);
  const {
    dateRange,
    status,
    searchTerm,
    page = 1,
    pageSize = 50,
    sortBy,
    sortOrder,
  } = params;

  // Default date range: last 30 days
  const defaultDateRange: { startDate: string; endDate: string } =
    useMemo(() => {
      const endDate = new Date();
      const startDate = new Date();

      startDate.setDate(startDate.getDate() - 30);

      return {
        startDate: toDateStr(startDate),
        endDate: toDateStr(endDate),
      };
    }, []);

  const effectiveDateRange = dateRange || defaultDateRange;

  // Fetch orders overview
  const overviewData = useQuery(api.web.orders.getOrdersOverview, {
    dateRange: toUtcRangeStrings(effectiveDateRange, timezone),
  });

  // Fetch orders list
  const ordersData = useQuery(api.web.orders.getOrdersList, {
    page,
    pageSize,
    status,
    searchTerm,
    sortBy,
    sortOrder,
    dateRange: toUtcRangeStrings(effectiveDateRange, timezone),
  });

  // Fetch fulfillment metrics
  const fulfillmentData = useQuery(api.web.orders.getFulfillmentMetrics, {
    dateRange: toUtcRangeStrings(effectiveDateRange, timezone),
  });

  // Process and format data
  const overview = useMemo<OrdersOverviewMetrics | undefined>(() => {
    if (!overviewData) return undefined;

    // Transform the data to match OrdersOverviewMetrics interface
    return {
      totalOrders: overviewData.totalOrders || 0,
      totalRevenue: overviewData.totalRevenue || 0,
      totalCosts: overviewData.totalCosts || 0,
      netProfit:
        overviewData.netProfit ||
        overviewData.totalRevenue - overviewData.totalCosts ||
        0,
      totalTax: overviewData.totalTax || 0,
      avgOrderValue: overviewData.avgOrderValue || 0,
      customerAcquisitionCost: overviewData.customerAcquisitionCost || 0,
      grossMargin: overviewData.grossMargin || 0,
      fulfillmentRate: overviewData.fulfillmentRate || 0,
      changes: {
        totalOrders: overviewData.changes?.totalOrders || 0,
        revenue: overviewData.changes?.revenue || 0,
        netProfit: overviewData.changes?.netProfit || 0,
        avgOrderValue: overviewData.changes?.avgOrderValue || 0,
        cac: overviewData.changes?.cac || 0,
        margin: overviewData.changes?.margin || 0,
        fulfillmentRate: overviewData.changes?.fulfillmentRate || 0,
      },
    };
  }, [overviewData]);

  const orders = useMemo(() => {
    if (!ordersData) return undefined;

    return {
      data: ordersData.data,
      pagination: {
        ...ordersData.pagination,
        setPage: (_newPage: number) => {
          // This will be handled by the parent component
          // by updating the page parameter
        },
      },
    };
  }, [ordersData]);

  const fulfillmentMetrics = useMemo<FulfillmentData | undefined>(() => {
    if (!fulfillmentData) return undefined;

    return {
      avgProcessingTime: fulfillmentData.avgProcessingTime,
      avgShippingTime: fulfillmentData.avgShippingTime,
      avgDeliveryTime: fulfillmentData.avgDeliveryTime,
      onTimeDeliveryRate: fulfillmentData.onTimeDeliveryRate,
      fulfillmentAccuracy: fulfillmentData.fulfillmentAccuracy,
      returnRate: fulfillmentData.returnRate,
      avgFulfillmentCost: fulfillmentData.avgFulfillmentCost,
      totalOrders: fulfillmentData.totalOrders,
    };
  }, [fulfillmentData]);

  // Export data for CSV/Excel/PDF
  const exportData = useMemo(() => {
    if (!ordersData?.data) return [];

    return ordersData.data.map((order: Order) => ({
      "Order Number": order.orderNumber,
      Customer: order.customer.name,
      Email: order.customer.email,
      Status: order.status,
      "Fulfillment Status": order.fulfillmentStatus,
      "Financial Status": order.financialStatus,
      Items: order.items,
      Total: `$${order.totalPrice.toFixed(2)}`,
      "Ship To": `${order.shippingAddress.city}, ${order.shippingAddress.country}`,
      "Created At": new Date(order.createdAt).toLocaleDateString(),
      "Updated At": new Date(order.updatedAt).toLocaleDateString(),
    }));
  }, [ordersData]);

  // Granular loading states for each data type
  const loadingStates = {
    overview: overviewData === undefined,
    orders: ordersData === undefined,
    fulfillment: fulfillmentData === undefined,
  };

  // Loading state (for backward compatibility)
  const isLoading = Object.values(loadingStates).some((loading) => loading);

  // Check if initial critical data is loading (overview)
  const isInitialLoading = loadingStates.overview;

  return {
    overview,
    orders,
    fulfillmentMetrics,
    exportData,
    isLoading,
    isInitialLoading,
    loadingStates,
    orderOverview: overviewData, // Expose raw order overview data
  };
}
