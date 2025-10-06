"use client";

import { Card, cn, Tooltip, Divider, Skeleton } from "@heroui/react";
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

type KPISize = NonNullable<KPIProps["size"]>;

export interface KPISkeletonProps {
  size?: KPISize;
  className?: string;
  showIcon?: boolean;
  showSparkline?: boolean;
  showChangeIndicator?: boolean;
}

const KPI_CARD_BASE_CLASS =
  "bg-content2 dark:bg-content1 rounded-2xl border border-default-100 w-full overflow-hidden shadow-none";
const KPI_CARD_PADDING = "py-4 px-5";
const KPI_SIZE_CLASSES: Record<KPISize, string> = {
  small: "col-span-1",
  medium: "col-span-1 sm:col-span-2",
  large: "col-span-1 sm:col-span-2 lg:col-span-3",
};
const KPI_VALUE_TEXT_CLASSES: Record<KPISize, string> = {
  small: "text-2xl",
  medium: "text-3xl",
  large: "text-4xl",
};
const KPI_VALUE_SKELETON_WIDTHS: Record<KPISize, string> = {
  small: "w-28",
  medium: "w-36",
  large: "w-48",
};
const KPI_VALUE_SKELETON_HEIGHTS: Record<KPISize, string> = {
  small: "h-7",
  medium: "h-9",
  large: "h-10",
};
const KPI_ICON_SKELETON_SIZES: Record<KPISize, string> = {
  small: "h-5 w-5",
  medium: "h-6 w-6",
  large: "h-7 w-7",
};
const KPI_SPARKLINE_SKELETON_HEIGHTS: Record<KPISize, string> = {
  small: "h-0",
  medium: "h-12",
  large: "h-14",
};
const KPI_CHANGE_PRIMARY_WIDTH: Record<KPISize, string> = {
  small: "w-20",
  medium: "w-24",
  large: "w-28",
};
const KPI_CHANGE_SECONDARY_WIDTH: Record<KPISize, string> = {
  small: "w-14",
  medium: "w-16",
  large: "w-18",
};

export const KPISkeleton = React.memo(function KPISkeleton({
  size = "small",
  className,
  showIcon = true,
  showSparkline = false,
  showChangeIndicator = true,
}: KPISkeletonProps) {
  const renderSparkline = showSparkline && size !== "small";

  return (
    <Card
      className={cn(
        KPI_CARD_BASE_CLASS,
        KPI_CARD_PADDING,
        KPI_SIZE_CLASSES[size],
        className
      )}
      shadow="none"
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          {showIcon && (
            <Skeleton
              className={cn(
                "shrink-0 rounded-md",
                KPI_ICON_SKELETON_SIZES[size]
              )}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <Skeleton
            className={cn(
              "rounded-lg",
              KPI_VALUE_SKELETON_HEIGHTS[size],
              KPI_VALUE_SKELETON_WIDTHS[size]
            )}
          />

          {renderSparkline && (
            <Skeleton
              className={cn(
                "mt-3 w-full rounded-lg",
                KPI_SPARKLINE_SKELETON_HEIGHTS[size]
              )}
            />
          )}
        </div>

        <Divider className="mt-3.5 mb-1.5 bg-default-200" />

        {showChangeIndicator && (
          <div className="flex items-center justify-between">
            <Skeleton
              className={cn("h-3 rounded-md", KPI_CHANGE_PRIMARY_WIDTH[size])}
            />
            <Skeleton
              className={cn("h-3 rounded-md", KPI_CHANGE_SECONDARY_WIDTH[size])}
            />
          </div>
        )}
      </div>
    </Card>
  );
});

const KPI = React.memo(function KPI({
  title,
  value,
  change,
  changeType,
  icon,
  iconColor = "text-default-500",
  loading = false,
  className,
  size = "small",
  sparklineData,
  showSparkline = false,
  tooltip,
}: KPIProps) {
  const showChangeSkeleton = change !== undefined && change !== null;

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
      <KPISkeleton
        className={className}
        showChangeIndicator={showChangeSkeleton}
        showIcon={Boolean(icon)}
        showSparkline={showSparkline && size !== "small"}
        size={size}
      />
    );
  }

  const cardContent = (
    <Card
      className={cn(
        KPI_CARD_BASE_CLASS,
        KPI_CARD_PADDING,
        KPI_SIZE_CLASSES[size],
        className
      )}
      shadow="none"
    >
      <div className="flex h-full min-w-0 flex-col justify-between">
        {/* Header with title and icon */}
        <div className="flex items-start justify-between mb-3 gap-3">
          <span className="text-sm font-semibold text-default-700 truncate flex-1">
            {title}
          </span>
          {icon && (
            <div className="shrink-0">
              <Icon className={iconColor} icon={icon} width={18} />
            </div>
          )}
        </div>

        {/* Value and subtitle */}
        <div className="flex-1 min-w-0 mb-3">
          <div
            className={cn(
              "font-bold tracking-tight tabular-nums text-default-900 truncate",
              KPI_VALUE_TEXT_CLASSES[size]
            )}
          >
            {value}
          </div>

          {/* Sparkline for medium/large sizes */}
          {showSparkline && sparklineData && size !== "small" && (
            <div className="mt-3"></div>
          )}
        </div>

        {/* Change indicator at bottom */}
        {changeData && (
          <>
            <Divider className="mb-2 bg-default-200" />
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-default-500">
                vs last period
              </div>
              <div
                className={cn(
                  "text-xs font-semibold",
                  changeData.type === "positive"
                    ? "text-success-600"
                    : changeData.type === "neutral"
                      ? "text-warning-600"
                      : "text-danger-600"
                )}
              >
                <span>{changeData.text}</span>
              </div>
            </div>
          </>
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
