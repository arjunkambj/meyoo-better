import React from "react";
import { Text, View } from "react-native";

type KpiCardProps = {
  label: string;
  value: string;
  delta?: string | null;
};

export function KpiCard({ label, value, delta }: KpiCardProps) {
  const deltaPositive = delta ? !delta.startsWith("-") : null;

  return (
    <View className="w-full rounded-3xl bg-background/80 p-4">
      <Text className="text-sm font-medium text-muted-foreground">{label}</Text>
      <Text className="mt-2 text-2xl font-semibold text-foreground">{value}</Text>
      {delta ? (
        <Text
          className={`mt-2 text-sm ${
            deltaPositive ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {deltaPositive ? "▲" : "▼"} {delta}
        </Text>
      ) : null}
    </View>
  );
}
