"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";

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

export function useFeatureAccess(feature: Feature): FeatureAccessResult {
  const { currentUsage } = useBilling();

  // Check feature access via Convex function
  const featureAccess = useQuery(api.billing.trackUsage.canPerformAction, {
    action: feature,
  });

  // Get plan limits and current usage
  const _planLimits = useMemo(() => {
    const limits: Record<string, number> = {
      free: 250,
      starter: 750,
      growth: 1600,
      business: 3500,
      enterprise: 10000,
    };

    return limits;
  }, []);

  // Define feature requirements per plan
  const featureRequirements = useMemo(() => {
    const requirements: Record<
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

    return requirements;
  }, []);

  return useMemo(() => {
    // If no usage data yet, allow access (loading state)
    if (!currentUsage || featureAccess === undefined) {
      return { hasAccess: true };
    }

    const { plan, currentUsage: usage, limit, requiresUpgrade } = currentUsage;
    const requirement = featureRequirements[feature];

    // Check if user has exceeded their order limit
    if (requiresUpgrade && usage > limit) {
      return {
        hasAccess: false,
        reason: `Order limit exceeded (${usage.toLocaleString()}/${limit.toLocaleString()}). Upgrade your plan to continue.`,
        upgradeRequired: true,
        currentPlan: plan ?? 'free',
        requiredPlan: getNextPlan(plan ?? 'free'),
      };
    }

    // Check if feature is available on current plan
    if (!featureAccess) {
      const planHierarchy = [
        "free",
        "starter",
        "growth",
        "business",
        "enterprise",
      ];
      const currentPlanIndex = planHierarchy.indexOf(plan ?? 'free');
      const requiredPlanIndex = planHierarchy.indexOf(requirement.minPlan);

      if (currentPlanIndex < requiredPlanIndex) {
        return {
          hasAccess: false,
          reason: `${requirement.description} requires ${requirement.minPlan} plan or higher.`,
          upgradeRequired: true,
          currentPlan: plan ?? 'free',
          requiredPlan: requirement.minPlan,
        };
      }
    }

    // Feature is accessible
    return { hasAccess: true };
  }, [currentUsage, featureAccess, featureRequirements, feature]);
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
  // Always call hooks for all possible features to maintain consistent hook order
  const syncAccess = useFeatureAccess("sync");
  const exportAccess = useFeatureAccess("export");
  const apiAccess = useFeatureAccess("api_access");
  const emailReportsAccess = useFeatureAccess("email_reports");
  const advancedAnalyticsAccess = useFeatureAccess("advanced_analytics");
  const aiInsightsAccess = useFeatureAccess("ai_insights");
  const customIntegrationsAccess = useFeatureAccess("custom_integrations");
  const basicExportAccess = useFeatureAccess("basic_export");

  const accessMap: Record<Feature, FeatureAccessResult> = {
    sync: syncAccess,
    export: exportAccess,
    api_access: apiAccess,
    email_reports: emailReportsAccess,
    advanced_analytics: advancedAnalyticsAccess,
    ai_insights: aiInsightsAccess,
    custom_integrations: customIntegrationsAccess,
    basic_export: basicExportAccess,
  };

  const results = features.map((feature) => ({
    feature,
    ...accessMap[feature],
  }));

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
