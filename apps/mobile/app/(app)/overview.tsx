import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KpiCard } from "@/components/analytics/KpiCard";
import { SectionCard } from "@/components/common/SectionCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import { getCurrencySymbol } from "@/libs/currency";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function OverviewScreen() {
  const { metrics, isLoading, realTime, currency } = useAnalytics();
  const currencySymbol = getCurrencySymbol(currency);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 96 }}>
        <View className="mt-8 gap-6">
          <SectionHeader
            title="Performance snapshot"
            subtitle="Clean view of your profitability across channels."
          />

          {isLoading ? (
            <View className="items-center justify-center py-10">
              <ActivityIndicator />
              <Text className="mt-3 text-sm text-muted-foreground">
                Fetching analytics…
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-4">
              {metrics.map((metric) => (
                <View key={metric.id} className="w-[48%] min-w-[150px]">
                  <KpiCard
                    label={metric.label}
                    value={metric.displayValue}
                    delta={metric.delta}
                  />
                </View>
              ))}
            </View>
          )}

          {realTime ? (
            <SectionCard
              title="Live revenue pulse"
              description="Streaming updates from Shopify and ad platforms."
            >
              <Text className="text-2xl font-semibold text-foreground">
                {currencySymbol}
                {Math.round(realTime.revenue ?? 0).toLocaleString()}
              </Text>
              <Text className="text-sm text-muted-foreground">
                Updated at {new Date(realTime.lastUpdated).toLocaleTimeString()}.
              </Text>
            </SectionCard>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
