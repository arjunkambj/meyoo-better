"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { api } from "@/libs/convexApi";
import { formatNumber } from "@/libs/utils/format";

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

const FEATURE_QUERY_ARGS = {
  sync: { action: "sync" },
  basic_export: { action: "basic_export" },
  export: { action: "export" },
  api_access: { action: "api_access" },
  email_reports: { action: "email_reports" },
  advanced_analytics: { action: "advanced_analytics" },
  ai_insights: { action: "ai_insights" },
  custom_integrations: { action: "custom_integrations" },
} as const satisfies { [K in Feature]: { action: K } };

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
      reason: `Order limit exceeded (${formatNumber(usage)}/${formatNumber(limit)}). Upgrade your plan to continue.`,
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
  const featureAccess = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS[feature],
  );

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

  const syncFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.sync,
  );
  const exportFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.export,
  );
  const apiFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.api_access,
  );
  const emailFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.email_reports,
  );
  const advancedFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.advanced_analytics,
  );
  const aiFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.ai_insights,
  );
  const customFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.custom_integrations,
  );
  const basicExportFeature = useQuery(
    api.billing.trackUsage.canPerformAction,
    FEATURE_QUERY_ARGS.basic_export,
  );

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
