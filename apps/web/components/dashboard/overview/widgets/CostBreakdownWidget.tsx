"use client";

import { Button, Card, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

import { formatCurrency, formatCurrencyCompact } from "@/libs/utils/format";

interface CostBreakdownWidgetProps {
  cogs: number;
  shippingCosts: number;
  totalAdSpend: number;
  transactionFees: number;
  customCosts: number;
  handlingFees: number;
  operatingCosts?: number;
  taxes?: number;
  totalRevenue?: number;
  currency?: string;
  loading?: boolean;
  showCostSetupWarning?: boolean;
}

export function CostBreakdownWidget({
  cogs,
  shippingCosts,
  totalAdSpend,
  transactionFees,
  customCosts,
  handlingFees,
  operatingCosts = 0,
  taxes = 0,
  totalRevenue = 0,
  currency = "USD",
  loading = false,
  showCostSetupWarning = false,
}: CostBreakdownWidgetProps) {
  const router = useRouter();

  // Calculate total costs and prepare chart data
  const { chartData, costBreakdown } = useMemo(() => {
    const costs = {
      totalAdSpend,
      cogs,
      shippingCosts,
      transactionFees,
      customCosts,
      handlingFees,
      operatingCosts,
      taxes,
    };

    const total = Object.values(costs).reduce((sum, val) => sum + val, 0);
    const profit = totalRevenue - total;

    // Prepare data for pie chart - only include non-zero values
    const pieData = [
      { name: "Ad Spend", value: totalAdSpend, fill: "#0070F3" },
      { name: "COGS", value: cogs, fill: "#10B981" },
      { name: "Shipping", value: shippingCosts, fill: "#F59E0B" },
      { name: "Transaction Fees", value: transactionFees, fill: "#8B5CF6" },
      { name: "Custom Costs", value: customCosts, fill: "#EC4899" },
      { name: "Handling", value: handlingFees, fill: "#14B8A6" },
      { name: "Operating", value: operatingCosts, fill: "#6366F1" },
      { name: "Taxes", value: taxes, fill: "#F97316" },
    ].filter((item) => item.value > 0);

    // Sort by value for better visualization
    pieData.sort((a, b) => b.value - a.value);

    // Prepare cost breakdown grid - always show all 8 categories
    const breakdown = [
      {
        key: "adSpend",
        label: "Ad Spend",
        value: totalAdSpend,
        percentage: total > 0 ? (totalAdSpend / total) * 100 : 0,
        color: "#0070F3",
        icon: "solar:ad-bold-duotone",
      },
      {
        key: "cogs",
        label: "COGS",
        value: cogs,
        percentage: total > 0 ? (cogs / total) * 100 : 0,
        color: "#10B981",
        icon: "solar:box-bold-duotone",
      },
      {
        key: "shipping",
        label: "Shipping",
        value: shippingCosts,
        percentage: total > 0 ? (shippingCosts / total) * 100 : 0,
        color: "#F59E0B",
        icon: "solar:delivery-bold-duotone",
      },
      {
        key: "transaction",
        label: "Transaction",
        value: transactionFees,
        percentage: total > 0 ? (transactionFees / total) * 100 : 0,
        color: "#8B5CF6",
        icon: "solar:card-bold-duotone",
      },
      {
        key: "custom",
        label: "Custom",
        value: customCosts,
        percentage: total > 0 ? (customCosts / total) * 100 : 0,
        color: "#EC4899",
        icon: "solar:settings-bold-duotone",
      },
      {
        key: "handling",
        label: "Handling",
        value: handlingFees,
        percentage: total > 0 ? (handlingFees / total) * 100 : 0,
        color: "#14B8A6",
        icon: "solar:hand-money-bold-duotone",
      },
      {
        key: "operating",
        label: "Operating",
        value: operatingCosts,
        percentage: total > 0 ? (operatingCosts / total) * 100 : 0,
        color: "#6366F1",
        icon: "solar:buildings-bold-duotone",
      },
      {
        key: "taxes",
        label: "Taxes",
        value: taxes,
        percentage: total > 0 ? (taxes / total) * 100 : 0,
        color: "#F97316",
        icon: "solar:document-text-bold-duotone",
      },
    ];

    // Sort by value descending for display order
    const sortedBreakdown = [...breakdown].sort((a, b) => b.value - a.value);

    return {
      netProfit: profit,
      chartData: pieData,
      costBreakdown: sortedBreakdown,
    };
  }, [
    cogs,
    shippingCosts,
    totalAdSpend,
    transactionFees,
    customCosts,
    handlingFees,
    operatingCosts,
    taxes,
    totalRevenue,
  ]);

  if (loading) {
    return (
      <Card className="p-5 bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50">
        <div className="animate-pulse">
          {/* Header Section */}
          <div className="mb-3.5 pb-3.5 border-b border-divider">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-default-200 rounded" />
              <div className="h-5 bg-default-200 rounded w-36" />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Pie Chart Section - Left Side */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center h-full">
              <div className="w-full h-full min-h-[200px] flex items-center justify-center">
                <div className="h-32 w-32 bg-default-200 rounded-full" />
              </div>
            </div>

            {/* Cost Stats List - Right Side */}
            <div className="lg:col-span-3 h-full">
              {/* Cost Items List - Show all 8 categories */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 h-full content-start">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-content1 border border-divider rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {/* Icon skeleton */}
                        <div className="w-9 h-9 rounded-lg bg-default-200" />
                        <div className="space-y-1">
                          {/* Label skeleton */}
                          <div className="h-4 bg-default-200 rounded w-16" />
                          {/* Percentage skeleton */}
                          <div className="h-3 bg-default-200 rounded w-10" />
                        </div>
                      </div>
                      {/* Value skeleton */}
                      <div className="h-4 bg-default-200 rounded w-12" />
                    </div>
                    {/* Progress Bar skeleton */}
                    <div className="mt-2.5">
                      <div className="w-full bg-default-100 rounded-full h-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50 h-full">
      {/* Header Section */}
      <div className="mb-3.5 pb-3.5 border-b border-divider flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Icon icon="solar:wallet-bold-duotone" width={20} className="text-primary" />
          <h3 className="text-lg font-medium text-default-900">Cost Breakdown</h3>
        </div>
        {showCostSetupWarning && (
          <Button
            color="warning"
            size="sm"
            startContent={<Icon icon="solar:settings-bold-duotone" />}
            variant="flat"
            onPress={() => router.push("/cost-management")}
          >
            Setup Costs
          </Button>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Pie Chart Section - Left Side */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center h-full">
          {chartData.length > 0 ? (
            <div className="w-full h-full min-h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: { value: number }) => {
                      const total = chartData.reduce(
                        (sum, item) => sum + item.value,
                        0
                      );
                      const percent = (entry.value / total) * 100;
                      return percent >= 3 ? `${percent.toFixed(0)}%` : "";
                    }}
                    outerRadius={70}
                    innerRadius={45}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-xs text-default-500">
                  Total
                </div>
                <div className="text-sm font-bold text-default-900">
                  {formatCurrencyCompact(
                    chartData.reduce((sum, item) => sum + item.value, 0),
                    currency
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
              <Icon
                className="text-default-300 mb-4"
                icon="solar:pie-chart-3-bold-duotone"
                width={48}
              />
              <p className="text-default-500">No cost data available</p>
            </div>
          )}
        </div>

        {/* Cost Stats List - Right Side */}
        <div className="lg:col-span-3 h-full">
          {/* Cost Items List - Show all categories with improved UX */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 h-full content-start">
            {costBreakdown.map((item) => (
              <div
                key={item.key}
                className="bg-white dark:bg-content1 border border-divider rounded-lg p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <Icon
                        icon={item.icon}
                        style={{ color: item.color }}
                        width={18}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-default-900 truncate">
                          {item.label}
                        </p>
                        <Tooltip
                          content={`${item.label} costs in the selected period`}
                          placement="top"
                          delay={200}
                        >
                          <span className="text-default-400 cursor-help">
                            <Icon icon="solar:info-circle-linear" width={12} />
                          </span>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-default-400">
                          {item.value > 0
                            ? `${item.percentage.toFixed(1)}%`
                            : "No costs"}
                        </span>
                        {/* Mini progress bar inline */}
                        {item.value > 0 && (
                          <div className="flex-1 max-w-[60px]">
                            <div
                              className="w-full bg-default-100 rounded-full h-0.5"
                            role="progressbar"
                            aria-valuenow={Number(item.percentage.toFixed(1))}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${item.label} share`}
                          >
                              <div
                                className="h-0.5 rounded-full transition-all"
                                style={{
                                  backgroundColor: item.color,
                                  opacity: 0.8,
                                  width: `${Math.min(item.percentage, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${item.value > 0 ? 'text-default-900' : 'text-default-400'}`}>
                      {item.value > 0
                        ? (Math.abs(item.value) >= 1000
                          ? formatCurrencyCompact(item.value, currency)
                          : formatCurrency(item.value, currency))
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
