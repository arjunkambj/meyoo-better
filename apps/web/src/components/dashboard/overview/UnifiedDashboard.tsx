"use client";

import { Spacer } from "@heroui/spacer";
import { useAtomValue } from "jotai";
import React, { useCallback, useMemo, useState } from "react";
import { useAnalyticsDateRange, useDashboardOverview } from "@/hooks";
import { devToolsVisibleAtom } from "@/store/atoms";
import { DEFAULT_DASHBOARD_CONFIG, type OnboardingStatus } from "@repo/types";
import type { SyncStatusCardData, SyncCardState } from "./components/SyncStatusCard";

import { CustomizationModalUnified } from "./CustomizationModalUnified";
import { DashboardHeader } from "./components/DashboardHeader";
import { MetricsContainer } from "./components/MetricsContainer";
import { SyncStatusCard } from "./components/SyncStatusCard";
import { WidgetsContainer } from "./components/WidgetsContainer";
import { DevTools } from "./DevTools";

type StageKey = "products" | "inventory" | "customers" | "orders";
type SyncStageInfo = SyncStatusCardData["stages"][number];

const STAGE_LABELS: Record<StageKey, string> = {
  products: "Products",
  inventory: "Inventory",
  customers: "Customers",
  orders: "Orders",
};

const buildPreviewCard = (): SyncStatusCardData => ({
  platform: "shopify",
  state: "syncing",
  message: "Preview: Shopify sync in progress.",
  progress: null,
  stages: (Object.keys(STAGE_LABELS) as StageKey[]).map((key) => ({
    key,
    label: STAGE_LABELS[key],
    completed: key === "products" || key === "inventory",
  })),
  lastUpdated: Date.now(),
  error: null,
  pendingPlatforms: ["shopify"],
});

const toStageEntries = (
  stages: {
    products?: boolean;
    inventory?: boolean;
    customers?: boolean;
    orders?: boolean;
  } | null | undefined,
): SyncStageInfo[] =>
  (Object.keys(STAGE_LABELS) as StageKey[]).map((key) => ({
    key,
    label: STAGE_LABELS[key],
    completed: Boolean(stages?.[key]),
  }));

function buildSyncStatusCardData(
  status: OnboardingStatus | null | undefined,
  debugForce: boolean,
): SyncStatusCardData | null {
  const previewCard = debugForce ? buildPreviewCard() : null;

  if (!status) {
    return previewCard;
  }

  const hasShopifyConnection = status.connections?.shopify ?? false;
  if (!hasShopifyConnection && !debugForce) {
    return null;
  }

  const shopify = status.syncStatus?.shopify;
  const overall = shopify?.overallState ?? null;
  const isInitialSyncComplete = status.isInitialSyncComplete ?? false;

  if (!debugForce && (isInitialSyncComplete || overall === "complete")) {
    return null;
  }

  const normalizedState: SyncCardState = (() => {
    if (overall === "failed" || shopify?.status === "failed") {
      return "failed";
    }
    if (
      overall === "syncing" ||
      shopify?.status === "processing" ||
      shopify?.status === "syncing" ||
      shopify?.status === "pending"
    ) {
      return "syncing";
    }
    if (!shopify) {
      return debugForce ? "syncing" : "waiting";
    }
    return "waiting";
  })();

  const lastUpdated =
    (typeof status.lastSyncCheckAt === "number" ? status.lastSyncCheckAt : null) ??
    (typeof shopify?.completedAt === "number" ? shopify.completedAt : null) ??
    (typeof shopify?.startedAt === "number" ? shopify.startedAt : null) ??
    (debugForce ? Date.now() : null);

  const message = (() => {
    if (normalizedState === "failed") {
      return "Initial Shopify sync needs attention. Review the error and retry the sync.";
    }
    if (normalizedState === "syncing") {
      return debugForce
        ? "Preview: Shopify sync in progress."
        : "We're syncing your Shopify data. Feel free to explore the dashboard while this finishes.";
    }
    return "Shopify sync is queued and should start momentarily.";
  })();

  const result: SyncStatusCardData = {
    platform: "shopify",
    state: normalizedState,
    message,
    progress: null,
    stages: toStageEntries(shopify?.stages ?? null),
    lastUpdated,
    error: shopify?.lastError ?? null,
    pendingPlatforms: status.pendingSyncPlatforms ?? [],
  };

  if (debugForce && previewCard) {
    return {
      ...previewCard,
      ...result,
      state: result.state === "waiting" ? "syncing" : result.state,
      stages: result.stages.length > 0 ? result.stages : previewCard.stages,
      lastUpdated: result.lastUpdated ?? previewCard.lastUpdated,
      pendingPlatforms:
        result.pendingPlatforms.length > 0
          ? result.pendingPlatforms
          : previewCard.pendingPlatforms,
    } satisfies SyncStatusCardData;
  }

  return result;
}

