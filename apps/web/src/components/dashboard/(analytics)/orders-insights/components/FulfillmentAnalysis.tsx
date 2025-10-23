"use client";

import { Card } from "@heroui/card";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { formatNumber } from "@/libs/utils/format";
import type { OrdersFulfillmentMetrics as FulfillmentData } from "@repo/types";

interface FulfillmentAnalysisProps {
  metrics?: FulfillmentData;
}

export function FulfillmentAnalysis({ metrics }: FulfillmentAnalysisProps) {
  const performanceMetrics = useMemo(() => {
    if (!metrics) return [];

    return [
      {
        label: "On-Time Delivery",
        value: metrics.onTimeDeliveryRate,
        unit: "%",
        icon: "solar:clock-circle-bold-duotone",
        benchmark: 95,
        status:
          metrics.onTimeDeliveryRate >= 95
            ? "success"
            : metrics.onTimeDeliveryRate >= 85
              ? "warning"
              : "danger",
        description: "Industry standard: 95%+",
      },
      {
        label: "Fulfillment Accuracy",
        value: metrics.fulfillmentAccuracy,
        unit: "%",
        icon: "solar:shield-check-bold-duotone",
        benchmark: 98,
        status:
          metrics.fulfillmentAccuracy >= 98
            ? "success"
            : metrics.fulfillmentAccuracy >= 95
              ? "warning"
              : "danger",
        description: "Industry standard: 98%+",
      },
      {
        label: "Return Rate",
        value: metrics.returnRate,
        unit: "%",
        icon: "solar:restart-circle-bold-duotone",
        benchmark: 2,
        inverse: true,
        status:
          metrics.returnRate <= 2
            ? "success"
            : metrics.returnRate <= 5
              ? "warning"
              : "danger",
        description: "Industry standard: <2%",
      },
    ];
  }, [metrics]);

  const timeMetrics = useMemo(() => {
    if (!metrics) return [];

    return [
      {
        label: "Processing",
        value: metrics.avgProcessingTime,
        days: metrics.avgProcessingTime,
        icon: "solar:clock-circle-bold-duotone",
        color: "primary",
        description: "Order to processing",
      },
      {
        label: "Shipping",
        value: Math.max(0, metrics.avgShippingTime - metrics.avgProcessingTime),
        days: Math.max(0, metrics.avgShippingTime - metrics.avgProcessingTime),
        icon: "solar:delivery-bold-duotone",
        color: "secondary",
        description: "Processing to shipped",
      },
      {
        label: "Final Delivery",
        value: Math.max(0, metrics.avgDeliveryTime - metrics.avgShippingTime),
        days: Math.max(0, metrics.avgDeliveryTime - metrics.avgShippingTime),
        icon: "solar:check-circle-bold-duotone",
        color: "success",
        description: "Shipped to delivered",
      },
    ];
  }, [metrics]);

  if (!metrics) {
    return (
      <Card className="p-6 bg-white dark:bg-content1 border-none shadow-sm rounded-2xl">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-default-900">
            Fulfillment Analysis
          </h3>
          <p className="text-sm text-default-500 mt-0.5">
            Performance metrics and delivery times
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-48 text-default-400">
          <Icon
            className="mb-4 text-default-300"
            icon="solar:delivery-linear"
            width={32}
          />
          <p className="text-sm">No fulfillment data available</p>
          <p className="text-xs text-default-400 mt-1">
            Metrics will appear once you have order fulfillment data
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-default-100/90 shadow-none dark:bg-content1 border border-default-50 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-default-900">
            Fulfillment Analysis
          </h3>
          <p className="text-sm text-default-500 mt-0.5">
            Performance metrics and delivery times
          </p>
        </div>
        {metrics?.totalOrders && (
          <div className="text-sm text-default-600">
            <span className="font-medium">
              {formatNumber(metrics.totalOrders)}
            </span>
            <span className="text-default-400 ml-1">orders</span>
          </div>
        )}
      </div>

      {/* Performance Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {performanceMetrics.map((metric) => (
          <div
            key={metric.label}
            className="p-4 bg-white dark:bg-default-50 rounded-xl border border-default-100"
          >
            <div className="mb-3">
              <p className="text-sm font-medium text-default-900">
                {metric.label}
              </p>
              <p className="text-xs text-default-500 mt-0.5">
                {metric.description}
              </p>
            </div>

            <div>
              <p className="text-2xl font-semibold text-default-900">
                {metric.value.toFixed(1)}%
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-default-500">
                  Target: {metric.inverse ? "<" : ">"}
                  {metric.benchmark}%
                </span>
                <span
                  className={`text-xs font-medium ${
                    metric.status === "success"
                      ? "text-success-600"
                      : metric.status === "warning"
                        ? "text-warning-600"
                        : "text-danger-600"
                  }`}
                >
                  {metric.status === "success"
                    ? "Good"
                    : metric.status === "warning"
                      ? "Fair"
                      : "Low"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Metrics with Cost */}
        <div>
          <h4 className="text-sm font-medium text-default-900 mb-4">
            Average Times
          </h4>
          <div className="space-y-3">
            {timeMetrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-center justify-between p-3 bg-white dark:bg-default-50 rounded-xl border border-default-100"
              >
                <div>
                  <p className="text-sm font-medium text-default-900">
                    {metric.label}
                  </p>
                  <p className="text-xs text-default-500">
                    {metric.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-default-900">
                    {metric.value.toFixed(1)}
                  </p>
                  <p className="text-xs text-default-400">days</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Timeline Visual */}
        <div>
          <h4 className="text-sm font-medium text-default-900 mb-4">
            Delivery Timeline
          </h4>
          <div className="p-4 bg-white dark:bg-default-50 rounded-xl border border-default-100">
            <div className="mb-3">
              <p className="text-sm font-medium text-default-900">
                Order to Delivery
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-default-500 mb-2">
              <span className="flex items-center gap-1">
                <Icon icon="solar:cart-check-bold" width={14} />
                Order Placed
              </span>
              <span className="flex items-center gap-1">
                <Icon icon="solar:box-bold" width={14} />
                Delivered
              </span>
            </div>

            <div className="relative h-2 bg-default-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-primary-500 rounded-full"
                style={{
                  width: `${Math.min(100, (metrics.avgProcessingTime / metrics.avgDeliveryTime) * 100)}%`,
                }}
              />
              <div
                className="absolute top-0 h-full bg-primary-500"
                style={{
                  left: `${Math.min(100, (metrics.avgProcessingTime / metrics.avgDeliveryTime) * 100)}%`,
                  width: `${Math.min(100 - (metrics.avgProcessingTime / metrics.avgDeliveryTime) * 100, Math.max(0, ((metrics.avgShippingTime - metrics.avgProcessingTime) / metrics.avgDeliveryTime) * 100))}%`,
                }}
              />
              <div
                className="absolute top-0 h-full bg-primary-200 rounded-r-full"
                style={{
                  left: `${Math.min(100, (metrics.avgShippingTime / metrics.avgDeliveryTime) * 100)}%`,
                  width: `${Math.max(0, Math.min(100 - (metrics.avgShippingTime / metrics.avgDeliveryTime) * 100, ((metrics.avgDeliveryTime - metrics.avgShippingTime) / metrics.avgDeliveryTime) * 100))}%`,
                }}
              />
            </div>

            <div className="flex justify-between mt-3">
              <div className="flex items-center gap-3 text-xs text-default-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary-600 rounded-full" />
                  <span>Processing</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary-400 rounded-full" />
                  <span>Shipping</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary-400 rounded-full" />
                  <span>Delivery</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-default-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-default-500">Total Time</span>
                <span className="text-sm font-medium text-default-900">
                  {metrics.avgDeliveryTime.toFixed(1)} days
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
