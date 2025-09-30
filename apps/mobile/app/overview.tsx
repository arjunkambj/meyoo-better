import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View, RefreshControl } from "react-native";
import { Spinner } from "heroui-native";
import { KPICard } from "@/components/analytics/KPICard";
import CostBreakdownCard from "@/components/analytics/CostBreakdownCard";
import { DateRangePickerButton } from "@/components/shared/DateRangePicker";
import { useOverviewAnalytics, useCostBreakdown } from "@/hooks/useAnalytics";
import { useUserDetails } from "@/hooks/useUserDetails";
import { CustomBottomNav } from "@/components/navigation/CustomBottomNav";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function OverviewTab() {
  const [refreshing, setRefreshing] = useState(false);

  // Auth guard - ensure user is authenticated before loading data
  const { isLoading: isAuthLoading } = useAuthGuard();

  const { metrics, isLoading } = useOverviewAnalytics();
  const { totals: costTotals, metaSpend } = useCostBreakdown();
  const { user } = useUserDetails();

  const primaryCurrency = (user as any)?.currency || "USD";
  const currencySymbol = primaryCurrency === "EUR" ? "€" : "$";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force refresh by waiting a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Show loading spinner while authentication is being checked
  if (isAuthLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <Spinner size="lg" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="flex-1 gap-6 px-6 py-4">
          {/* Header with Date Picker */}
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground">
                  Overview
                </Text>
              </View>
              <DateRangePickerButton />
            </View>
          </View>

          {/* Key Performance Section */}
          <View className="gap-5">
            {/* Revenue - Full width primary */}
            <KPICard
              title="Revenue (Net)"
              value={metrics?.revenue.value ?? 0}
              format="currency"
              currencySymbol={currencySymbol}
              icon="cash-outline"
              iconColor="#10b981"
              loading={isLoading}
              isPrimary
            />

            {/* 2x2 Grid for KPIs */}
            <View className="flex-row -mx-2">
              <View className="w-1/2 px-2">
                <KPICard
                  title="Net Profit"
                  value={metrics?.netProfit.value ?? 0}
                  format="currency"
                  currencySymbol={currencySymbol}
                  icon="wallet-outline"
                  iconColor="#10b981"
                  loading={isLoading}
                />
              </View>
              <View className="w-1/2 px-2">
                <KPICard
                  title="Profit Margin"
                  value={metrics?.profitMargin.value ?? 0}
                  format="percent"
                  icon="analytics-outline"
                  iconColor="#6366f1"
                  loading={isLoading}
                />
              </View>
            </View>

            <View className="flex-row -mx-2">
              <View className="w-1/2 px-2">
                <KPICard
                  title="Total Orders"
                  value={metrics?.orders.value ?? 0}
                  format="number"
                  icon="cart-outline"
                  iconColor="#3b82f6"
                  loading={isLoading}
                />
              </View>
              <View className="w-1/2 px-2">
                <KPICard
                  title="Avg Order Value"
                  value={metrics?.avgOrderValue.value ?? 0}
                  format="currency"
                  currencySymbol={currencySymbol}
                  icon="pricetags-outline"
                  iconColor="#14b8a6"
                  loading={isLoading}
                />
              </View>
            </View>

            <View className="flex-row -mx-2">
              <View className="w-1/2 px-2">
                <KPICard
                  title="Gross Profit"
                  value={metrics?.grossProfit.value ?? 0}
                  format="currency"
                  currencySymbol={currencySymbol}
                  icon="trending-up-outline"
                  iconColor="#8b5cf6"
                  loading={isLoading}
                />
              </View>
              <View className="w-1/2 px-2">
                <KPICard
                  title="Meta Ad Spend"
                  value={metaSpend || 0}
                  format="currency"
                  currencySymbol={currencySymbol}
                  icon="logo-facebook"
                  iconColor="#1877f2"
                  loading={isLoading}
                />
              </View>
            </View>
          </View>

          {/* Cost Analysis Section */}
          <View className="gap-5">
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
      <CustomBottomNav />
    </SafeAreaView>
  );
}
