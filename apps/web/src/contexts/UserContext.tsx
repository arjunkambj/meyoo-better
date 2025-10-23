"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import type { Doc } from "@repo/convex/dataModel";

type UserContextValue = {
  user: Doc<"users"> | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  membershipRole: Doc<"memberships">["role"] | null;
  organizationId: string | undefined;
  primaryCurrency: string;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const user = useQuery(api.core.users.getCurrentUser);
  const membership = useQuery(api.core.memberships.getCurrentMembership);
  const organization = useQuery(api.core.organizations.getCurrentOrganization);
  const userLoading = user === undefined;
  const error = user === null && !userLoading ? "User not found" : null;

  const userContextValue: UserContextValue = {
    user: user ?? null,
    loading: userLoading,
    error,
    isAuthenticated: !!user,
    membershipRole: membership?.role ?? null,
    organizationId: user?.organizationId,
    primaryCurrency: organization?.primaryCurrency ?? "USD",
  };

  return (
    <UserContext.Provider value={userContextValue}>{children}</UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
