"use client";

import { Button, Card, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { formatCurrency, formatCurrencyCompact } from "@/libs/utils/format";

type CostCategoryKey =
  | "adSpend"
  | "cogs"
  | "shipping"
  | "custom"
  | "handling"
  | "operating"
  | "taxes";

const COST_STYLES: Record<
  CostCategoryKey,
  { colorHex: string; iconBg: string; iconColor: string }
> = {
  adSpend: {
    colorHex: "#3B82F6",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600",
  },
  cogs: {
    colorHex: "#10B981",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600",
  },
  shipping: {
    colorHex: "#F59E0B",
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
  },
  custom: {
    colorHex: "#EC4899",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-600",
  },
  handling: {
    colorHex: "#14B8A6",
    iconBg: "bg-teal-500/10",
    iconColor: "text-teal-600",
  },
  operating: {
    colorHex: "#8B5CF6",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-600",
  },
  taxes: {
    colorHex: "#EF4444",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-600",
  },
};

interface CostBreakdownWidgetProps {
  cogs: number;
  shippingCosts: number;
  totalAdSpend: number;
  transactionFees: number;
  operatingCosts: number;
  handlingFees: number;
  taxes?: number;
  totalRevenue?: number;
  currency?: string;
  loading?: boolean;
  showCostSetupWarning?: boolean;
}

const normalizeCostValue = (value: number): number => {
  const numeric =
    typeof value === "number" && Number.isFinite(value) ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.abs(numeric);
};

export function CostBreakdownWidget({
  cogs = 0,
  shippingCosts = 0,
  totalAdSpend = 0,
  transactionFees: _transactionFees,
  operatingCosts = 0,
  handlingFees = 0,
  taxes = 0,
  totalRevenue: _totalRevenue = 0,
  currency = "USD",
  loading = false,
  showCostSetupWarning = false,
}: CostBreakdownWidgetProps) {
  const router = useRouter();

  // Calculate total costs and prepare chart data
  const { chartData, costBreakdown } = useMemo(() => {
    const breakdownConfig: Array<{
      key: CostCategoryKey;
      label: string;
      value: number;
      icon: string;
    }> = [
      {
        key: "adSpend",
        label: "Ad Spend",
        value: totalAdSpend,
        icon: "solar:graph-up-bold-duotone",
      },
      {
        key: "cogs",
        label: "COGS",
        value: cogs,
        icon: "solar:box-bold-duotone",
      },
      {
        key: "shipping",
        label: "Shipping",
        value: shippingCosts,
        icon: "solar:delivery-bold-duotone",
      },
      {
        key: "operating",
        label: "Operating Costs",
        value: operatingCosts,
        icon: "solar:settings-bold-duotone",
      },
      {
        key: "handling",
        label: "Handling",
        value: handlingFees,
        icon: "solar:hand-money-bold-duotone",
      },
      {
        key: "taxes",
        label: "Taxes",
        value: taxes,
        icon: "solar:document-text-bold-duotone",
      },
    ];

    const normalizedConfig = breakdownConfig.map((item) => ({
      ...item,
      value: normalizeCostValue(item.value),
    }));

    const totalCosts = normalizedConfig.reduce(
      (sum, item) => sum + item.value,
      0
    );

    const pieData = normalizedConfig
      .filter((item) => item.value > 0)
      .map((item) => ({
        name: item.label,
        value: item.value,
        fill: COST_STYLES[item.key].colorHex,
      }))
      .sort((a, b) => b.value - a.value);

    const breakdown = normalizedConfig
      .map((item) => {
        const styles = COST_STYLES[item.key];

        return {
          ...item,
          percentage: totalCosts > 0 ? (item.value / totalCosts) * 100 : 0,
          colorHex: styles.colorHex,
          iconBg: styles.iconBg,
          iconColor: styles.iconColor,
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      chartData: pieData,
      costBreakdown: breakdown,
    };
  }, [cogs, shippingCosts, totalAdSpend, operatingCosts, handlingFees, taxes]);

  if (loading) {
    return (
      <Card
        aria-busy="true"
        aria-live="polite"
        className="p-6 bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50"
        role="status"
      >
        <span className="sr-only">Loading cost breakdown…</span>
        <div className="animate-pulse">
          {/* Header Section */}
          <div className="mb-3.5 pb-3.5 border-b border-divider">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-default-200 rounded" />
              <div className="h-5 bg-default-200 rounded w-36" />
              <div className="ml-auto hidden sm:block h-7 w-24 bg-default-200 rounded" />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pie Chart Section - Left Side */}
            <div className="lg:col-span-1 flex flex-col  h-full">
              <div className="w-full h-full">
                <div className="relative">
                  <div className="h-40 w-40 bg-default-200 rounded-full" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="h-3 w-10 bg-default-300/60 rounded mb-1" />
                    <div className="h-4 w-16 bg-default-300/60 rounded" />
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Stats List - Right Side */}
            <div className="lg:col-span-2 h-full">
              {/* Cost Items List - Show all 6 categories */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 h-full content-start">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-background border border-default-100 rounded-xl p-3.5"
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
    <Card className="p-6 bg-default-100 dark:bg-content1 shadow-none border border-default-50 rounded-2xl h-full">
      {/* Header Section */}
      <div className="mb-4 pb-4 border-b border-divider flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center gap-2.5">
          <Icon
            icon="solar:wallet-bold-duotone"
            width={20}
            className="text-default-500"
          />
          <h3 className="text-lg font-semibold text-default-900">
            Cost Breakdown
          </h3>
        </div>
        {showCostSetupWarning && (
          <Button
            color="warning"
            size="sm"
            className="px-3 py-1"
            startContent={<Icon icon="solar:settings-bold-duotone" />}
            variant="flat"
            onPress={() => router.push("/cost-management")}
          >
            Setup Costs
          </Button>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie Chart Section - Left Side */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center h-full">
          {chartData.length > 0 ? (
            <div className="w-full h-full min-h-[220px] relative flex items-center justify-center px-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    fill="#2563EB"
                    dataKey="value"
                    strokeWidth={3}
                    stroke="hsl(var(--heroui-default-100))"
                  >
                    {chartData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6">
                <div className="text-[10px] font-bold text-default-400 uppercase tracking-wide mb-0.5">
                  Total Costs
                </div>
                <div className="font-bold text-default-900 break-all text-center leading-tight max-w-[120px]">
                  {(() => {
                    const total = chartData.reduce(
                      (sum, item) => sum + item.value,
                      0
                    );
                    return Math.abs(total) >= 1000000
                      ? formatCurrencyCompact(total, currency)
                      : formatCurrency(total, currency);
                  })()}
                </div>
                <div className="text-[10px] text-default-400 mt-0.5">
                  {chartData.length}{" "}
                  {chartData.length === 1 ? "category" : "categories"}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center">
              <div className="w-16 h-16 rounded-2xl bg-default-100 flex items-center justify-center mb-4">
                <Icon
                  className="text-default-400"
                  icon="solar:pie-chart-3-bold-duotone"
                  width={32}
                />
              </div>
              <p className="text-sm font-semibold text-default-700 mb-1">
                No cost data available
              </p>
              <p className="text-xs text-default-500">
                Add cost data to see breakdown
              </p>
            </div>
          )}
        </div>

        {/* Cost Stats List - Right Side */}
        <div className="lg:col-span-2 h-full">
          {/* Cost Items List - Show all categories with improved UX */}
          <div className="grid grid-cols-1 items-center justify-center sm:grid-cols-2 gap-2 h-full ">
            {costBreakdown.map((item) => (
              <div
                key={item.key}
                className="bg-background border border-default-100 rounded-xl p-3.5 hover:bg-default-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-1">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                      <Icon
                        icon={item.icon}
                        className={item.iconColor}
                        width={20}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-default-900 truncate">
                          {item.label}
                        </p>
                        <Tooltip
                          content={`${item.label} costs in the selected period`}
                          placement="top"
                          delay={200}
                        >
                          <span className="text-default-500 cursor-help hover:text-default-700 transition-colors">
                            <Icon
                              icon="solar:info-circle-bold-duotone"
                              width={14}
                            />
                          </span>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-default-500">
                          {item.value > 0
                            ? `${item.percentage.toFixed(1)}%`
                            : "No costs"}
                        </span>
                        {/* Mini progress bar inline */}
                        {item.value > 0 && (
                          <div className="flex-1 max-w-[60px]">
                            <div
                              className="w-full bg-default-200 rounded-full h-1"
                              role="progressbar"
                              aria-valuenow={Number(item.percentage.toFixed(1))}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${item.label} share`}
                            >
                              <div
                                className="h-1 rounded-full transition-all"
                                style={{
                                  backgroundColor: item.colorHex,
                                  opacity: 0.9,
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
                    <p
                      className={`text-xs font-bold ${
                        item.value > 0 ? "text-default-900" : "text-default-400"
                      }`}
                    >
                      {item.value > 0
                        ? Math.abs(item.value) >= 1000000
                          ? formatCurrencyCompact(item.value, currency)
                          : formatCurrency(item.value, currency)
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
