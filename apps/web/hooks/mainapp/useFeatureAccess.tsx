"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { api } from "@/libs/convexApi";

import { useBilling } from "./useBilling";

export type Feature =
  | "sync"
  | "export"
  | "api_access"
  | "email_reports"
  | "advanced_analytics"
  | "ai_insights"
  | "custom_integrations"
  | "basic_export";

export interface FeatureAccessResult {
  hasAccess: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  currentPlan?: string;
  requiredPlan?: string;
}

const FEATURE_REQUIREMENTS: Record<
  Feature,
  { minPlan: string; description: string }
> = {
  sync: { minPlan: "free", description: "Data synchronization" },
  basic_export: { minPlan: "free", description: "Basic data export" },
  export: { minPlan: "starter", description: "Advanced data export" },
  api_access: { minPlan: "starter", description: "API access" },
  email_reports: { minPlan: "starter", description: "Email reports" },
  advanced_analytics: {
    minPlan: "growth",
    description: "Advanced analytics",
  },
  ai_insights: { minPlan: "business", description: "AI-powered insights" },
  custom_integrations: {
    minPlan: "enterprise",
    description: "Custom integrations",
  },
};

const PLAN_HIERARCHY = [
  "free",
  "starter",
  "growth",
  "business",
  "enterprise",
] as const;

type FeatureAccessMap = Record<Feature, FeatureAccessResult>;

const FeatureAccessContext = createContext<FeatureAccessMap | null>(null);

function evaluateFeatureAccess(
  feature: Feature,
  currentUsage: ReturnType<typeof useBilling>["currentUsage"],
  featureAccess: unknown,
): FeatureAccessResult {
  if (!currentUsage || featureAccess === undefined) {
    return { hasAccess: true };
  }

  const { plan, currentUsage: usage, limit, requiresUpgrade } = currentUsage;
  const requirement = FEATURE_REQUIREMENTS[feature];

  if (requiresUpgrade && usage > limit) {
    return {
      hasAccess: false,
      reason: `Order limit exceeded (${usage.toLocaleString()}/${limit.toLocaleString()}). Upgrade your plan to continue.`,
      upgradeRequired: true,
      currentPlan: plan ?? "free",
      requiredPlan: getNextPlan(plan ?? "free"),
    };
  }

  if (!featureAccess) {
    const planLabel = (plan ?? "free") as typeof PLAN_HIERARCHY[number];
    const requiredLabel = requirement.minPlan as typeof PLAN_HIERARCHY[number];
    const currentPlanIndex = PLAN_HIERARCHY.indexOf(planLabel);
    const requiredPlanIndex = PLAN_HIERARCHY.indexOf(requiredLabel);

    if (currentPlanIndex === -1 || requiredPlanIndex === -1) {
      return { hasAccess: true };
    }

    if (currentPlanIndex < requiredPlanIndex) {
      return {
        hasAccess: false,
        reason: `${requirement.description} requires ${requirement.minPlan} plan or higher.`,
        upgradeRequired: true,
        currentPlan: plan ?? "free",
        requiredPlan: requirement.minPlan,
      };
    }
  }

  return { hasAccess: true };
}

function useFeatureAccessInternal(feature: Feature): FeatureAccessResult {
  const { currentUsage } = useBilling();
  const featureAccess = useQuery(api.billing.trackUsage.canPerformAction, {
    action: feature,
  });

  return useMemo(
    () => evaluateFeatureAccess(feature, currentUsage, featureAccess),
    [currentUsage, featureAccess, feature],
  );
}

