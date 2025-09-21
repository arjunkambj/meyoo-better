"use client";

import { Spacer } from "@heroui/react";
import { useAtomValue } from "jotai";
import React, { useCallback, useMemo, useState } from "react";
import { PlanUsageAlert } from "@/components/shared/billing/PlanUsageAlert";
import {
  useDashboard,
  useOverviewAnalytics,
  usePlatformMetrics,
  useUser,
} from "@/hooks";
import { analyticsDateRangeAtom } from "@/store/atoms";

import { CustomizationModalUnified } from "./CustomizationModalUnified";
import { DashboardHeader } from "./components/DashboardHeader";
import { MetricsContainer } from "./components/MetricsContainer";
import { WidgetsContainer } from "./components/WidgetsContainer";

export const UnifiedDashboard = React.memo(function UnifiedDashboard() {
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Use global date range
  const dateRange = useAtomValue(analyticsDateRangeAtom);

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
      grossSales: overviewMetrics?.grossSales?.value || 0,
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
      shippingPercentageOfGross:
        overviewMetrics?.shippingPercentageOfGross?.value || 0,
      shippingPercentageOfNet:
        overviewMetrics?.shippingPercentageOfNet?.value || 0,
      transactionFees: overviewMetrics?.transactionFees?.value || 0,
      transactionFeesPercentage:
        overviewMetrics?.transactionFeesPercentage?.value || 0,
      taxesCollected: overviewMetrics?.taxesCollected?.value || 0,
      taxesPercentageOfRevenue:
        overviewMetrics?.taxesPercentageOfRevenue?.value || 0,

      // Customers
      totalCustomers: overviewMetrics?.totalCustomers?.value || 0,
      newCustomers: overviewMetrics?.newCustomers?.value || 0,
      returningCustomers: overviewMetrics?.returningCustomers?.value || 0,
      repeatCustomerRate: overviewMetrics?.repeatCustomerRate?.value || 0,
      customerAcquisitionCost:
        overviewMetrics?.customerAcquisitionCost?.value || 0,
      cacPercentageOfAOV: overviewMetrics?.cacPercentageOfAOV?.value || 0,

      // Units
      unitsSold: overviewMetrics?.unitsSold?.value || 0,
      avgOrderProfit: overviewMetrics?.avgOrderProfit?.value || 0,
      profitPerOrder: overviewMetrics?.profitPerOrder?.value || 0,
      profitPerUnit: overviewMetrics?.profitPerUnit?.value || 0,

      // Additional costs for widgets
      handlingFees: overviewMetrics?.handlingFees?.value || 0,
      customCosts: overviewMetrics?.customCosts?.value || 0,
      taxesPaid: overviewMetrics?.taxesPaid?.value || 0,
      operatingCosts: overviewMetrics?.operatingCosts?.value || 0,

      // Widget-specific metrics
      poas:
        overviewMetrics?.netProfit?.value &&
        overviewMetrics?.totalAdSpend?.value
          ? overviewMetrics.netProfit.value / overviewMetrics.totalAdSpend.value
          : 0,
      roasUTM: 0, // TODO: Calculate from UTM tracked orders
      ncROAS:
        overviewMetrics?.newCustomers?.value &&
        overviewMetrics?.totalAdSpend?.value
          ? (overviewMetrics.newCustomers.value *
              (overviewMetrics?.avgOrderValue?.value || 0)) /
            overviewMetrics.totalAdSpend.value
          : 0,
      repurchaseRate: overviewMetrics?.repeatCustomerRate?.value || 0,
      adSpendPerOrder:
        overviewMetrics?.orders?.value && overviewMetrics?.totalAdSpend?.value
          ? overviewMetrics.totalAdSpend.value / overviewMetrics.orders.value
          : 0,
      avgOrderCost:
        overviewMetrics?.avgOrderValue?.value &&
        overviewMetrics?.avgOrderProfit?.value
          ? overviewMetrics.avgOrderValue.value -
            overviewMetrics.avgOrderProfit.value
          : 0,
      // Platform metrics (numbers only)
      ...(platformNumbers as Record<string, number>),
    };
  }, [overviewMetrics, platformMetrics]);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <Spacer y={0.5} />
      <DashboardHeader onCustomize={() => setIsCustomizing(true)} />

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
