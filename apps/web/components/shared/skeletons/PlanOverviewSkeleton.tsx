"use client";

import { Skeleton } from "@heroui/react";

export function PlanOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-6 w-32 mb-2 rounded-lg" />
          <Skeleton className="h-4 w-56 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <Skeleton className="h-px w-full rounded-lg" />

      {/* Usage and Billing Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Monthly Usage */}
        <div>
          <Skeleton className="h-4 w-24 mb-2 rounded-lg" />
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-3 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-2 w-full rounded-lg" />
          </div>
        </div>

        {/* Billing Details */}
        <div>
          <Skeleton className="h-4 w-24 mb-2 rounded-lg" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16 rounded-lg" />
              <Skeleton className="h-4 w-20 rounded-lg" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="h-4 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Features Box */}
      <div className="bg-content2 rounded-lg p-4">
        <Skeleton className="h-4 w-32 mb-3 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`feature-${i + 1}`} className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded-full" />
              <Skeleton className="h-3 w-full max-w-[150px] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlanOverviewSkeleton;
