"use client";

import { Card, Tab, Tabs, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { memo, useMemo, useState } from "react";

import { useUser } from "@/hooks";
import { getCurrencySymbol, formatNumber } from "@/libs/utils/format";

export interface CohortData {
  cohort: string;
  size: number;
  months: {
    month: number;
    retention: number;
    revenue?: number;
  }[];
}

interface CohortAnalysisProps {
  cohorts?: CohortData[];
}

export const CohortAnalysis = memo(function CohortAnalysis({
  cohorts,
}: CohortAnalysisProps) {
  const [view, setView] = useState<"retention" | "revenue">("retention");
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  const data = useMemo(() => cohorts ?? [], [cohorts]);

  // Minimal color function for heatmap
  const getHeatmapColor = (value: number | undefined, max: number = 100) => {
    if (value === undefined || Number.isNaN(value))
      return "bg-default-50 text-default-400";

    const denominator = max > 0 ? max : 1;
    const intensity = value / denominator;

    if (intensity >= 0.8) return "bg-primary-50 text-primary-600";
    if (intensity >= 0.6) return "bg-primary-50/70 text-primary-500";
    if (intensity >= 0.4) return "bg-default-100 text-default-600";
    if (intensity >= 0.2) return "bg-default-50 text-default-500";

    return "bg-default-50 text-default-400";
  };

  const maxRevenue = useMemo(() => {
    if (!data.length) return 0;

    const values = data.flatMap((c) => c.months.map((m) => m.revenue || 0));

    if (values.length === 0) return 0;

    return Math.max(...values);
  }, [data]);

  // Calculate average retention by month
  const avgRetentionByMonth = useMemo(() => {
    const monthAverages: Record<number, number> = {};

    for (let month = 0; month <= 5; month++) {
      const cohortsWithMonth = data.filter((c) =>
        c.months.some((m) => m.month === month)
      );

      if (cohortsWithMonth.length > 0) {
        const sum = cohortsWithMonth.reduce((acc, c) => {
          const monthData = c.months.find((m) => m.month === month);

          return acc + (monthData?.retention || 0);
        }, 0);

        monthAverages[month] = sum / cohortsWithMonth.length;
      }
    }

    return monthAverages;
  }, [data]);

  // Format display value
  const formatDisplayValue = (
    value: number | undefined,
    type: "retention" | "revenue"
  ) => {
    if (value === undefined || Number.isNaN(value)) return "-";

    if (type === "retention") {
      return `${value.toFixed(0)}%`;
    } else {
      if (value >= 1000) {
        return `${currencySymbol}${(value / 1000).toFixed(0)}K`;
      }

      return `${currencySymbol}${value.toFixed(0)}`;
    }
  };

  return (
    <Card className="p-6 bg-default-100/90 shadow-none dark:bg-content1 border border-default-50 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Tooltip
            closeDelay={0}
            content="Shows how many customers from each month come back to buy again. Higher percentages mean better customer loyalty."
            placement="top"
          >
            <h3 className="text-lg font-medium text-default-900 cursor-help inline-flex items-center gap-1">
              Cohort Analysis
              <Icon
                className="text-default-400"
                icon="solar:info-circle-linear"
                width={14}
              />
            </h3>
          </Tooltip>
          <p className="text-sm text-default-500 mt-0.5">
            Customer retention over time
          </p>
        </div>
        <Tabs
          selectedKey={view}
          radius="lg"
          color="primary"
          onSelectionChange={(key) => setView(key as "retention" | "revenue")}
        >
          <Tab key="retention" title="Retention %" />
          <Tab key="revenue" title="Revenue" />
        </Tabs>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-background rounded-xl p-3 border border-default-50">
          <p className="text-xs text-default-800 mb-1">Month 1 Avg</p>
          <p className="text-lg font-semibold text-default-900">
            {avgRetentionByMonth[1]?.toFixed(0) || "0"}%
          </p>
        </div>
        <div className="bg-background rounded-xl p-3 border border-default-50">
          <p className="text-xs text-default-800 mb-1">Month 3 Avg</p>
          <p className="text-lg font-semibold text-default-900">
            {avgRetentionByMonth[3]?.toFixed(0) || "0"}%
          </p>
        </div>
        <div className="bg-background rounded-xl p-3 border border-default-50">
          <p className="text-xs text-default-800 mb-1">Total Size</p>
          <p className="text-lg font-semibold text-default-900">
            {formatNumber(data.reduce((sum, c) => sum + c.size, 0))}
          </p>
        </div>
      </div>

      {/* Cohort Table */}
      <div className="overflow-x-auto bg-background rounded-xl border border-default-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-default-50">
              <th className="text-left p-3 font-medium text-default-800 sticky left-0 bg-background">
                Cohort
              </th>
              <th className="text-center p-3 font-medium text-default-600 min-w-[60px]">
                Size
              </th>
              {[0, 1, 2, 3, 4, 5].map((month) => (
                <th
                  key={month}
                  className="text-center p-3 font-medium text-default-800 min-w-[70px]"
                >
                  <span className="text-xs">Month {month}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  className="p-6 text-center text-xs text-default-500"
                  colSpan={8}
                >
                  No cohort activity yet. Once repeat purchases start, retention
                  will appear here.
                </td>
              </tr>
            ) : (
              data.map((cohort) => (
                <tr key={cohort.cohort} className="border-b border-default-50">
                  <td className="p-3 font-medium text-xs sticky left-0 bg-background text-default-800">
                    {cohort.cohort}
                  </td>
                  <td className="text-center p-3">
                    <span className="text-xs font-medium  text-default-800">
                      {cohort.size}
                    </span>
                  </td>
                  {[0, 1, 2, 3, 4, 5].map((monthIndex) => {
                    const monthData = cohort.months.find(
                      (m) => m.month === monthIndex
                    );

                    if (!monthData) {
                      return (
                        <td key={monthIndex} className="p-2 text-center">
                          <div className="text-default-800 text-xs">-</div>
                        </td>
                      );
                    }

                    const value =
                      view === "retention"
                        ? monthData.retention
                        : monthData.revenue;

                    const displayValue = formatDisplayValue(value, view);

                    return (
                      <td key={monthIndex} className="p-2">
                        <div
                          className={`rounded-lg p-1.5 text-center text-xs bg-default-100 font-medium ${getHeatmapColor(
                            value,
                            view === "retention" ? 100 : maxRevenue
                          )}`}
                        >
                          {displayValue}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-between text-xs text-default-800">
        <div className="flex items-center gap-3">
          <span>Scale:</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-3 rounded bg-primary-500 border border-default-50" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-3 rounded bg-default-300 border border-default-50" />
            <span>Low</span>
          </div>
        </div>
        <div>
          <span>
            Avg drop:{" "}
            {Math.abs(
              (avgRetentionByMonth[1] || 100) - (avgRetentionByMonth[3] || 0)
            ).toFixed(0)}
            % by Month 3
          </span>
        </div>
      </div>
    </Card>
  );
});
