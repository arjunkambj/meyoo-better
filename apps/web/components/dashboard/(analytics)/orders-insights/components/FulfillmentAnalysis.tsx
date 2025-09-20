"use client";

import { Button, Card, Chip, CircularProgress, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo } from "react";

import { useUser } from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";

export interface FulfillmentData {
  avgProcessingTime: number;
  avgShippingTime: number;
  avgDeliveryTime: number;
  onTimeDeliveryRate: number;
  fulfillmentAccuracy: number;
  returnRate: number;
  avgFulfillmentCost?: number;
  totalOrders?: number;
}

interface FulfillmentAnalysisProps {
  metrics?: FulfillmentData;
}

export function FulfillmentAnalysis({ metrics }: FulfillmentAnalysisProps) {
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

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
      <Card className="p-5 bg-default-50 rounded-2xl border border-divider">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Fulfillment Analysis</h3>
          <p className="text-sm text-default-500 mt-1">
            Performance metrics and delivery times
          </p>
        </div>
        <div className="flex flex-col items-center justify-center h-48 text-default-400">
          <Icon className="mb-4" icon="solar:delivery-linear" width={48} />
          <p className="text-sm">No fulfillment data available</p>
          <p className="text-xs text-default-400 mt-1">
            Metrics will appear once you have order fulfillment data
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-default-50 rounded-2xl border border-divider">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Fulfillment Analysis</h3>
          <p className="text-sm text-default-500 mt-1">
            Performance metrics and delivery times
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metrics?.totalOrders && (
            <Chip color="primary" size="sm" variant="flat">
              {metrics.totalOrders.toLocaleString()} orders
            </Chip>
          )}
          <Button
            isIconOnly
            className="text-default-400"
            size="sm"
            variant="light"
          >
            <Icon icon="solar:export-bold-duotone" width={18} />
          </Button>
        </div>
      </div>

      {/* Performance Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {performanceMetrics.map((metric) => (
          <div
            key={metric.label}
            className="p-4 bg-content2 dark:bg-content1 rounded-lg border border-default-200/50 hover:border-primary/20 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {(() => {
                  const bg =
                    metric.status === "success"
                      ? "bg-success/10"
                      : metric.status === "warning"
                        ? "bg-warning/10"
                        : "bg-danger/10";
                  const text =
                    metric.status === "success"
                      ? "text-success"
                      : metric.status === "warning"
                        ? "text-warning"
                        : "text-danger";
                  return (
                    <div className={`p-2 rounded-lg ${bg}`}>
                      <Icon className={text} icon={metric.icon} width={20} />
                    </div>
                  );
                })()}
                <div>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <p className="text-xs text-default-400">
                    {metric.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <CircularProgress
                classNames={{
                  svg: "w-16 h-16",
                  indicator:
                    metric.status === "success"
                      ? "stroke-success"
                      : metric.status === "warning"
                        ? "stroke-warning"
                        : "stroke-danger",
                  track: "stroke-default-200",
                  value: "text-sm font-bold",
                }}
                formatOptions={{ style: "decimal", maximumFractionDigits: 1 }}
                maxValue={100}
                showValueLabel={true}
                strokeWidth={3}
                value={metric.value}
              />

              <div className="text-right">
                <Chip
                  className="mb-2"
                  color={
                    metric.status as
                      | "primary"
                      | "secondary"
                      | "success"
                      | "warning"
                      | "danger"
                      | "default"
                  }
                  size="sm"
                  variant="flat"
                >
                  {metric.status === "success"
                    ? "Excellent"
                    : metric.status === "warning"
                      ? "Fair"
                      : "Needs Work"}
                </Chip>
                <div className="flex items-center gap-1 text-xs text-default-500">
                  <Icon icon="solar:target-bold" width={12} />
                  <span>
                    Target: {metric.inverse ? "<" : ">"}
                    {metric.benchmark}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Metrics with Cost */}
        <div>
          <h4 className="text-sm font-medium text-default-600 mb-4">
            Average Times & Costs
          </h4>
          <div className="space-y-3">
            {timeMetrics.map((metric) => (
              <div
                key={metric.label}
                className="group relative flex items-center justify-between p-3 bg-default-50 hover:bg-default-100 rounded-lg transition-all duration-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const bg =
                      metric.color === "primary"
                        ? "bg-primary/10"
                        : metric.color === "secondary"
                          ? "bg-secondary/10"
                          : "bg-success/10";
                    const text =
                      metric.color === "primary"
                        ? "text-primary"
                        : metric.color === "secondary"
                          ? "text-secondary"
                          : "text-success";
                    return (
                      <div className={`p-2 rounded-lg ${bg}`}>
                        <Icon className={text} icon={metric.icon} width={20} />
                      </div>
                    );
                  })()}
                  <div>
                    <p className="text-sm font-medium">{metric.label}</p>
                    <p className="text-xs text-default-500">
                      {metric.description ||
                        (metric.days < 1
                          ? "< 1 day"
                          : metric.days === 1
                            ? "1 day"
                            : `${metric.days.toFixed(1)} days`)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{metric.value.toFixed(1)}</p>
                  <p className="text-xs text-default-400">days avg</p>
                </div>
              </div>
            ))}

            {metrics.avgFulfillmentCost && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      className="text-primary"
                      icon="solar:wallet-money-bold-duotone"
                      width={20}
                    />
                    <div>
                      <p className="text-sm font-medium">Avg Cost per Order</p>
                      <p className="text-xs text-default-500">
                        Fulfillment expenses
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">
                      {currencySymbol}
                      {metrics.avgFulfillmentCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-default-400">per order</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Delivery Timeline Visual */}
        <div>
          <h4 className="text-sm font-medium text-default-600 mb-4">
            Delivery Timeline
          </h4>
          <div className="p-4 bg-gradient-to-br from-default-50 to-default-100 rounded-lg border border-default-200/50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Order to Delivery Flow</p>
              <Tooltip content="Average time from order placement to delivery">
                <Icon
                  className="text-default-400 cursor-help"
                  icon="solar:info-circle-bold"
                  width={16}
                />
              </Tooltip>
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

            <div className="relative h-3 bg-default-200 rounded-full overflow-hidden shadow-inner">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (metrics.avgProcessingTime / metrics.avgDeliveryTime) * 100)}%`,
                }}
                title="Processing Time"
              />
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-secondary to-secondary/80 rounded-full transition-all duration-500"
                style={{
                  left: `${Math.min(100, (metrics.avgProcessingTime / metrics.avgDeliveryTime) * 100)}%`,
                  width: `${Math.min(100 - (metrics.avgProcessingTime / metrics.avgDeliveryTime) * 100, Math.max(0, ((metrics.avgShippingTime - metrics.avgProcessingTime) / metrics.avgDeliveryTime) * 100))}%`,
                }}
                title="Shipping Time"
              />
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-success to-success/80 rounded-full transition-all duration-500"
                style={{
                  left: `${Math.min(100, (metrics.avgShippingTime / metrics.avgDeliveryTime) * 100)}%`,
                  width: `${Math.max(0, Math.min(100 - (metrics.avgShippingTime / metrics.avgDeliveryTime) * 100, ((metrics.avgDeliveryTime - metrics.avgShippingTime) / metrics.avgDeliveryTime) * 100))}%`,
                }}
                title="Final Delivery"
              />
            </div>

            <div className="flex justify-between mt-3">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>Processing</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
                  <span>Shipping</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  <span>Delivery</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-default-200/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-default-500">Total Time</span>
                <span className="font-semibold text-primary">
                  {metrics.avgDeliveryTime.toFixed(1)} days average
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
