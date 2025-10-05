"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

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
  globalRole: Doc<"users">["globalRole"];
  membershipRole: Doc<"memberships">["role"] | null;
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
  const membership = useQuery(api.core.memberships.getCurrentMembership);
  const organization = useQuery(api.core.organizations.getCurrentOrganization);
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
    globalRole: user?.globalRole,
    membershipRole: membership?.role ?? null,
    organizationId: user?.organizationId,
    primaryCurrency: organization?.primaryCurrency ?? "USD",
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
