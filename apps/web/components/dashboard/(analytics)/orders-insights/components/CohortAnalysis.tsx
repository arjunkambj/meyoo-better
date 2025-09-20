"use client";

import { Card, Tab, Tabs, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { memo, useMemo, useState } from "react";

import { useUser } from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";

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

  const defaultCohorts: CohortData[] = [
    {
      cohort: "Jan 2024",
      size: 245,
      months: [
        { month: 0, retention: 100, revenue: 45000 },
        { month: 1, retention: 68, revenue: 38000 },
        { month: 2, retention: 52, revenue: 32000 },
        { month: 3, retention: 45, revenue: 28000 },
        { month: 4, retention: 42, revenue: 26000 },
        { month: 5, retention: 40, revenue: 25000 },
      ],
    },
    {
      cohort: "Feb 2024",
      size: 198,
      months: [
        { month: 0, retention: 100, revenue: 38000 },
        { month: 1, retention: 72, revenue: 32000 },
        { month: 2, retention: 58, revenue: 28000 },
        { month: 3, retention: 48, revenue: 24000 },
        { month: 4, retention: 44, revenue: 22000 },
      ],
    },
    {
      cohort: "Mar 2024",
      size: 312,
      months: [
        { month: 0, retention: 100, revenue: 52000 },
        { month: 1, retention: 75, revenue: 45000 },
        { month: 2, retention: 62, revenue: 38000 },
        { month: 3, retention: 55, revenue: 34000 },
      ],
    },
    {
      cohort: "Apr 2024",
      size: 267,
      months: [
        { month: 0, retention: 100, revenue: 48000 },
        { month: 1, retention: 78, revenue: 42000 },
        { month: 2, retention: 65, revenue: 36000 },
      ],
    },
    {
      cohort: "May 2024",
      size: 289,
      months: [
        { month: 0, retention: 100, revenue: 51000 },
        { month: 1, retention: 80, revenue: 46000 },
      ],
    },
    {
      cohort: "Jun 2024",
      size: 334,
      months: [{ month: 0, retention: 100, revenue: 58000 }],
    },
  ];

  const data = cohorts || defaultCohorts;

  // Softer color function matching Customer Journey style
  const getHeatmapColor = (value: number | undefined, max: number = 100) => {
    if (value === undefined || Number.isNaN(value))
      return "bg-default-100 text-default-400";

    const intensity = value / max;

    if (intensity >= 0.8) return "bg-success/20 text-success-600";
    if (intensity >= 0.6) return "bg-primary/20 text-primary-600";
    if (intensity >= 0.4) return "bg-warning/20 text-warning-600";
    if (intensity >= 0.2) return "bg-default-200 text-default-600";

    return "bg-danger/10 text-danger-500";
  };

  const maxRevenue = useMemo(
    () => Math.max(...data.flatMap((c) => c.months.map((m) => m.revenue || 0))),
    [data]
  );

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
    <Card className="p-5 border bg-default-50 border-default-200  rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <Tooltip
            closeDelay={0}
            content="Shows how many customers from each month come back to buy again. Higher percentages mean better customer loyalty."
            placement="top"
          >
            <h3 className="text-lg font-semibold cursor-help inline-flex items-center gap-1">
              Cohort Analysis
              <Icon
                className="text-default-400"
                icon="solar:info-circle-linear"
                width={16}
              />
            </h3>
          </Tooltip>
          <p className="text-sm text-default-500 mt-1">
            Track how customers behave over time
          </p>
        </div>
        <Tabs
          selectedKey={view}
          size="sm"
          onSelectionChange={(key) => setView(key as "retention" | "revenue")}
        >
          <Tab key="retention" title="Retention %" />
          <Tab key="revenue" title="Revenue" />
        </Tabs>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Tooltip
          closeDelay={0}
          content="Average percentage of customers still active after 1 month"
        >
          <div className="bg-default-100 rounded-lg p-3 border border-default-200/50 cursor-help">
            <p className="text-xs text-default-500 mb-1">Avg 1st Month</p>
            <p className="text-lg font-bold">
              {avgRetentionByMonth[1]?.toFixed(0) || "0"}%
            </p>
          </div>
        </Tooltip>
        <Tooltip
          closeDelay={0}
          content="Average percentage of customers still active after 3 months"
        >
          <div className="bg-default-100 rounded-lg p-3 border border-default-200/50 cursor-help">
            <p className="text-xs text-default-500 mb-1">Avg 3rd Month</p>
            <p className="text-lg font-bold">
              {avgRetentionByMonth[3]?.toFixed(0) || "0"}%
            </p>
          </div>
        </Tooltip>
        <Tooltip
          closeDelay={0}
          content="Total number of customers in all cohorts combined"
        >
          <div className="bg-default-100 rounded-lg p-3 border border-default-200/50 cursor-help">
            <p className="text-xs text-default-500 mb-1">Total Cohort Size</p>
            <p className="text-lg font-bold">
              {data.reduce((sum, c) => sum + c.size, 0).toLocaleString()}
            </p>
          </div>
        </Tooltip>
      </div>

      {/* Cohort Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-default-200/50">
              <th className="text-left p-2 font-medium text-default-600 sticky left-0 bg-content1">
                Cohort
              </th>
              <th className="text-center p-2 font-medium text-default-600 min-w-[60px]">
                Size
              </th>
              {[0, 1, 2, 3, 4, 5].map((month) => (
                <th
                  key={month}
                  className="text-center p-2 font-medium text-default-600 min-w-[70px]"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs">M{month}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((cohort) => (
              <tr
                key={cohort.cohort}
                className="border-b border-default-200/50 hover:bg-default-50/50 transition-colors"
              >
                <td className="p-2 font-medium text-xs sticky left-0 bg-content1">
                  {cohort.cohort}
                </td>
                <td className="text-center p-2">
                  <span className="text-xs font-medium">{cohort.size}</span>
                </td>
                {[0, 1, 2, 3, 4, 5].map((monthIndex) => {
                  const monthData = cohort.months.find(
                    (m) => m.month === monthIndex
                  );

                  if (!monthData) {
                    return (
                      <td key={monthIndex} className="p-1 text-center">
                        <div className="text-default-300 text-xs">-</div>
                      </td>
                    );
                  }

                  const value =
                    view === "retention"
                      ? monthData.retention
                      : monthData.revenue;

                  const displayValue = formatDisplayValue(value, view);

                  return (
                    <td key={monthIndex} className="p-1">
                      <div
                        className={`rounded-md p-2 text-center text-xs font-medium transition-all hover:scale-105 ${getHeatmapColor(
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-default-200/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-xs text-default-500">Performance:</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-success/20 border border-success/30" />
                <span className="text-xs">Excellent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-warning/20 border border-warning/30" />
                <span className="text-xs">Average</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-danger/10 border border-danger/20" />
                <span className="text-xs">Needs Attention</span>
              </div>
            </div>
          </div>

          <Tooltip
            closeDelay={0}
            content="This shows the average customer drop-off between month 1 and month 3"
          >
            <div className="flex items-center gap-2 cursor-help">
              <Icon
                className="text-default-400"
                icon="solar:chart-square-linear"
                width={16}
              />
              <span className="text-xs text-default-500">
                Avg drop:{" "}
                {Math.abs(
                  (avgRetentionByMonth[1] || 100) -
                    (avgRetentionByMonth[3] || 0)
                ).toFixed(0)}
                % by M3
              </span>
            </div>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
});
