import { useMemo } from 'react';
import { useQuery } from 'convex/react';

import { api } from '@/libs/convexApi';

type SupportedPlan = 'free' | 'starter' | 'growth' | 'business';

type BillingInfo = {
  plan: SupportedPlan;
  isPremium: boolean;
  status: string | null;
  billingCycle: 'monthly' | 'yearly' | null;
};

export function useUserDetails() {
  const user = useQuery(api.core.users.getCurrentUser);
  const shouldLoadBilling = user !== undefined && user !== null;
  const billing = useQuery(
    api.core.users.getUserBilling,
    shouldLoadBilling ? {} : 'skip',
  );

  const isLoading =
    user === undefined || (shouldLoadBilling && billing === undefined);

  const billingInfo: BillingInfo | null = useMemo(() => {
    if (!billing) {
      return null;
    }

    return {
      plan: (billing.plan ?? 'free') as SupportedPlan,
      isPremium: billing.isPremium ?? false,
      status: billing.status ?? null,
      billingCycle: billing.billingCycle ?? null,
    };
  }, [billing]);

  return {
    isAuthenticated: Boolean(user),
    isLoading,
    user: user ?? null,
    billing: billingInfo,
  };
}
