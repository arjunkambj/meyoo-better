"use client";

import { Card, CardBody, Spacer, Spinner } from "@heroui/react";
import { useQuery } from "convex/react";
import { useAtomValue } from "jotai";
import { usePathname } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { PlanUsageAlert } from "@/components/shared/billing/PlanUsageAlert";
import { api } from "@/libs/convexApi";
import { computeChannelRevenue } from "@/libs/analytics/aggregations";
import {
  useDashboard,
  useOverviewAnalytics,
  usePlatformMetrics,
  useUser,
} from "@/hooks";
import { analyticsDateRangeFamily, devToolsVisibleAtom } from "@/store/atoms";

import { CustomizationModalUnified } from "./CustomizationModalUnified";
import { DashboardHeader } from "./components/DashboardHeader";
import { MetricsContainer } from "./components/MetricsContainer";
import { WidgetsContainer } from "./components/WidgetsContainer";
import { DevTools } from "./DevTools";

type OverviewMetricView = { value: number; change?: number };

const derivePreviousValue = (current: number, changePercent?: number) => {
  if (!Number.isFinite(current) || current === 0) {
    return 0;
  }
  if (changePercent === undefined || !Number.isFinite(changePercent)) {
    return current;
  }

  const ratio = 1 + changePercent / 100;

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0;
  }

  return current / ratio;
};

