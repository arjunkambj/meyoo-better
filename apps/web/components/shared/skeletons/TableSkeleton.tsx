"use client";

import { Card } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  showPagination?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showHeader = true,
  showPagination = true,
  className = "",
}: TableSkeletonProps) {
  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
      )}

      {/* Table Headers */}
      <div
        className="grid gap-2 mb-2"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`skeleton-header-${i + 1}`}
            className="h-6 rounded-lg"
          />
        ))}
      </div>

      {/* Table Rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`skeleton-row-${rowIndex + 1}`}
            className="grid gap-2 py-2 border-b border-divider last:border-0"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`skeleton-cell-${rowIndex}-${colIndex + 1}`}
                className="h-5 rounded-lg"
                style={{ width: `${70 + Math.random() * 30}%` }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-divider">
          <Skeleton className="h-5 w-32 rounded-lg" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={`skeleton-page-${i + 1}`}
                className="h-8 w-8 rounded-lg"
              />
            ))}
          </div>
          <Skeleton className="h-5 w-24 rounded-lg" />
        </div>
      )}
    </Card>
  );
}

export default TableSkeleton;
