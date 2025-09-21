"use client";

import { Card, cn, Tooltip, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useMemo } from "react";

export interface KPIProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string | number;
  changeType?: "positive" | "neutral" | "negative";
  icon?: string;
  iconColor?: string;
  iconBgColor?: string;
  showIconBackground?: boolean;
  loading?: boolean;
  className?: string;
  size?: "small" | "medium" | "large";
  sparklineData?: number[];
  showSparkline?: boolean;
  trendData?: Array<{ date: string; value: number }>;
  tooltip?: string;
}

const KPI = React.memo(function KPI({
  title,
  value,
  change,
  changeType,
  icon,
  iconColor = "text-primary",
  loading = false,
  className,
  size = "small",
  sparklineData,
  showSparkline = false,
  tooltip,
}: KPIProps) {
  // Unified padding for all sizes (matching overview widgets)
  const paddingClass = "py-4 px-5";

  const changeData = useMemo(() => {
    if (change === undefined || change === null) return null;

    const changeValue =
      typeof change === "number" ? change : parseFloat(change);
    const isPositive = changeValue >= 0;

    let actualChangeType = changeType;

    if (!changeType) {
      actualChangeType = isPositive ? "positive" : "negative";
    }

    return {
      value: changeValue,
      text: `${isPositive ? "+" : ""}${changeValue.toFixed(1)}%`,
      type: actualChangeType,
      trend: isPositive ? "up" : "down",
    };
  }, [change, changeType]);

  // Generate simple sparkline path
  const _sparklinePath = useMemo(() => {
    if (!sparklineData || sparklineData.length < 2) return null;

    const width = size === "large" ? 120 : 80;
    const height = 30;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;

    const points = sparklineData
      .map((val, i) => {
        const x = (i / (sparklineData.length - 1)) * width;
        const y = height - ((val - min) / range) * height;

        return `${x},${y}`;
      })
      .join(" ");

    return `M ${points}`;
  }, [sparklineData, size]);

  if (loading) {
    return (
      <Card
        className={cn(
          "bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50",
          paddingClass,
          className
        )}
        shadow="none"
      >
        <div className="animate-pulse space-y-4">
          <div className="flex items-start justify-between">
            <div className="h-4 bg-default-200 rounded w-24" />
            <div className="w-5 h-5 rounded bg-default-200" />
          </div>
          <div className="space-y-3">
            <div className="h-9 bg-default-200 rounded w-32" />
            <div className="h-3 bg-default-200 rounded w-20" />
          </div>
          <div className="flex justify-end">
            <div className="h-4 bg-default-200 rounded w-16" />
          </div>
        </div>
      </Card>
    );
  }

  // Size-based grid classes
  const sizeClasses = {
    small: "col-span-1",
    medium: "col-span-1 sm:col-span-2",
    large: "col-span-1 sm:col-span-2 lg:col-span-3",
  };

  // Size-based text sizes
  const valueSizeClasses = {
    small: "text-2xl",
    medium: "text-3xl",
    large: "text-4xl",
  };

  const cardContent = (
    <Card
      className={cn(
        "bg-content2/90 dark:bg-content1 rounded-2xl border border-default-100  w-full overflow-hidden",
        paddingClass,
        sizeClasses[size],
        className
      )}
    >
      <div className="flex flex-col h-full  min-w-0 justify-between">
        {/* Header with title and icon */}
        <div className="flex items-start justify-between mb-2.5 gap-2">
          <span className="text-sm font-medium text-default-800 font-medium truncate flex-1">
            {title}
          </span>
          {icon && <Icon className={iconColor} icon={icon} width={20} />}
        </div>

        {/* Value and subtitle */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-bold tracking-tight tabular-nums text-default-800 truncate",
              valueSizeClasses[size]
            )}
          >
            {value}
          </div>

          {/* Sparkline for medium/large sizes */}
          {showSparkline && sparklineData && size !== "small" && (
            <div className="mt-3"></div>
          )}
        </div>

        <Divider className="mb-1.5 bg-default-200 mt-3.5" />

        {/* Change indicator at bottom */}
        {changeData && (
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-default-500">vs last period</div>
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                changeData.type === "positive"
                  ? "text-success"
                  : changeData.type === "neutral"
                    ? "text-warning"
                    : "text-danger"
              )}
            >
              <span>{changeData.text}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <Tooltip closeDelay={0} content={tooltip}>
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
});

export default KPI;
