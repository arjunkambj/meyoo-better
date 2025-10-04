"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { GenericId as Id } from "convex/values";

import { api } from "@/libs/convexApi";
import type { Doc } from "@/types/convex";

type OnboardingStatus = {
  completed: boolean;
  currentStep: number;
  connections: {
    shopify: boolean;
    meta: boolean;
  };
  hasShopifySubscription?: boolean;
  isInitialSyncComplete?: boolean;
  isProductCostSetup?: boolean;
  isExtraCostSetup?: boolean;
} | null;

type UserContextValue = {
  user: Doc<"users"> | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  role: Doc<"users">["role"];
  organizationId: string | undefined;
  primaryCurrency: string;
};

type OnboardingContextValue = {
  status: OnboardingStatus;
  loading: boolean;
  hasShopifyConnection: boolean;
  hasMetaConnection: boolean;
  isInitialSyncComplete: boolean;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);
const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export function UserProvider({ children }: { children: ReactNode }) {
  const user = useQuery(api.core.users.getCurrentUser);
  const orgCurrency = useQuery(
    api.core.currency.getPrimaryCurrencyForOrg,
    user?.organizationId
      ? { orgId: user.organizationId as Id<"organizations"> }
      : "skip",
  );
  const onboarding = useQuery(
    api.core.onboarding.getOnboardingStatus,
    user ? {} : "skip"
  );

  const userLoading = user === undefined;
  const onboardingLoading = onboarding === undefined && user !== null;
  const error = user === null && !userLoading ? "User not found" : null;

  const userContextValue: UserContextValue = {
    user: user ?? null,
    loading: userLoading,
    error,
    isAuthenticated: !!user,
    role: user?.role,
    organizationId: user?.organizationId,
    primaryCurrency: orgCurrency ?? user?.primaryCurrency ?? "USD",
  };

  const onboardingContextValue: OnboardingContextValue = {
    status: onboarding ?? null,
    loading: onboardingLoading,
    hasShopifyConnection: onboarding?.connections?.shopify || false,
    hasMetaConnection: onboarding?.connections?.meta || false,
    isInitialSyncComplete: onboarding?.isInitialSyncComplete || false,
  };

  return (
    <UserContext.Provider value={userContextValue}>
      <OnboardingContext.Provider value={onboardingContextValue}>
        {children}
      </OnboardingContext.Provider>
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}

export function useOnboardingContext() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error(
      "useOnboardingContext must be used within a UserProvider"
    );
  }
  return context;
}
