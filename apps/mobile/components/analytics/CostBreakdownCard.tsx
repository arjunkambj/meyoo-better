import React from 'react';
import { View, Text } from 'react-native';
import { Card } from 'heroui-native';
import DonutChart, { DonutDatum } from './DonutChart';

export type CostItem = {
  key: string;
  label: string;
  value: number;
  color: string;
};

interface CostBreakdownCardProps {
  items: CostItem[]; // exactly 6 preferred
  currencySymbol?: string;
}

function formatCurrency(n: number, currencySymbol = '$') {
  if (!Number.isFinite(n)) return `${currencySymbol}0`;
  // Do not abbreviate unless >= 10,000,000
  if (Math.abs(n) >= 10000000) {
    const abs = Math.abs(n);
    const units = ["", "k", "M", "B"] as const;
    let u = 0;
    let val = abs;
    while (val >= 1000 && u < units.length - 1) {
      val /= 1000;
      u++;
    }
    return `${n < 0 ? '-' : ''}${currencySymbol}${val.toFixed(1)}${units[u]}`;
  }
  return `${currencySymbol}${n.toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

function CostBreakdownCard({ items, currencySymbol = '$' }: CostBreakdownCardProps) {
  const total = items.reduce((s, i) => s + (i.value || 0), 0);
  const data: DonutDatum[] = items
    .filter((i) => i.value > 0)
    .map((i) => ({ name: i.label, value: i.value, color: i.color }));

  return (
    <Card surfaceVariant="1">
      <Card.Body>
        <View className="gap-4">
          <Text className="text-base font-semibold text-foreground">Cost breakdown</Text>
          <DonutChart
            data={data}
            size={220}
            innerRadius={72}
            totalLabel="Total"
            totalValue={formatCurrency(total, currencySymbol)}
          />
          <View className="mt-2 -mx-1 flex-row flex-wrap">
            {items.slice(0, 6).map((i) => {
              const pct = total > 0 ? (i.value / total) * 100 : 0;
              return (
                <View key={i.key} className="w-1/2 px-1 mb-2">
                  <View className="flex-row items-center justify-between rounded-lg border border-default-100 px-3 py-2">
                    <View className="flex-row items-center gap-2">
                      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: i.color }} />
                      <Text className="text-xs text-default-700" numberOfLines={1}>{i.label}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-xs text-default-500">{pct.toFixed(1)}%</Text>
                      <Text className="text-sm font-semibold text-foreground">{formatCurrency(i.value, currencySymbol)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Card.Body>
    </Card>
  );
}

export default CostBreakdownCard;
