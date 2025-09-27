import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ScrollView,
  Text,
  View,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { KPICard, KPIGrid } from "@/components/analytics/KPICard";
import { DateRangePickerButton } from "@/components/shared/DateRangePicker";

import { useOverviewAnalytics, usePlatformMetrics } from "@/hooks/useAnalytics";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useRouter } from "expo-router";

export default function OverviewTab() {
  const [refreshing, setRefreshing] = useState(false);
  const { metrics, isLoading } = useOverviewAnalytics();
  const { shopify, meta, google } = usePlatformMetrics();
  const { user } = useUserDetails();
  const router = useRouter();

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

          {/* Main Metrics */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-default-600">
              Key Metrics
            </Text>
            <KPIGrid>
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
              <KPICard
                title="Orders"
                value={metrics?.orders.value ?? 0}
                change={metrics?.orders.change}
                format="number"
                icon="cart-outline"
                iconColor="#3b82f6"
                loading={isLoading}
              />
              <KPICard
                title="Avg Order Value"
                value={metrics?.avgOrderValue.value ?? 0}
                change={metrics?.avgOrderValue.change}
                format="currency"
                currencySymbol={currencySymbol}
                icon="pricetag-outline"
                iconColor="#f59e0b"
                loading={isLoading}
              />
              <KPICard
                title="Conversion Rate"
                value={metrics?.conversionRate.value ?? 0}
                change={metrics?.conversionRate.change}
                format="percent"
                icon="trending-up-outline"
                iconColor="#8b5cf6"
                loading={isLoading}
              />
            </KPIGrid>
          </View>

          {/* Profitability Metrics */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-default-600">
              Profitability
            </Text>
            <KPIGrid>
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
              <KPICard
                title="Profit Margin"
                value={metrics?.profitMargin.value ?? 0}
                change={metrics?.profitMargin.change}
                format="percent"
                icon="analytics-outline"
                iconColor="#6366f1"
                loading={isLoading}
              />
            </KPIGrid>
          </View>

          {/* Marketing Metrics */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-default-600">
              Marketing
            </Text>
            <KPIGrid>
              <KPICard
                title="Ad Spend"
                value={metrics?.totalAdSpend.value ?? 0}
                change={metrics?.totalAdSpend.change}
                format="currency"
                currencySymbol={currencySymbol}
                icon="megaphone-outline"
                iconColor="#ef4444"
                loading={isLoading}
              />
              <KPICard
                title="ROAS"
                value={metrics?.roas.value ?? 0}
                change={metrics?.roas.change}
                format="number"
                icon="rocket-outline"
                iconColor="#3b82f6"
                loading={isLoading}
              />
            </KPIGrid>
          </View>

          {/* Customer Metrics */}
          <View className="gap-4">
            <Text className="text-sm font-semibold text-default-600">
              Customers
            </Text>
            <KPIGrid>
              <KPICard
                title="Total Customers"
                value={metrics?.customers.value ?? 0}
                change={metrics?.customers.change}
                format="number"
                icon="people-outline"
                iconColor="#8b5cf6"
                loading={isLoading}
              />
              <KPICard
                title="Repeat Rate"
                value={metrics?.repeatRate.value ?? 0}
                change={metrics?.repeatRate.change}
                format="percent"
                icon="refresh-outline"
                iconColor="#f59e0b"
                loading={isLoading}
              />
            </KPIGrid>
          </View>

          {/* Platform Performance */}
          {(shopify || meta || google) && (
            <View className="gap-4">
              <Text className="text-sm font-semibold text-default-600">
                Platform Performance
              </Text>
              <View className="gap-3">
                {shopify && (
                  <KPICard
                    title="Shopify Revenue"
                    value={shopify.revenue?.value ?? 0}
                    change={shopify.revenue?.change}
                    format="currency"
                    currencySymbol={currencySymbol}
                    icon="storefront-outline"
                    iconColor="#5e8e3e"
                    loading={!shopify}
                  />
                )}
                {meta && (
                  <KPICard
                    title="Meta Ads Spend"
                    value={meta.spend?.value ?? 0}
                    change={meta.spend?.change}
                    format="currency"
                    currencySymbol={currencySymbol}
                    icon="logo-facebook"
                    iconColor="#1877f2"
                    loading={!meta}
                  />
                )}
                {google && (
                  <KPICard
                    title="Google Ads Spend"
                    value={google.spend?.value ?? 0}
                    change={google.spend?.change}
                    format="currency"
                    currencySymbol={currencySymbol}
                    icon="logo-google"
                    iconColor="#4285f4"
                    loading={!google}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
