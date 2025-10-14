"use client";

import { Card } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
interface ChartSkeletonProps {
  height?: number | string;
  showTitle?: boolean;
  showLegend?: boolean;
  type?: "bar" | "line" | "pie" | "area" | "mixed";
  className?: string;
}

export function ChartSkeleton({
  height = 300,
  showTitle = true,
  showLegend = true,
  type = "bar",
  className = "",
}: ChartSkeletonProps) {
  const renderChartBars = () => {
    const barCount = type === "pie" ? 1 : 8;
    const barHeight = typeof height === "number" ? height - 80 : 220;

    if (type === "pie") {
      return (
        <div
          className="flex items-center justify-center"
          style={{ height: barHeight }}
        >
          <Skeleton
            className="rounded-full"
            style={{ width: 200, height: 200 }}
          />
        </div>
      );
    }

    return (
      <div
        className="flex items-end justify-between gap-2"
        style={{ height: barHeight }}
      >
        {Array.from({ length: barCount }).map((_, i) => (
          <Skeleton
            key={`chart-bar-${type}-${i + 1}`}
            className="flex-1 rounded-t-lg"
            style={{
              height: `${30 + Math.random() * 70}%`,
              opacity: 0.6 + Math.random() * 0.4,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className={`p-6 ${className}`}>
      {/* Title */}
      {showTitle && (
        <div className="mb-4">
          <Skeleton className="h-6 w-48 mb-2 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
      )}

      {/* Chart Area */}
      <div style={{ height: typeof height === "number" ? height : height }}>
        {/* Y-axis labels */}
        <div className="flex">
          <div className="flex flex-col justify-between mr-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={`chart-y-axis-${i + 1}`}
                className="h-3 w-8 rounded"
              />
            ))}
          </div>

          {/* Chart content */}
          <div className="flex-1">
            {renderChartBars()}

            {/* X-axis labels */}
            <div className="flex justify-between mt-2">
              {Array.from({ length: type === "pie" ? 0 : 8 }).map((_, i) => (
                <Skeleton
                  key={`chart-x-axis-${i + 1}`}
                  className="h-3 w-12 rounded"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-center gap-4 mt-4">
          {Array.from({ length: type === "pie" ? 4 : 3 }).map((_, i) => (
            <div
              key={`chart-legend-${type}-${i + 1}`}
              className="flex items-center gap-2"
            >
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default ChartSkeleton;
