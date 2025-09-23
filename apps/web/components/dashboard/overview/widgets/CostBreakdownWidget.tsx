"use client";

import { Button, Card } from "@heroui/react";
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
    totalRevenue,
  ]);

  if (loading) {
    return (
      <Card className="p-6 bg-content2/90 dark:bg-content1 rounded-2xl border border-default-200/50">
        <div className="animate-pulse">
          {/* Header Section */}
          <div className="mb-3 pb-3 border-b border-divider">
            <div className="h-4 bg-default-200 rounded w-36" />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Pie Chart Section - Left Side */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center">
              <div className="w-full h-[300px] flex items-center justify-center">
                <div className="h-52 w-52 bg-default-200 rounded-full" />
              </div>
            </div>

            {/* Cost Stats List - Right Side */}
            <div className="lg:col-span-3 space-y-4">
              {/* Cost Items List - Show all 8 categories */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
    <Card className="p-6 bg-content2/90 dark:bg-content1 rounded-2xl border border-default-200/50">
      {/* Header Section */}
      <div className="mb-2.5 pb-2.5 border-b border-divider flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <h3 className="text-lg font-medium text-default-900">Cost Breakdown</h3>
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pie Chart Section - Left Side */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center">
          {chartData.length > 0 ? (
            <div className="w-full h-[300px] relative">
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
                    outerRadius={100}
                    innerRadius={66}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload as {
                          name: string;
                          value: number;
                          fill: string;
                        };
                        const total = chartData.reduce(
                          (sum, item) => sum + item.value,
                          0
                        );
                        const percentage =
                          total > 0 ? (data.value / total) * 100 : 0;

                        return (
                          <div className="bg-white dark:bg-content1 border border-divider rounded-lg p-3 shadow-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: data.fill }}
                              />
                              <span className="text-sm font-semibold">
                                {data.name}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="font-medium">
                                  {Math.abs(data.value) >= 1000
                                    ? formatCurrencyCompact(
                                        data.value,
                                        currency
                                      )
                                    : formatCurrency(data.value, currency)}
                                </span>
                              </div>
                              <div className="text-xs text-default-500">
                                {percentage.toFixed(1)}% of total costs
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-xs text-default-500 font-semibold">
                  Total Costs
                </div>
                <div className="text-base font-bold text-default-900">
                  {formatCurrencyCompact(
                    chartData.reduce((sum, item) => sum + item.value, 0),
                    currency
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
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
        <div className="lg:col-span-3 space-y-4">
          {/* Cost Items List - Show all 8 categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {costBreakdown.map((item) => (
              <div
                key={item.key}
                className="bg-white dark:bg-content1 border border-divider rounded-xl p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-default-50 dark:bg-default-100 flex items-center justify-center">
                      <Icon
                        icon={item.icon}
                        style={{ color: item.color }}
                        width={18}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-default-900">
                        {item.label}
                      </p>
                      <p className="text-xs text-default-500">
                        {item.value > 0
                          ? `${item.percentage.toFixed(1)}%`
                          : "0%"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-default-900">
                      {Math.abs(item.value) >= 1000
                        ? formatCurrencyCompact(item.value, currency)
                        : formatCurrency(item.value, currency)}
                    </p>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="mt-2.5">
                  <div
                    className="w-full bg-default-100 rounded-full h-1"
                    role="progressbar"
                    aria-valuenow={Number(item.percentage.toFixed(1))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.label} share of total costs`}
                  >
                    <div
                      className="h-1 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        width:
                          item.value > 0
                            ? `${Math.min(item.percentage, 100)}%`
                            : "0%",
                      }}
                    />
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
