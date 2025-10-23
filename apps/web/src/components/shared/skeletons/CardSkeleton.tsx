"use client";

import { Card } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
interface CardSkeletonProps {
  showIcon?: boolean;
  showChart?: boolean;
  showSubtitle?: boolean;
  className?: string;
  variant?: "default" | "compact" | "detailed";
}

export function CardSkeleton({
  showIcon = true,
  showChart = false,
  showSubtitle = true,
  className = "",
  variant = "default",
}: CardSkeletonProps) {
  if (variant === "compact") {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1 rounded-lg" />
            <Skeleton className="h-6 w-32 rounded-lg" />
          </div>
          {showIcon && <Skeleton className="h-8 w-8 rounded-lg" />}
        </div>
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <Skeleton className="h-5 w-32 mb-2 rounded-lg" />
            <Skeleton className="h-8 w-40 rounded-lg" />
          </div>
          {showIcon && <Skeleton className="h-10 w-10 rounded-lg" />}
        </div>

        {showSubtitle && (
          <div className="space-y-2 mb-4">
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
          </div>
        )}

        {showChart && (
          <div className="h-24 flex items-end justify-between gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton
                key={`card-chart-bar-${i + 1}`}
                className="flex-1 rounded-t"
                style={{ height: `${30 + Math.random() * 70}%` }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-divider">
          <Skeleton className="h-4 w-20 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded-lg" />
        </div>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-28 mb-2 rounded-lg" />
          <Skeleton className="h-8 w-36 mb-1 rounded-lg" />
          {showSubtitle && <Skeleton className="h-4 w-24 rounded-lg" />}
        </div>
        {showIcon && <Skeleton className="h-10 w-10 rounded-full" />}
      </div>

      {showChart && (
        <div className="mt-4 h-16 flex items-end justify-between gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={`card-mini-bar-${i + 1}`}
              className="flex-1 rounded-t"
              style={{ height: `${30 + Math.random() * 70}%` }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default CardSkeleton;
