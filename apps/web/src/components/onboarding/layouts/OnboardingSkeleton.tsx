"use client";

import { Skeleton } from "@heroui/skeleton";
import { memo } from "react";
// import { TOTAL_STEPS as _TOTAL_STEPS } from "@/constants/onboarding";

interface OnboardingSkeletonProps {
  currentStep: number;
}

export const OnboardingSkeleton = memo(function OnboardingSkeleton({
  currentStep: _currentStep,
}: OnboardingSkeletonProps) {
  return (
    <div className="flex h-screen bg-background">
      <main className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background border-b border-divider">
          <div className="px-4 sm:px-6 py-4 max-w-3xl mx-auto w-full">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-28 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <div className="mt-2">
              <Skeleton className="h-5 w-48 rounded" />
            </div>
            <div className="mt-3">
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-[600px] px-4 sm:px-6 py-6 sm:py-8 md:py-10">
            <div className="max-w-3xl mx-auto w-full space-y-6">
              <Skeleton className="h-8 w-64 rounded-lg" />
              <Skeleton className="h-4 w-96 rounded" />
              <div className="grid gap-4 mt-8">
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
              <div className="flex justify-end mt-8">
                <Skeleton className="h-10 w-64 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
});

OnboardingSkeleton.displayName = "OnboardingSkeleton";
