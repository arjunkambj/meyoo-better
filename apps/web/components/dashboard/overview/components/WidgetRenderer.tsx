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
          adSpendChange={overviewMetrics?.blendedMarketingCost?.change ?? 0}
          currency={primaryCurrency}
          loading={isLoading}
          ncROAS={metricsData.ncROAS ?? 0}
          ncROASChange={overviewMetrics?.ncROAS?.change ?? 0}
          poas={metricsData.poas ?? 0}
          poasChange={overviewMetrics?.poas?.change ?? 0}
          roas={metricsData.blendedRoas ?? 0}
          roasChange={overviewMetrics?.blendedRoas?.change ?? 0}
          roasUTM={overviewMetrics?.roasUTM?.value ?? metricsData.roasUTM ?? 0}
          roasUTMChange={overviewMetrics?.roasUTM?.change ?? 0}
          totalAdSpend={metricsData.blendedMarketingCost ?? 0}
        />
      );
    case "costBreakdown":
      return (
        <CostBreakdownWidget
          cogs={metricsData.cogs ?? 0}
          currency={primaryCurrency}
          handlingFees={metricsData.handlingFees ?? 0}
          loading={isLoading}
          operatingCosts={metricsData.customCosts ?? 0}
          shippingCosts={metricsData.shippingCosts ?? 0}
          showCostSetupWarning={showCostSetupWarning}
          taxes={metricsData.taxesCollected ?? 0}
          totalAdSpend={metricsData.blendedMarketingCost ?? 0}
          totalRevenue={metricsData.revenue ?? 0}
          transactionFees={metricsData.transactionFees ?? 0}
        />
      );
    case "customerSummary":
      return (
        <CustomerSummaryWidget
          loading={isLoading}
          totalCustomers={metricsData.totalCustomers ?? 0}
          totalCustomersChange={overviewMetrics?.totalCustomers?.change ?? 0}
          returningCustomers={metricsData.returningCustomers ?? 0}
          returningCustomersChange={
            overviewMetrics?.returningCustomers?.change ?? 0
          }
          newCustomers={metricsData.newCustomers ?? 0}
          newCustomersChange={overviewMetrics?.newCustomers?.change ?? 0}
          repurchaseRate={metricsData.repurchaseRate ?? 0}
          repurchaseRateChange={overviewMetrics?.repeatCustomerRate?.change ?? 0}
          abandonedCustomers={metricsData.abandonedCustomers ?? 0}
          abandonedRate={metricsData.abandonedRate ?? 0}
          abandonedRateChange={
            overviewMetrics?.abandonedRate?.change ?? 0
          }
        />
      );
    case "orderSummary":
      return (
        <OrderSummaryWidget
          adSpendPerOrder={metricsData.adSpendPerOrder ?? 0}
          adSpendPerOrderChange={
            overviewMetrics?.adSpendPerOrder?.change ?? 0
          }
          avgOrderProfit={metricsData.avgOrderProfit ?? 0}
          avgOrderProfitChange={overviewMetrics?.avgOrderProfit?.change ?? 0}
          avgOrderValue={metricsData.avgOrderValue ?? 0}
          avgOrderValueChange={overviewMetrics?.avgOrderValue?.change ?? 0}
          prepaidRate={metricsData.prepaidRate ?? 0}
          prepaidRateChange={overviewMetrics?.prepaidRate?.change ?? 0}
          repeatRate={metricsData.repeatCustomerRate ?? 0}
          repeatRateChange={overviewMetrics?.repeatCustomerRate?.change ?? 0}
          currency={primaryCurrency}
          loading={isLoading}
        />
      );
    default:
      return null;
  }
}
