"use client";

import { atom } from "jotai";
import type { OnboardingStep, OnboardingSubStep } from "@/constants/onboarding";
import { TOTAL_STEPS } from "@/constants/onboarding";

// Types for onboarding state
export interface OnboardingState {
  currentStep: number;
  currentRoute: string;
  completedSteps: number[];
  isLoading: boolean;
  error: string | null;
}

export interface OnboardingData {
  user: {
    id?: string;
    name?: string;
    email?: string;
    organizationId?: string;
    isOnboarded?: boolean;
    hasMetaConnection?: boolean;
  } | null;
    status: {
      completed: boolean;
      currentStep: number;
      completedSteps?: string[];
      connections?: {
        shopify: boolean;
        meta: boolean;
      };
      hasShopifySubscription?: boolean;
      isProductCostSetup?: boolean;
      isExtraCostSetup?: boolean;
    } | null;
  connections: Array<{
    platform: string;
    isActive: boolean;
  }> | null;
}

// Removed persistent storage - using Convex as single source of truth
// Progress is now tracked server-side only

// Current onboarding state
export const onboardingStateAtom = atom<OnboardingState>({
  currentStep: 1,
  currentRoute: "/onboarding/shopify",
  completedSteps: [],
  isLoading: false,
  error: null,
});

// Onboarding data from Convex (batched queries)
export const onboardingDataAtom = atom<OnboardingData>({
  user: null,
  status: null,
  connections: null,
});

// Derived atoms for computed values
export const currentStepProgressAtom = atom((get) => {
  const state = get(onboardingStateAtom);
  return {
    current: state.currentStep,
    total: TOTAL_STEPS,
    percentage: (state.currentStep / TOTAL_STEPS) * 100,
  };
});

export const hasPlatformConnectionsAtom = atom((get) => {
  const data = get(onboardingDataAtom);
  return Boolean(
    data.status?.connections?.meta ||
    data.user?.hasMetaConnection
  );
});

// Navigation state for prefetching
export const navigationStateAtom = atom<{
  nextRoute: string | null;
  previousRoute: string | null;
  prefetchedRoutes: Set<string>;
}>({
  nextRoute: null,
  previousRoute: null,
  prefetchedRoutes: new Set<string>(),
});

// Flag to block clicks during navigation to avoid double actions
export const navigationPendingAtom = atom<boolean>(false);
export const setNavigationPendingAtom = atom(
  null,
  (_get, set, pending: boolean) => {
    set(navigationPendingAtom, pending);
  }
);

// Actions for onboarding navigation
export const navigateToStepAtom = atom(
  null,
  (get, set, { step, route }: { step: number; route: string }) => {
    const currentState = get(onboardingStateAtom);
    // Avoid redundant updates
    if (
      currentState.currentStep === step &&
      currentState.currentRoute === route
    ) {
      return;
    }
    
    // Update local state only - Convex handles persistence
    set(onboardingStateAtom, {
      ...currentState,
      currentStep: step,
      currentRoute: route,
    });
  }
);

export const completeStepAtom = atom(
  null,
  (get, set, stepId: number) => {
    const currentState = get(onboardingStateAtom);
    // Skip if already marked complete
    if (currentState.completedSteps.includes(stepId)) {
      return;
    }
    
    const updatedCompletedSteps = [
      ...currentState.completedSteps,
      stepId,
    ];
    
    // Update local state only - Convex handles persistence
    set(onboardingStateAtom, {
      ...currentState,
      completedSteps: updatedCompletedSteps,
    });
  }
);

export const setOnboardingDataAtom = atom(
  null,
  (get, set, data: Partial<OnboardingData>) => {
    const current = get(onboardingDataAtom);
    const nextUser = data.user !== undefined ? data.user : current.user;
    const nextStatus = data.status !== undefined ? data.status : current.status;
    const nextConnections = data.connections !== undefined ? data.connections : current.connections;

    // Avoid setting if nothing actually changed (shallow)
    if (
      nextUser === current.user &&
      nextStatus === current.status &&
      nextConnections === current.connections
    ) {
      return;
    }

    set(onboardingDataAtom, {
      user: nextUser ?? null,
      status: nextStatus ?? null,
      connections: nextConnections ?? null,
    });
  }
);

export const setOnboardingErrorAtom = atom(
  null,
  (get, set, error: string | null) => {
    const currentState = get(onboardingStateAtom);
    if (currentState.error === error) return;
    set(onboardingStateAtom, {
      ...currentState,
      error,
    });
  }
);

export const setOnboardingLoadingAtom = atom(
  null,
  (get, set, isLoading: boolean) => {
    const currentState = get(onboardingStateAtom);
    if (currentState.isLoading === isLoading) return;
    set(onboardingStateAtom, {
      ...currentState,
      isLoading,
    });
  }
);

// Route prefetching for instant navigation
export const prefetchRouteAtom = atom(
  null,
  (get, set, route: string) => {
    const navState = get(navigationStateAtom);
    if (navState.prefetchedRoutes.has(route)) return;
    set(navigationStateAtom, {
      ...navState,
      prefetchedRoutes: new Set([...navState.prefetchedRoutes, route]),
    });
  }
);

// Reset onboarding state (for testing or restart)
export const resetOnboardingAtom = atom(
  null,
  (get, set) => {
    set(onboardingStateAtom, {
      currentStep: 1,
      currentRoute: "/onboarding/shopify",
      completedSteps: [],
      isLoading: false,
      error: null,
    });
    
    set(onboardingDataAtom, {
      user: null,
      status: null,
      connections: null,
    });
  }
);

// Optimistic updates for smooth UX
export const optimisticNavigationAtom = atom(
  null,
  (get, set, { step, route }: { step: number; route: string }) => {
    // Immediately update UI
    set(navigateToStepAtom, { step, route });
    
    // Mark current step as completed if moving forward
    const currentState = get(onboardingStateAtom);
    if (step > currentState.currentStep) {
      set(completeStepAtom, currentState.currentStep);
    }
  }
);
