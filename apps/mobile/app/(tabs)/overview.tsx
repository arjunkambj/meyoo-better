import { useCallback, useMemo, useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ScrollView, Text, View, RefreshControl } from "react-native";

import { KPICard, type KPICardProps } from "@/components/analytics/KPICard";
import { DateRangePickerButton } from "@/components/shared/DateRangePicker";
import { useOverviewAnalytics } from "@/hooks/useAnalytics";
import { useUserDetails } from "@/hooks/useUserDetails";
import { getCurrencySymbol } from "@/libs/format";

interface CardConfig {
  title: KPICardProps["title"];
  value: KPICardProps["value"];
  change?: KPICardProps["change"];
  format?: KPICardProps["format"];
  icon?: KPICardProps["icon"];
  iconColor?: KPICardProps["iconColor"];
  isPrimary?: KPICardProps["isPrimary"];
  currencySymbol?: KPICardProps["currencySymbol"];
}

export default function OverviewTab() {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const { metrics, isLoading } = useOverviewAnalytics();
  const { user } = useUserDetails();

  const primaryCurrency = (user as any)?.currency || "USD";
  const currencySymbol = useMemo(
    () => getCurrencySymbol(primaryCurrency),
    [primaryCurrency]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force refresh by waiting a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const ratioLabel = useCallback((value?: number, digits = 2) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return `${(0).toFixed(digits)}x`;
    }
    return `${Number(value).toFixed(digits)}x`;
  }, []);

  const cards: Record<string, CardConfig> = useMemo(
    () => ({
      revenue: {
        title: "Revenue (Net)",
        value: metrics?.revenue.value ?? 0,
        change: metrics?.revenue.change,
        format: "currency",
        icon: "cash-outline",
        iconColor: "#10b981",
        isPrimary: true,
        currencySymbol,
      },
      orders: {
        title: "Orders",
        value: metrics?.orders.value ?? 0,
        change: metrics?.orders.change,
        format: "number",
        icon: "cart-outline",
        iconColor: "#3b82f6",
      },
      customers: {
        title: "Customers",
        value: metrics?.customers?.value ?? 0,
        change: metrics?.customers?.change,
        format: "number",
        icon: "people-outline",
        iconColor: "#6366f1",
      },
      avgOrderValue: {
        title: "Avg Order Value",
        value: metrics?.avgOrderValue.value ?? 0,
        change: metrics?.avgOrderValue.change,
        format: "currency",
        icon: "pricetags-outline",
        iconColor: "#14b8a6",
        currencySymbol,
      },
      repeatRate: {
        title: "Repeat Purchase Rate",
        value: metrics?.repeatRate?.value ?? 0,
        change: metrics?.repeatRate?.change,
        format: "percent",
        icon: "refresh-outline",
        iconColor: "#22c55e",
      },
      netProfit: {
        title: "Net Profit",
        value: metrics?.netProfit.value ?? 0,
        change: metrics?.netProfit.change,
        format: "currency",
        icon: "wallet-outline",
        iconColor: "#0ea5e9",
        isPrimary: true,
        currencySymbol,
      },
      totalAdSpend: {
        title: "Total Ad Spend",
        value: metrics?.totalAdSpend.value ?? 0,
        change: metrics?.totalAdSpend.change,
        format: "currency",
        icon: "megaphone-outline",
        iconColor: "#f97316",
        isPrimary: true,
        currencySymbol,
      },
      roas: {
        title: "ROAS",
        value: ratioLabel(metrics?.roas?.value ?? 0),
        change: metrics?.roas?.change,
        icon: "flash-outline",
        iconColor: "#f59e0b",
      },
      moMRevenueGrowth: {
        title: "MoM Revenue Growth",
        value: metrics?.moMRevenueGrowth.value ?? 0,
        change: metrics?.moMRevenueGrowth.change,
        format: "percent",
        icon: "trending-up-outline",
        iconColor: "#0ea5e9",
        isPrimary: true,
      },
      grossProfit: {
        title: "Gross Profit",
        value: metrics?.grossProfit.value ?? 0,
        change: metrics?.grossProfit.change,
        format: "currency",
        icon: "stats-chart-outline",
        iconColor: "#8b5cf6",
        currencySymbol,
      },
      profitMargin: {
        title: "Profit Margin",
        value: metrics?.profitMargin.value ?? 0,
        change: metrics?.profitMargin.change,
        format: "percent",
        icon: "analytics-outline",
        iconColor: "#6366f1",
      },
      ncRoas: {
        title: "NC ROAS",
        value: ratioLabel(metrics?.ncRoas?.value ?? 0),
        change: metrics?.ncRoas?.change,
        icon: "sparkles-outline",
        iconColor: "#7c3aed",
      },
      poas: {
        title: "POAS",
        value: ratioLabel(metrics?.poas?.value ?? 0),
        change: metrics?.poas?.change,
        icon: "bar-chart-outline",
        iconColor: "#f97316",
      },
    }),
    [currencySymbol, metrics, ratioLabel]
  );

  const layout: (keyof typeof cards)[][] = [
    ["revenue"],
    ["orders", "customers"],
    ["avgOrderValue", "repeatRate"],
    ["netProfit"],
    ["totalAdSpend", "roas"],
    ["moMRevenueGrowth"],
    ["grossProfit", "profitMargin"],
    ["ncRoas", "poas"],
  ];

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 32 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="flex-1 gap-5 px-4 py-6">
          {/* Header with Date Picker */}
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-3xl font-bold text-foreground">
                  Overview
                </Text>
                <Text className="text-sm text-default-500 mt-1">
                  Track your business performance
                </Text>
              </View>
              <DateRangePickerButton />
            </View>
          </View>

          {/* Key Performance Section */}
          <View className="gap-4">
            {layout.map((row, index) => (
              <View key={`metric-row-${index}`} className="flex-row gap-4">
                {row.map((key) => {
                  const config = cards[key];
                  if (!config) return null;

                  return (
                    <View key={key} className="flex-1">
                      <KPICard
                        title={config.title}
                        value={config.value}
                        change={config.change}
                        format={config.format}
                        currencySymbol={config.currencySymbol}
                        icon={config.icon}
                        iconColor={config.iconColor}
                        loading={isLoading}
                        isPrimary={config.isPrimary}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
