import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View, RefreshControl } from "react-native";
import { KPICard } from "@/components/analytics/KPICard";
import CostBreakdownCard from "@/components/analytics/CostBreakdownCard";
import { DateRangePickerButton } from "@/components/shared/DateRangePicker";
import { useOverviewAnalytics, useCostBreakdown } from "@/hooks/useAnalytics";
import { useUserDetails } from "@/hooks/useUserDetails";
// import { useRouter } from "expo-router";

export default function OverviewTab() {
  const [refreshing, setRefreshing] = useState(false);
  const { metrics, isLoading } = useOverviewAnalytics();
  const { totals: costTotals, metaSpend } = useCostBreakdown();
  const { user } = useUserDetails();
  // const router = useRouter();

  const primaryCurrency = (user as any)?.currency || "USD";
  const currencySymbol = primaryCurrency === "EUR" ? "€" : "$";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force refresh by waiting a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="flex-1 gap-6 px-4 py-3">
          {/* Header with Date Picker */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Analytics
                </Text>
                <Text className="text-2xl font-bold text-foreground">
                  Overview
                </Text>
              </View>
              <DateRangePickerButton />
            </View>
            <Text className="text-sm text-default-500">
              Track your store performance and marketing metrics
            </Text>
          </View>

          {/* Main Metrics (layout: 1 full → 2-in → 2-in) */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-default-600">Key Metrics</Text>
            {/* 1) Full-width KPI */}
            <View className="mb-4">
              <KPICard
                title="Revenue"
                value={metrics?.revenue.value ?? 0}
                change={metrics?.revenue.change}
                format="currency"
                currencySymbol={currencySymbol}
                icon="cash-outline"
                iconColor="#10b981"
                loading={isLoading}
              />
            </View>
            {/* 2) Two-in row: Net Profit + Meta Cost */}
            <View className="flex-row -mx-2">
              <View className="w-1/2 px-2">
                <KPICard
                  title="Net Profit"
                  value={metrics?.netProfit.value ?? 0}
                  change={metrics?.netProfit.change}
                  format="currency"
                  currencySymbol={currencySymbol}
                  icon="wallet-outline"
                  iconColor="#10b981"
                  loading={isLoading}
                />
              </View>
              <View className="w-1/2 px-2">
                <KPICard
                  title="Meta Cost"
                  value={metaSpend || 0}
                  change={0}
                  format="currency"
                  currencySymbol={currencySymbol}
                  icon="logo-facebook"
                  iconColor="#1877f2"
                  loading={isLoading}
                />
              </View>
            </View>
          {/* 3) Two-in row: Orders + Profit Margin */}
          <View className="flex-row -mx-2">
            <View className="w-1/2 px-2">
              <KPICard
                title="Total Orders"
                value={metrics?.orders.value ?? 0}
                // change intentionally omitted until implemented
                format="number"
                icon="cart-outline"
                iconColor="#3b82f6"
                loading={isLoading}
              />
            </View>
            <View className="w-1/2 px-2">
              <KPICard
                title="Profit Margin"
                value={metrics?.profitMargin.value ?? 0}
                change={metrics?.profitMargin.change}
                format="percent"
                icon="analytics-outline"
                iconColor="#6366f1"
                loading={isLoading}
              />
            </View>
          </View>

          {/* 4) Two-in row: AOV + Gross Profit */}
          <View className="flex-row -mx-2">
            <View className="w-1/2 px-2">
              <KPICard
                title="Average Order Value"
                value={metrics?.avgOrderValue.value ?? 0}
                format="currency"
                currencySymbol={currencySymbol}
                icon="pricetags-outline"
                iconColor="#14b8a6"
                loading={isLoading}
              />
            </View>
            <View className="w-1/2 px-2">
              <KPICard
                title="Gross Profit"
                value={metrics?.grossProfit.value ?? 0}
                change={metrics?.grossProfit.change}
                format="currency"
                currencySymbol={currencySymbol}
                icon="bar-chart-outline"
                iconColor="#8b5cf6"
                loading={isLoading}
              />
            </View>
          </View>
          </View>

          {/* Donut cost breakdown */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-default-600">Costs</Text>
            <CostBreakdownCard
              items={[
                { key: 'ad', label: 'Ad Spend', value: costTotals?.adSpend || 0, color: '#2563EB' },
                { key: 'cogs', label: 'COGS', value: costTotals?.cogs || 0, color: '#16A34A' },
                { key: 'ship', label: 'Shipping', value: costTotals?.shipping || 0, color: '#F97316' },
                { key: 'txn', label: 'Transaction', value: costTotals?.transaction || 0, color: '#7C3AED' },
                { key: 'custom', label: 'Custom', value: costTotals?.custom || 0, color: '#DB2777' },
                { key: 'handling', label: 'Handling', value: costTotals?.handling || 0, color: '#0D9488' },
              ]}
              currencySymbol={currencySymbol}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
