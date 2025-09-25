import { useQuery } from "convex/react";

import { api } from "@/libs/convexApi";
import { getUserDisplayName, getUserInitials } from "@/libs/user";

type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "AUD"
  | string;

export function useCurrentUser() {
  const user = useQuery(api.core.users.getCurrentUser);
  const isLoading = user === undefined;

  const primaryCurrency = (user?.primaryCurrency as CurrencyCode | undefined) ?? "USD";

  return {
    user,
    isLoading,
    primaryCurrency,
    displayName: getUserDisplayName(user),
    initials: getUserInitials(user),
  };
}
