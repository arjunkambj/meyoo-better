import { useMemo } from 'react';
import { useQuery } from 'convex/react';

import { api } from '@/libs/convexApi';

type SupportedPlan = 'free' | 'starter' | 'growth' | 'business';

type BillingUsage = {
  plan: SupportedPlan | null;
  currentUsage: number;
  limit: number;
  percentage: number;
  requiresUpgrade: boolean;
  isOnTrial: boolean;
  daysLeftInTrial: number;
  trialEndsAt: number | null;
  month: string | null;
  billingStatus: string | null;
};

const PLAN_LIMITS: Record<SupportedPlan, number> = {
  free: 300,
  starter: 1200,
  growth: 3500,
  business: 7500,
};

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
  const usage = useQuery(api.billing.trackUsage.getCurrentUsage);

  const isLoading =
    user === undefined ||
    (shouldLoadBilling && (billing === undefined || usage === undefined));

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

  const billingUsage: BillingUsage | null = useMemo(() => {
    if (!usage) {
      return null;
    }

    const normalizedPlan = ((): SupportedPlan | null => {
      if (!usage.plan) {
        return null;
      }

      const supportedPlans: SupportedPlan[] = ['free', 'starter', 'growth', 'business'];
      return supportedPlans.includes(usage.plan as SupportedPlan)
        ? (usage.plan as SupportedPlan)
        : null;
    })();

    const limitFromUsage = typeof usage.limit === 'number' ? usage.limit : 0;
    const fallbackPlan = normalizedPlan ?? billingInfo?.plan ?? 'free';
    const effectiveLimit =
      limitFromUsage > 0 ? limitFromUsage : PLAN_LIMITS[fallbackPlan];
    const currentUsage = usage.currentUsage ?? 0;
    const rawPercentage =
      typeof usage.percentage === 'number'
        ? usage.percentage
        : effectiveLimit > 0
          ? (currentUsage / effectiveLimit) * 100
          : 0;

    const percentage = Number.isFinite(rawPercentage)
      ? Math.max(0, Math.min(100, rawPercentage))
      : 0;

    return {
      plan: normalizedPlan,
      currentUsage,
      limit: effectiveLimit,
      percentage,
      requiresUpgrade: usage.requiresUpgrade ?? false,
      isOnTrial: usage.isOnTrial ?? false,
      daysLeftInTrial: usage.daysLeftInTrial ?? 0,
      trialEndsAt: usage.trialEndsAt ?? null,
      month: usage.month ?? null,
      billingStatus: usage.billingStatus ?? null,
    };
  }, [usage, billingInfo?.plan]);

  return {
    isAuthenticated: Boolean(user),
    isLoading,
    user: user ?? null,
    billing: billingInfo,
    billingUsage,
  };
}