const computePercentChange = (current: number, previous: number) => {
  if (!Number.isFinite(previous) || previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
};

export const UnifiedDashboard = React.memo(function UnifiedDashboard() {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const pathname = usePathname();

  // Use global date range
  const dateRange = useAtomValue(
    analyticsDateRangeFamily(pathname ?? "default"),
  );
  const devToolsVisible = useAtomValue(devToolsVisibleAtom);

  // Get user's primary currency and cost setup status
  const { primaryCurrency } = useUser();
  // Note: Cost setup status is now tracked in onboarding table
  const showCostSetupWarning = false; // TODO: Get from onboarding status when needed

  // Get dashboard configuration
  const { config, saveConfig, isLoading: configLoading } = useDashboard();

  // Get analytics data
  const { metrics: overviewMetrics, isLoading: metricsLoading } =
    useOverviewAnalytics(
      dateRange
        ? { startDate: dateRange.start, endDate: dateRange.end }
        : undefined
    );

  // Get platform-specific metrics
  const platformMetrics = usePlatformMetrics(dateRange);
  const rawChannelRevenue = useQuery(
    api.web.analytics.getChannelRevenue,
    dateRange
      ? { dateRange: { startDate: dateRange.start, endDate: dateRange.end } }
      : ("skip" as const),
  );

  const channelRevenue = useMemo(
    () => computeChannelRevenue(rawChannelRevenue ?? undefined),
    [rawChannelRevenue],
  );

  const utmRoas = useMemo(() => {
    if (!channelRevenue || !channelRevenue.channels) {
      return { value: 0, change: 0 };
    }

    const paidChannels = channelRevenue.channels.filter((channel) =>
      ["Meta Ads", "Google Ads"].includes(channel.name),
    );

    const currentRevenue = paidChannels.reduce(
      (sum, channel) => sum + (channel.revenue || 0),
      0,
    );

    const previousRevenue = paidChannels.reduce((sum, channel) => {
      const prev = derivePreviousValue(channel.revenue || 0, channel.change);

      return sum + prev;
    }, 0);

    const metaAdSpendMetric =
      (overviewMetrics?.metaAdSpend as OverviewMetricView | undefined) ||
      undefined;
    const googleAdSpendMetric =
      (overviewMetrics?.googleAdSpend as OverviewMetricView | undefined) ||
      undefined;

    const currentMetaAdSpend = metaAdSpendMetric?.value || 0;
    const currentGoogleAdSpend = googleAdSpendMetric?.value || 0;
    const currentAdSpend = currentMetaAdSpend + currentGoogleAdSpend;

    const previousAdSpend =
      derivePreviousValue(currentMetaAdSpend, metaAdSpendMetric?.change) +
      derivePreviousValue(currentGoogleAdSpend, googleAdSpendMetric?.change);

    const currentRoas =
      currentAdSpend > 0 ? currentRevenue / currentAdSpend : 0;
    const previousRoas =
      previousAdSpend > 0 ? previousRevenue / previousAdSpend : 0;

    return {
      value: currentRoas,
      change: computePercentChange(currentRoas, previousRoas),
    };
  }, [channelRevenue, overviewMetrics]);

  const onboardingStatus = useQuery(api.core.onboarding.getOnboardingStatus);
  const integrationStatus = useQuery(api.core.status.getIntegrationStatus);
  const shopifyIntegration = integrationStatus?.shopify;
  const metaIntegration = integrationStatus?.meta;
  // Useful for correcting progress numbers when DB already has orders
  const kpiOrdersValue = overviewMetrics?.orders?.value || 0;
  // Determine if any platform is actively running initial sync or failed
  const { syncBannerVisible, bannerVariant } = useMemo(() => {
    const activeStates = new Set(["pending", "processing", "syncing"]);
    type Overall = 'unsynced' | 'syncing' | 'complete' | 'failed';
    const shopifyOverall = (onboardingStatus?.syncStatus?.shopify as { overallState?: Overall } | undefined)?.overallState;
    const metaOverall = (onboardingStatus?.syncStatus?.meta as { overallState?: Overall } | undefined)?.overallState;
    const shopifyState = onboardingStatus?.syncStatus?.shopify?.status;
    const metaState = onboardingStatus?.syncStatus?.meta?.status;
    const shopifyConnected = shopifyIntegration?.connected ?? onboardingStatus?.connections?.shopify ?? false;
    const metaConnected = metaIntegration?.connected ?? onboardingStatus?.connections?.meta ?? false;
    const shopifyComplete = shopifyIntegration?.initialSynced ?? (shopifyOverall === 'complete');
    const metaComplete = metaIntegration?.initialSynced ?? (metaOverall === 'complete');
    const shopifyFailed = shopifyOverall === 'failed' || shopifyState === 'failed';
    const metaFailed = metaOverall === 'failed' || metaState === 'failed';

    const shopifySyncing =
      shopifyConnected && !shopifyComplete && !shopifyFailed &&
      (shopifyOverall === 'syncing' || (shopifyState && activeStates.has(shopifyState)));
    const metaSyncing =
      metaConnected && !metaComplete && !metaFailed &&
      (metaOverall === 'syncing' || (metaState && activeStates.has(metaState)));

    const hasActive = shopifySyncing || metaSyncing;
    const hasFailed = shopifyFailed || metaFailed;

    return {
      syncBannerVisible: hasActive || hasFailed,
      bannerVariant: hasFailed ? ("danger" as const) : ("warning" as const),
    };
  }, [onboardingStatus, shopifyIntegration, metaIntegration]);

  const syncStatusSummaries = useMemo(() => {
    if (!syncBannerVisible) return [] as string[];

    const summaries: string[] = [];

    {
      const shopify = onboardingStatus?.syncStatus?.shopify;

      if (shopify) {
        const denom =
          shopifyIntegration?.expectedOrders ??
          (typeof shopify.totalOrdersSeen === 'number'
            ? shopify.totalOrdersSeen
            : typeof shopify.ordersQueued === 'number' && shopify.ordersQueued > 0
              ? shopify.ordersQueued
              : undefined);

        let normalizedStatus = shopifyIntegration?.initialSynced
          ? 'completed'
          : shopify.overallState === 'complete'
            ? 'completed'
            : shopify.status
              ? shopify.status.replace(/_/g, ' ')
              : 'in progress';

        const ordersInDb = shopifyIntegration?.ordersInDb ?? 0;
        const rawProcessed = typeof shopify.ordersProcessed === 'number' ? shopify.ordersProcessed : 0;
        const processedBase = Math.max(rawProcessed, ordersInDb, kpiOrdersValue);

        let processedText = '';
        if (denom !== undefined && denom > 0) {
          const corrected = Math.min(denom, processedBase);
          if (corrected >= denom) {
            normalizedStatus = 'completed';
          }
          processedText = ` • Orders processed: ${corrected} of ${denom}`;
        } else if (processedBase > 0) {
          processedText = ` • Orders processed: ${processedBase}`;
        } else if (shopify.recordsProcessed) {
          processedText = ` • Records processed: ${shopify.recordsProcessed}`;
        }

        summaries.push(`Shopify: ${normalizedStatus}${processedText}`);
      } else {
        summaries.push("Shopify: pending");
      }
    }

    {
      const meta = onboardingStatus?.syncStatus?.meta;

      if (meta) {
        type Overall = 'unsynced' | 'syncing' | 'complete' | 'failed';
        const normalizedStatus = metaIntegration?.initialSynced
          ? 'completed'
          : ((meta as { overallState?: Overall } | undefined)?.overallState === 'complete')
            ? 'completed'
            : meta.status
              ? meta.status.replace(/_/g, " ")
              : "in progress";
        summaries.push(`Meta: ${normalizedStatus}`);
      } else {
        summaries.push("Meta: pending");
      }
    }

    return summaries;
  }, [onboardingStatus, syncBannerVisible, kpiOrdersValue, shopifyIntegration, metaIntegration]);

  // Combine all metrics data
  const allMetricsData = useMemo(() => {
    const { isLoading: _platformLoading, ...platformNumbers } =
      platformMetrics || {};
    return {
      // Overview metrics
      revenue: overviewMetrics?.revenue?.value || 0,
      netProfit: overviewMetrics?.netProfit?.value || 0,
      netProfitMargin: overviewMetrics?.netProfitMargin?.value || 0,
      orders: overviewMetrics?.orders?.value || 0,
      avgOrderValue: overviewMetrics?.avgOrderValue?.value || 0,
      blendedRoas: overviewMetrics?.blendedRoas?.value || 0,

      // Revenue & Margins
      grossSales: overviewMetrics?.revenue?.value ?? 0,
      discounts: overviewMetrics?.discounts?.value || 0,
      discountRate: overviewMetrics?.discountRate?.value || 0,
      grossProfit: overviewMetrics?.grossProfit?.value || 0,
      grossProfitMargin: overviewMetrics?.grossProfitMargin?.value || 0,
      contributionMargin: overviewMetrics?.contributionMargin?.value || 0,
      contributionMarginPercentage:
        overviewMetrics?.contributionMarginPercentage?.value || 0,
      operatingMargin: overviewMetrics?.operatingMargin?.value || 0,

      // Marketing
      totalAdSpend: overviewMetrics?.totalAdSpend?.value || 0,
      metaAdSpend: overviewMetrics?.metaAdSpend?.value || 0,
      metaSpendPercentage: overviewMetrics?.metaSpendPercentage?.value || 0,
      marketingPercentageOfGross:
        overviewMetrics?.marketingPercentageOfGross?.value || 0,
      marketingPercentageOfNet:
        overviewMetrics?.marketingPercentageOfNet?.value || 0,
      metaROAS: overviewMetrics?.metaROAS?.value || 0,

      // Growth
      moMRevenueGrowth: overviewMetrics?.moMRevenueGrowth?.value || 0,
      calendarMoMRevenueGrowth:
        overviewMetrics?.calendarMoMRevenueGrowth?.value || 0,

      // Costs
      cogs: overviewMetrics?.cogs?.value || 0,
      cogsPercentageOfGross: overviewMetrics?.cogsPercentageOfGross?.value || 0,
      cogsPercentageOfNet: overviewMetrics?.cogsPercentageOfNet?.value || 0,
      shippingCosts: overviewMetrics?.shippingCosts?.value || 0,
      shippingPercentageOfNet:
        overviewMetrics?.shippingPercentageOfNet?.value || 0,
      transactionFees: overviewMetrics?.transactionFees?.value || 0,
      taxesCollected: overviewMetrics?.taxesCollected?.value || 0,
      taxesPercentageOfRevenue:
        overviewMetrics?.taxesPercentageOfRevenue?.value || 0,

      // Customers
      returningCustomers: overviewMetrics?.returningCustomers?.value || 0,
      repeatCustomerRate: overviewMetrics?.repeatCustomerRate?.value || 0,
      customerAcquisitionCost:
        overviewMetrics?.customerAcquisitionCost?.value || 0,
      cacPercentageOfAOV: overviewMetrics?.cacPercentageOfAOV?.value || 0,

      // Units
      unitsSold: overviewMetrics?.unitsSold?.value || 0,
      avgOrderProfit:
        overviewMetrics?.avgOrderProfit?.value ??
        (overviewMetrics?.orders?.value && overviewMetrics?.netProfit?.value
          ? overviewMetrics.netProfit.value /
            overviewMetrics.orders.value
          : 0),
      profitPerOrder: overviewMetrics?.profitPerOrder?.value || 0,
      profitPerUnit: overviewMetrics?.profitPerUnit?.value || 0,

      // Additional costs for widgets
      handlingFees: overviewMetrics?.handlingFees?.value || 0,
      customCosts: overviewMetrics?.customCosts?.value || 0,

      // Widget-specific metrics
      poas:
        overviewMetrics?.poas?.value ??
        (overviewMetrics?.netProfit?.value &&
        overviewMetrics?.totalAdSpend?.value
          ? overviewMetrics.netProfit.value /
            overviewMetrics.totalAdSpend.value
          : 0),
      roasUTM: utmRoas.value,
      roasUTMChange: utmRoas.change,
      ncROAS: overviewMetrics?.ncROAS?.value || 0,
      repurchaseRate: overviewMetrics?.repeatCustomerRate?.value || 0,
      returnRate: overviewMetrics?.returnRate?.value || 0,
      adSpendPerOrder:
        overviewMetrics?.adSpendPerOrder?.value ??
        (overviewMetrics?.orders?.value &&
        overviewMetrics?.totalAdSpend?.value
          ? overviewMetrics.totalAdSpend.value / overviewMetrics.orders.value
          : 0),
      avgOrderCost:
        overviewMetrics?.avgOrderCost?.value ??
        (overviewMetrics?.avgOrderValue?.value &&
        overviewMetrics?.avgOrderProfit?.value
          ? overviewMetrics.avgOrderValue.value -
            overviewMetrics.avgOrderProfit.value
          : 0),
      // Platform metrics (numbers only)
      ...(platformNumbers as Record<string, number>),
    };
  }, [overviewMetrics, platformMetrics, utmRoas]);

  const handleCustomizationApply = useCallback(
    async (kpiItems: string[], widgetItems: string[]) => {
      await saveConfig({
        kpis: kpiItems,
        widgets: widgetItems,
      });
      setIsCustomizing(false);
    },
    [saveConfig]
  );

  const isLoading = configLoading || metricsLoading;

  // Prepare export data
  const prepareExportData = useCallback(async () => {
    const exportData: Record<string, unknown>[] = [];

    // Export KPI metrics
    config.kpis.forEach((metricKey: string) => {
      const metricData = overviewMetrics?.[metricKey as keyof typeof overviewMetrics];
      if (metricData && typeof metricData === 'object' && 'value' in metricData) {
        exportData.push({
          category: "KPI",
          metric: metricKey,
          value: metricData.value,
          change: 'change' in metricData ? metricData.change : undefined,
          changePercent: 'changePercent' in metricData ? metricData.changePercent : undefined,
          trend: 'trend' in metricData ? metricData.trend : undefined,
        });
      }
    });

    // Export widget metrics
    config.widgets.forEach((widgetKey: string) => {
      const value = allMetricsData[widgetKey as keyof typeof allMetricsData];
      if (value !== undefined) {
        exportData.push({
          category: "Widget",
          metric: widgetKey,
          value: value,
        });
      }
    });

    return exportData;
  }, [config.kpis, config.widgets, overviewMetrics, allMetricsData]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <Spacer y={0.5} />
      <DashboardHeader
        onCustomize={() => setIsCustomizing(true)}
        exportData={prepareExportData}
      />

      {/* Data Status Chips removed */}

      {syncBannerVisible && (
        <Card
          className={
            bannerVariant === "danger"
              ? "border-danger bg-danger-50/40"
              : "border-warning bg-warning-50/40"
          }
        >
          <CardBody className="flex flex-col gap-3 text-default-700">
            <div className="flex items-start gap-3">
              <div
                className={
                  bannerVariant === "danger"
                    ? "mt-0.5 flex-none text-danger-500"
                    : "mt-0.5 flex-none text-warning-500"
                }
              >
                <Spinner size="sm" color={bannerVariant} />
              </div>
              <div className="space-y-1">
                <p
                  className={
                    bannerVariant === "danger"
                      ? "font-medium text-danger-600"
                      : "font-medium text-warning-600"
                  }
                >
                  {bannerVariant === "danger"
                    ? "Sync needs attention"
                    : "We’re still syncing your data"}
                </p>
                <p className="text-sm leading-relaxed">
                  Dashboards will update automatically once the initial imports finish. Feel free to keep exploring in the meantime.
                </p>
                {syncStatusSummaries.length > 0 && (
                  <div
                    className={
                      bannerVariant === "danger"
                        ? "flex flex-col gap-1 text-xs uppercase tracking-wide text-danger-500"
                        : "flex flex-col gap-1 text-xs uppercase tracking-wide text-warning-500"
                    }
                  >
                    {syncStatusSummaries.map((summary) => (
                      <span key={summary}>{summary}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Sync Status removed: syncs run automatically; manual disabled */}

      {/* Plan Usage Alert */}
      <PlanUsageAlert variant="compact" />

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
      {devToolsVisible && (
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
