"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import type React from "react";
import { memo, useEffect, useMemo } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import {
  getStepByRoute,
  TOTAL_STEPS,
  getNextStep,
} from "@/constants/onboarding";
import {
  onboardingStateAtom,
  setOnboardingDataAtom,
  setOnboardingLoadingAtom,
  navigateToStepAtom,
  prefetchRouteAtom,
} from "@/store/onboarding";
import { navigationPendingAtom, setNavigationPendingAtom } from "@/store/onboarding";
import { OnboardingSkeleton } from "./OnboardingSkeleton";
import { Logo } from "@/components/shared/Logo";
import UserProfile from "@/components/shared/UserProfile";
import MinimalProgressBar from "../MinimalProgressBar";
import { useUserContext } from "@/contexts/UserContext";
import { useOnboarding } from "@/hooks/onboarding/useOnboarding";
import type { UserProfile as UserProfileDoc } from "@/hooks/mainapp/useUser";

// Hook for batched onboarding data with Jotai integration
const useOnboardingData = () => {
  const router = useRouter();
  const {
    user,
    loading: userLoading,
  } = useUserContext();
  const {
    status,
    loading: onboardingLoading,
  } = useOnboarding();

  const setOnboardingData = useSetAtom(setOnboardingDataAtom);
  const setLoading = useSetAtom(setOnboardingLoadingAtom);
  const prefetchRoute = useSetAtom(prefetchRouteAtom);

  const isLoading = userLoading || onboardingLoading;
  const isCompleted = status?.completed ?? false;

  // Redirect to the dashboard once onboarding is marked complete server-side.
  useEffect(() => {
    if (!isLoading && isCompleted) {
      router.replace('/overview');
    }
  }, [isCompleted, isLoading, router]);

  // Update Jotai store when data changes
  useEffect(() => {
    const profile = user as UserProfileDoc | null;
    const normalizedUser: UserProfileDoc | null = profile
      ? {
          _id: typeof profile._id === "string" ? profile._id : undefined,
          name: typeof profile.name === "string" ? profile.name : undefined,
          email: typeof profile.email === "string" ? profile.email : undefined,
          organizationId:
            typeof profile.organizationId === "string"
              ? profile.organizationId
              : undefined,
          isOnboarded:
            typeof profile.isOnboarded === "boolean"
              ? profile.isOnboarded
              : undefined,
          hasMetaConnection:
            typeof profile.hasMetaConnection === "boolean"
              ? profile.hasMetaConnection
              : undefined,
        }
      : null;

    if (!isLoading) {
      setOnboardingData({
        user: normalizedUser,
        status,
        connections: status?.connections
          ? [
              { platform: "shopify", isActive: status.connections.shopify },
              { platform: "meta", isActive: status.connections.meta },
            ]
          : null,
      });
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [user, status, isLoading, setOnboardingData, setLoading]);

  // Prefetch next route for instant navigation
  useEffect(() => {
    if (!isLoading && !isCompleted && status?.currentStep) {
      const nextStep = getNextStep(
        status.currentStep,
        typeof window !== "undefined" ? window.location.pathname : undefined
      );
      if (nextStep?.route) {
        router.prefetch(nextStep.route as Route);
        prefetchRoute(nextStep.route);
      }
    }
  }, [isCompleted, isLoading, prefetchRoute, router, status?.currentStep]);

  return { isLoading };
};

interface OnboardingLayoutClientProps {
  children: React.ReactNode;
}

export const OnboardingLayoutClient = memo(function OnboardingLayoutClient({
  children,
}: OnboardingLayoutClientProps) {
  const pathname = usePathname();
  const { isLoading } = useOnboardingData();

  // Get state from Jotai atoms
  const onboardingState = useAtomValue(onboardingStateAtom);
  const navigateToStep = useSetAtom(navigateToStepAtom);
  const navigationPending = useAtomValue(navigationPendingAtom);
  const setNavigationPending = useSetAtom(setNavigationPendingAtom);

  // Determine current step from route; fall back to stored state
  const stepMeta = useMemo(() => getStepByRoute(pathname), [pathname]);
  const currentStep = stepMeta?.id ?? onboardingState.currentStep;

  // Update Jotai state when route changes
  useEffect(() => {
    if (currentStep !== onboardingState.currentStep) {
      navigateToStep({ step: currentStep, route: pathname });
    }
    // Clear any pending overlay on route change
    setNavigationPending(false);
  }, [
    currentStep,
    pathname,
    onboardingState.currentStep,
    navigateToStep,
    setNavigationPending,
  ]);

  // Safety: auto-clear pending overlay if it lingers without a route change
  useEffect(() => {
    if (!navigationPending) return;
    const t = setTimeout(() => {
      setNavigationPending(false);
    }, 2000);
    return () => clearTimeout(t);
  }, [navigationPending, setNavigationPending]);

  // Derived UI values
  const isWide = useMemo(
    () =>
      pathname === "/onboarding/cost" ||
      pathname === "/onboarding/billing" ||
      pathname === "/onboarding/products",
    [pathname]
  );
  const containerWidthClass = isWide ? "max-w-7xl" : "max-w-3xl";

  // Show skeleton while loading
  if (isLoading || onboardingState.isLoading) {
    return <OnboardingSkeleton currentStep={currentStep} />;
  }

  return (
    <div className="relative flex min-h-dvh w-full bg-background overflow-x-hidden">
      <main className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* Minimal Header */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-divider">
          {/* Progress Bar at top */}
          <MinimalProgressBar
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
          />
          {/* Logo, step indicator, and user profile */}
          <div className="px-4 sm:px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <Logo size="sm" />
              <span className="text-xs font-medium text-default-500">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <UserProfile showNavigationLinks={false} />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={`min-h-[600px] px-4 sm:px-6 py-8 sm:py-10 md:py-12 ${navigationPending ? "pointer-events-none opacity-60" : ""}`} aria-busy={navigationPending}>
            <div className={`${containerWidthClass} mx-auto w-full`}>
              {children}
            </div>
          </div>
        </div>
      </main>
      {navigationPending && (
        <div className="fixed inset-0 z-50 bg-transparent" aria-hidden="true" />
      )}
    </div>
  );
});

OnboardingLayoutClient.displayName = "OnboardingLayoutClient";
