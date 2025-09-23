"use client";

type OverviewMetricView = { value: number; change?: number };
type OverviewMetricsView = Record<string, OverviewMetricView>;

import { AdSpendSummaryWidget } from "../widgets/AdSpendSummaryWidget";
import { CostBreakdownWidget } from "../widgets/CostBreakdownWidget";
import { CustomerSummaryWidget } from "../widgets/CustomerSummaryWidget";
import { OrderSummaryWidget } from "../widgets/OrderSummaryWidget";

interface WidgetRendererProps {
  widgetId: string;
  metricsData: Record<string, number>;
  overviewMetrics: OverviewMetricsView | null;
  primaryCurrency: string;
  showCostSetupWarning: boolean;
  isLoading: boolean;
}

export function WidgetRenderer({
  widgetId,
  metricsData,
  overviewMetrics,
  primaryCurrency,
  showCostSetupWarning,
  isLoading,
}: WidgetRendererProps) {
  switch (widgetId) {
    case "adSpendSummary":
      return (
        <AdSpendSummaryWidget
          adSpendChange={overviewMetrics?.totalAdSpend?.change ?? 0}
          currency={primaryCurrency}
          loading={isLoading}
          ncROAS={metricsData.ncROAS ?? 0}
          ncROASChange={0}
          poas={metricsData.poas ?? 0}
          poasChange={0}
          roas={metricsData.blendedRoas ?? 0}
          roasChange={overviewMetrics?.blendedRoas?.change ?? 0}
          roasUTM={metricsData.roasUTM ?? 0}
          roasUTMChange={0}
          totalAdSpend={metricsData.totalAdSpend ?? 0}
        />
      );
    case "costBreakdown":
      return (
        <CostBreakdownWidget
          cogs={metricsData.cogs ?? 0}
          currency={primaryCurrency}
          customCosts={metricsData.customCosts ?? 0}
          handlingFees={metricsData.handlingFees ?? 0}
          loading={isLoading}
          operatingCosts={metricsData.operatingCosts ?? 0}
          shippingCosts={metricsData.shippingCosts ?? 0}
          showCostSetupWarning={showCostSetupWarning}
          totalAdSpend={metricsData.totalAdSpend ?? 0}
          totalRevenue={metricsData.revenue ?? 0}
          transactionFees={metricsData.transactionFees ?? 0}
        />
      );
    case "customerSummary":
      return (
        <CustomerSummaryWidget
          cac={metricsData.customerAcquisitionCost ?? 0}
          cacChange={overviewMetrics?.customerAcquisitionCost?.change ?? 0}
          currency={primaryCurrency}
          loading={isLoading}
          newCustomers={metricsData.newCustomers ?? 0}
          newCustomersChange={overviewMetrics?.newCustomers?.change ?? 0}
          repurchaseRate={metricsData.repurchaseRate ?? 0}
          repurchaseRateChange={overviewMetrics?.repeatCustomerRate?.change ?? 0}
          returnRate={metricsData.returnRate || 0}
          returnRateChange={overviewMetrics?.returnRate?.change ?? 0}
          totalCustomers={metricsData.totalCustomers ?? 0}
          totalCustomersChange={overviewMetrics?.totalCustomers?.change ?? 0}
        />
      );
    case "orderSummary":
      return (
        <OrderSummaryWidget
          adSpendPerOrder={metricsData.adSpendPerOrder ?? 0}
          adSpendPerOrderChange={0}
          avgOrderCost={metricsData.avgOrderCost ?? 0}
          avgOrderCostChange={0}
          avgOrderProfit={metricsData.avgOrderProfit ?? 0}
          avgOrderProfitChange={overviewMetrics?.avgOrderProfit?.change ?? 0}
          avgOrderValue={metricsData.avgOrderValue ?? 0}
          avgOrderValueChange={overviewMetrics?.avgOrderValue?.change ?? 0}
          currency={primaryCurrency}
          loading={isLoading}
        />
      );
    default:
      return null;
  }
}
