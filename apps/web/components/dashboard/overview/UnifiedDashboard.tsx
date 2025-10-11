"use client";

import { Spacer } from "@heroui/react";
import { useAtomValue } from "jotai";
import React, { useCallback, useMemo, useState } from "react";
import {
  useAnalyticsDateRange,
  useDashboardOverview,
  useInitialSyncStatus,
  useUser,
} from "@/hooks";
import { devToolsVisibleAtom } from "@/store/atoms";
import { DEFAULT_DASHBOARD_CONFIG, type ChannelRevenueBreakdown } from "@repo/types";

import { CustomizationModalUnified } from "./CustomizationModalUnified";
import { DashboardHeader } from "./components/DashboardHeader";
import { MetricsContainer } from "./components/MetricsContainer";
import { SyncStatusCard } from "./components/SyncStatusCard";
import { WidgetsContainer } from "./components/WidgetsContainer";
import { DevTools } from "./DevTools";

type OverviewMetricView = {
  value: number;
  change?: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  decimal?: number;
};

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
  const {
    analyticsRange: overviewRange,
    calendarRange: overviewCalendarRange,
    preset: overviewPreset,
    updateRange: updateOverviewRange,
  } = useAnalyticsDateRange('dashboard-overview', { defaultPreset: 'today', sharedKey: null });
  const devToolsVisible = useAtomValue(devToolsVisibleAtom);
  const { role } = useUser();
  const canViewDevTools = role === 'StoreOwner';

  const {
    isLoading,
    overviewMetrics,
    platformMetrics,
    channelRevenue,
    dashboardConfig,
    saveConfig,
    primaryCurrency,
  } = useDashboardOverview({ startDate: overviewRange.startDate, endDate: overviewRange.endDate });

  const {
    isLoading: isSyncStatusLoading,
    shouldDisplay: shouldShowSyncCard,
    data: syncCardData,
  } = useInitialSyncStatus();

  // Note: Cost setup status is now tracked in onboarding table
  const showCostSetupWarning = false; // TODO: Get from onboarding status when needed

  const config = dashboardConfig;
  const channelBreakdown: ChannelRevenueBreakdown | undefined = channelRevenue ?? undefined;

  const utmRoas = useMemo(() => {
    const channels = channelBreakdown?.channels ?? [];
    if (channels.length === 0) {
      return { value: 0, change: 0 };
    }

    const paidChannels = channels.filter((channel) =>
      ["Meta Ads"].includes(channel.name),
    );

    const currentRevenue = paidChannels.reduce((sum, channel) => sum + (channel.revenue || 0), 0);

    const previousRevenue = paidChannels.reduce((sum, channel) => {
      const prev = derivePreviousValue(channel.revenue || 0, channel.change);

      return sum + prev;
    }, 0);

    const metaAdSpendMetric =
      (overviewMetrics?.metaAdSpend as OverviewMetricView | undefined) ||
      undefined;

    const currentMetaAdSpend = metaAdSpendMetric?.value || 0;
    const currentAdSpend = currentMetaAdSpend;

    const previousAdSpend =
      derivePreviousValue(currentMetaAdSpend, metaAdSpendMetric?.change);

    const currentRoas =
      currentAdSpend > 0 ? currentRevenue / currentAdSpend : 0;
    const previousRoas =
      previousAdSpend > 0 ? previousRevenue / previousAdSpend : 0;

    return {
      value: currentRoas,
      change: computePercentChange(currentRoas, previousRoas),
    };
  }, [channelBreakdown, overviewMetrics]);

  // Combine all metrics data
  const allMetricsData = useMemo(() => {
    const platformNumbers = platformMetrics as unknown as Record<string, number>;
    return {
      // Overview metrics
      revenue: overviewMetrics?.revenue?.value || 0,
      netProfit: overviewMetrics?.netProfit?.value || 0,
      netProfitMargin: overviewMetrics?.netProfitMargin?.value || 0,
      orders: overviewMetrics?.orders?.value || 0,
      avgOrderValue: overviewMetrics?.avgOrderValue?.value || 0,
      blendedRoas: overviewMetrics?.blendedRoas?.value || 0,
      prepaidRate: overviewMetrics?.prepaidRate?.value || 0,

      // Revenue & Margins
      grossSales: overviewMetrics?.revenue?.value ?? 0,
      discounts: overviewMetrics?.discounts?.value || 0,
      discountRate: overviewMetrics?.discountRate?.value || 0,
      rtoRevenueLost: overviewMetrics?.rtoRevenueLost?.value || 0,
      manualReturnRate: overviewMetrics?.manualReturnRate?.value || 0,
      grossProfit: overviewMetrics?.grossProfit?.value || 0,
      grossProfitMargin: overviewMetrics?.grossProfitMargin?.value || 0,
      contributionMargin: overviewMetrics?.contributionMargin?.value || 0,
      contributionMarginPercentage:
        overviewMetrics?.contributionMarginPercentage?.value || 0,
      operatingMargin: overviewMetrics?.operatingMargin?.value || 0,

      // Marketing
      blendedMarketingCost: overviewMetrics?.blendedMarketingCost?.value || 0,
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
      totalCustomers: overviewMetrics?.totalCustomers?.value || 0,
      newCustomers: overviewMetrics?.newCustomers?.value || 0,
      returningCustomers: overviewMetrics?.returningCustomers?.value || 0,
      repeatCustomerRate: overviewMetrics?.repeatCustomerRate?.value || 0,
      abandonedCustomers: overviewMetrics?.abandonedCustomers?.value || 0,
      abandonedRate: overviewMetrics?.abandonedRate?.value || 0,
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
        overviewMetrics?.blendedMarketingCost?.value
          ? overviewMetrics.netProfit.value /
            overviewMetrics.blendedMarketingCost.value
          : 0),
      roasUTM: utmRoas.value,
      roasUTMChange: utmRoas.change,
      ncROAS: overviewMetrics?.ncROAS?.value || 0,
      repurchaseRate: overviewMetrics?.repeatCustomerRate?.value || 0,
      returnRate: overviewMetrics?.returnRate?.value || 0,
      adSpendPerOrder:
        overviewMetrics?.adSpendPerOrder?.value ??
        (overviewMetrics?.orders?.value &&
        overviewMetrics?.blendedMarketingCost?.value
          ? overviewMetrics.blendedMarketingCost.value /
            overviewMetrics.orders.value
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
