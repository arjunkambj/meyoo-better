"use client";

import { Card, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useMemo } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
  iconColor?: string;
  loading?: boolean;
  className?: string;
  size?: "small" | "medium" | "large";
}

const KPICard = React.memo(function KPICard({
  title,
  value,
  change,
  changeLabel = "vs last period",
  icon,
  iconColor = "text-foreground",
  loading = false,
  className,
  size = "small",
}: KPICardProps) {
  const paddingClass = "p-5";

  const changeData = useMemo(() => {
    if (change === undefined || change === null) return null;
    const isPositive = change >= 0;
    
    return {
      value: change,
      text: `${isPositive ? "+" : ""}${Math.abs(change).toFixed(1)}%`,
      type: isPositive ? "positive" : "negative",
      trend: isPositive ? "up" : "down",
    };
  }, [change]);

  const sizeClasses = {
    small: "col-span-1",
    medium: "col-span-1 sm:col-span-2",
    large: "col-span-1 sm:col-span-2 lg:col-span-3",
  };

  const valueSizeClasses = {
    small: "text-2xl",
    medium: "text-3xl",
    large: "text-4xl",
  };

  if (loading) {
    return (
      <Card
        className={cn(
          "bg-content1 rounded-2xl border border-divider",
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

  return (
    <Card
      className={cn(
        "bg-content1 rounded-2xl border border-divider w-full overflow-hidden",
        paddingClass,
        sizeClasses[size],
        className
      )}
    >
      <div className="flex flex-col h-full min-w-0 justify-between">
        {/* Header with title and icon */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <span className="text-sm text-default-500 font-normal truncate flex-1">
            {title}
          </span>
          {icon && (
            <Icon
              className={cn("text-foreground", iconColor)}
              icon={icon}
              width={20}
            />
          )}
        </div>

        {/* Value */}
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-bold tracking-tight tabular-nums text-foreground truncate",
              valueSizeClasses[size]
            )}
          >
            {value}
          </div>
        </div>

        {/* Change indicator at bottom */}
        {changeData && (
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-default-400">{changeLabel}</div>
            <div
              className={cn(
                "flex items-center gap-0.5 text-sm font-medium",
                changeData.type === "positive" ? "text-success" : "text-danger"
              )}
            >
              <Icon
                icon={
                  changeData.trend === "up"
                    ? "solar:arrow-up-linear"
                    : "solar:arrow-down-linear"
                }
                width={14}
              />
              <span>{changeData.text}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

export default KPICard;
