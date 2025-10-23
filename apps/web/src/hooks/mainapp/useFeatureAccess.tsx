"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

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

type FeatureAccessMap = Record<Feature, FeatureAccessResult>;

const DEFAULT_ACCESS: FeatureAccessResult = { hasAccess: true };

const FeatureAccessContext = createContext<FeatureAccessMap | null>(null);

export function FeatureAccessProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FeatureAccessContext.Provider value={null}>
      {children}
    </FeatureAccessContext.Provider>
  );
}

export function useFeatureAccess(feature: Feature): FeatureAccessResult {
  const context = useContext(FeatureAccessContext);

  if (context && context[feature]) {
    return context[feature] ?? DEFAULT_ACCESS;
  }

  return DEFAULT_ACCESS;
}