export function FeatureAccessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { currentUsage } = useBilling();

  const syncFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "sync",
  });
  const exportFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "export",
  });
  const apiFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "api_access",
  });
  const emailFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "email_reports",
  });
  const advancedFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "advanced_analytics",
  });
  const aiFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "ai_insights",
  });
  const customFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "custom_integrations",
  });
  const basicExportFeature = useQuery(api.billing.trackUsage.canPerformAction, {
    action: "basic_export",
  });

  const syncAccess = useMemo(
    () => evaluateFeatureAccess("sync", currentUsage, syncFeature),
    [currentUsage, syncFeature],
  );
  const exportAccess = useMemo(
    () => evaluateFeatureAccess("export", currentUsage, exportFeature),
    [currentUsage, exportFeature],
  );
  const apiAccess = useMemo(
    () => evaluateFeatureAccess("api_access", currentUsage, apiFeature),
    [currentUsage, apiFeature],
  );
  const emailReportsAccess = useMemo(
    () => evaluateFeatureAccess("email_reports", currentUsage, emailFeature),
    [currentUsage, emailFeature],
  );
  const advancedAnalyticsAccess = useMemo(
    () => evaluateFeatureAccess("advanced_analytics", currentUsage, advancedFeature),
    [currentUsage, advancedFeature],
  );
  const aiInsightsAccess = useMemo(
    () => evaluateFeatureAccess("ai_insights", currentUsage, aiFeature),
    [currentUsage, aiFeature],
  );
  const customIntegrationsAccess = useMemo(
    () => evaluateFeatureAccess("custom_integrations", currentUsage, customFeature),
    [currentUsage, customFeature],
  );
  const basicExportAccess = useMemo(
    () => evaluateFeatureAccess("basic_export", currentUsage, basicExportFeature),
    [currentUsage, basicExportFeature],
  );

  const value = useMemo<FeatureAccessMap>(() => ({
    sync: syncAccess,
    export: exportAccess,
    api_access: apiAccess,
    email_reports: emailReportsAccess,
    advanced_analytics: advancedAnalyticsAccess,
    ai_insights: aiInsightsAccess,
    custom_integrations: customIntegrationsAccess,
    basic_export: basicExportAccess,
  }), [
    syncAccess,
    exportAccess,
    apiAccess,
    emailReportsAccess,
    advancedAnalyticsAccess,
    aiInsightsAccess,
    customIntegrationsAccess,
    basicExportAccess,
  ]);

  return (
    <FeatureAccessContext.Provider value={value}>
      {children}
    </FeatureAccessContext.Provider>
  );
}

export function useFeatureAccess(feature: Feature): FeatureAccessResult {
  const context = useContext(FeatureAccessContext);

  if (context) {
    return context[feature] ?? { hasAccess: true };
  }

  return useFeatureAccessInternal(feature);
}

function getNextPlan(currentPlan: string): string {
  const planOrder = ["free", "starter", "growth", "business", "enterprise"];
  const currentIndex = planOrder.indexOf(currentPlan);

  if (currentIndex >= 0 && currentIndex < planOrder.length - 1) {
    return planOrder[currentIndex + 1]!;
  }

  return "enterprise";
}

/**
 * Hook to check multiple features at once
 * Note: Due to React hooks rules, this always calls hooks for all possible features
 */
export function useMultiFeatureAccess(features: Feature[]) {
  const syncAccess = useFeatureAccess("sync");
  const exportAccess = useFeatureAccess("export");
  const apiAccess = useFeatureAccess("api_access");
  const emailReportsAccess = useFeatureAccess("email_reports");
  const advancedAnalyticsAccess = useFeatureAccess("advanced_analytics");
  const aiInsightsAccess = useFeatureAccess("ai_insights");
  const customIntegrationsAccess = useFeatureAccess("custom_integrations");
  const basicExportAccess = useFeatureAccess("basic_export");

  const accessMap: FeatureAccessMap = useMemo(
    () => ({
      sync: syncAccess,
      export: exportAccess,
      api_access: apiAccess,
      email_reports: emailReportsAccess,
      advanced_analytics: advancedAnalyticsAccess,
      ai_insights: aiInsightsAccess,
      custom_integrations: customIntegrationsAccess,
      basic_export: basicExportAccess,
    }),
    [
      syncAccess,
      exportAccess,
      apiAccess,
      emailReportsAccess,
      advancedAnalyticsAccess,
      aiInsightsAccess,
      customIntegrationsAccess,
      basicExportAccess,
    ],
  );

  const results = useMemo(
    () =>
      features.map((feature) => ({
        feature,
        ...(accessMap[feature] ?? { hasAccess: true }),
      })),
    [accessMap, features],
  );

  return {
    results,
    hasAccessToAll: results.every((r) => r.hasAccess),
    blockedFeatures: results.filter((r) => !r.hasAccess),
  };
}

/**
 * Utility hook for common feature access patterns
 */
export function usePlanRestrictions() {
  const { currentUsage } = useBilling();

  return useMemo(() => {
    if (!currentUsage) return null;

    const { plan, currentUsage: usage, limit } = currentUsage;
    const usagePercentage = (usage / limit) * 100;

    return {
      plan,
      usage,
      limit,
      usagePercentage,
      isNearLimit: usagePercentage >= 80,
      isAtLimit: usagePercentage >= 95,
      isOverLimit: usage > limit,
      canSync: usage <= limit,
      canExport: (plan ?? 'free') !== "free" || usage <= limit,
      canUseAdvancedFeatures: ["growth", "business", "enterprise"].includes(
        plan ?? 'free'
      ),
      canUseAI: ["business", "enterprise"].includes(plan ?? 'free'),
    };
  }, [currentUsage]);
}