export const UnifiedDashboard = React.memo(function UnifiedDashboard() {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const {
    analyticsRange: overviewRange,
    calendarRange: overviewCalendarRange,
    preset: overviewPreset,
    updateRange: updateOverviewRange,
  } = useAnalyticsDateRange('dashboard-overview', { defaultPreset: 'today', sharedKey: null });
  const devToolsVisible = useAtomValue(devToolsVisibleAtom);
  const {
    isLoading,
    overviewMetrics,
    platformMetrics,
    dashboardConfig,
    saveConfig,
    primaryCurrency,
    onboardingStatus,
    canViewDevTools,
  } = useDashboardOverview({ startDate: overviewRange.startDate, endDate: overviewRange.endDate });

  const debugForce = typeof window !== "undefined" && window.location.search.includes("previewSyncCard");
  const syncCardData: SyncStatusCardData | null = useMemo(
    () => buildSyncStatusCardData(onboardingStatus ?? null, debugForce),
    [onboardingStatus, debugForce],
  );
  const shouldShowSyncCard = Boolean(syncCardData);
  const isSyncStatusLoading = isLoading && !syncCardData;

  // Note: Cost setup status is now tracked in onboarding table
  const showCostSetupWarning = false; // TODO: Get from onboarding status when needed

  const config = dashboardConfig;

  const overviewMetricValues = useMemo<Record<string, number>>(() => {
    if (!overviewMetrics) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(overviewMetrics).map(([key, metric]) => [
        key,
        metric.value ?? 0,
      ]),
    ) as Record<string, number>;
  }, [overviewMetrics]);

  const allMetricsData = useMemo(() => {
    const platformNumbers = platformMetrics as unknown as Record<string, number>;
    const metrics: Record<string, number> = {
      ...overviewMetricValues,
      ...platformNumbers,
    };

    const repeatRate = overviewMetricValues.repeatCustomerRate ?? 0;
    metrics.repurchaseRate = repeatRate;
    metrics.repeatCustomerRate = repeatRate;
    metrics.repeatRate = repeatRate;

    return metrics;
  }, [overviewMetricValues, platformMetrics]);

  const handleCustomizationApply = useCallback(
    async (kpiItems: string[], widgetItems: string[]) => {
      const nextKpis = kpiItems.length > 0 ? kpiItems : [...DEFAULT_DASHBOARD_CONFIG.kpis];
      const nextWidgets = widgetItems.length > 0 ? widgetItems : [...DEFAULT_DASHBOARD_CONFIG.widgets];

      await saveConfig({
        kpis: nextKpis,
        widgets: nextWidgets,
      });
      setIsCustomizing(false);
    },
    [saveConfig]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <Spacer y={0.5} />
      <DashboardHeader
        onCustomize={() => setIsCustomizing(true)}
        onDateRangeChange={updateOverviewRange}
        dateRange={overviewCalendarRange}
        datePreset={overviewPreset}
      />

      {/* Data Status Chips removed */}

      {shouldShowSyncCard && (
        <SyncStatusCard isLoading={isSyncStatusLoading} data={syncCardData} />
      )}

      {/* KPI Metrics */}
      <div className="mb-8">
        <MetricsContainer
          isLoading={isLoading}
          metrics={config.kpis}
          metricsData={allMetricsData}
          overviewMetrics={overviewMetrics}
          primaryCurrency={primaryCurrency}
        />
      </div>

      {/* Widgets */}
      <WidgetsContainer
        isLoading={isLoading}
        widgets={config.widgets}
        metricsData={allMetricsData}
        overviewMetrics={overviewMetrics}
        primaryCurrency={primaryCurrency}
        showCostSetupWarning={showCostSetupWarning}
      />

      {/* Developer Tools - conditionally rendered based on settings */}
      {devToolsVisible && canViewDevTools && (
        <div className="mt-8">
          <DevTools />
        </div>
      )}

      {/* Customization Modal */}
      <CustomizationModalUnified
        isOpen={isCustomizing}
        kpiItems={config.kpis}
        widgetItems={config.widgets}
        onApply={handleCustomizationApply}
        onClose={() => setIsCustomizing(false)}
      />
    </div>
  );
});
