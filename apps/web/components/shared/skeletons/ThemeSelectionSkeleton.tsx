"use client";

import { Card, CardBody, Skeleton } from "@heroui/react";

export function ThemeSelectionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-32 mb-2 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-lg" />
      </div>

      <Skeleton className="h-px w-full rounded-lg" />

      {/* Theme Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card
            key={`theme-skeleton-${i + 1}`}
            className="border-2 border-default-200"
          >
            <CardBody className="p-4">
              {/* Preview Window */}
              <div className="rounded-lg p-3 mb-4 border border-divider bg-default-50">
                <div className="space-y-2">
                  <Skeleton className="h-2 w-16 rounded" />
                  <Skeleton className="h-2 w-24 rounded" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 flex-1 rounded" />
                  </div>
                </div>
              </div>

              {/* Label and Description */}
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-16 rounded-lg" />
                  <Skeleton className="h-3 w-24 rounded-lg" />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-default-50 rounded-lg p-4">
        <div className="flex gap-3">
          <Skeleton className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32 rounded-lg" />
            <Skeleton className="h-3 w-full rounded-lg" />
            <Skeleton className="h-3 w-3/4 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThemeSelectionSkeleton;
