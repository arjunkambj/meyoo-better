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
    .map((i) => ({ name: i.label, value: i.value, color: i.color }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card surfaceVariant="1">
      <Card.Body>
        <View className="gap-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Cost Breakdown</Text>
            <Text className="text-xs text-default-500">{data.length} categories</Text>
          </View>

          <DonutChart
            data={data}
            size={240}
            innerRadius={80}
            totalLabel="Total Costs"
            totalValue={formatCurrency(total, currencySymbol)}
          />

          <View className="mt-1 -mx-1 flex-row flex-wrap">
            {items.slice(0, 6).map((i) => {
              const pct = total > 0 ? (i.value / total) * 100 : 0;
              return (
                <View key={i.key} className="w-1/2 px-1 mb-2.5">
                  <View className="flex-col gap-2 rounded-xl border border-default-100 bg-background px-3 py-2.5">
                    <View className="flex-row items-center gap-2">
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i.color }} />
                      <Text className="text-xs font-semibold text-default-700 flex-1" numberOfLines={1}>{i.label}</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-medium text-default-500">{pct > 0 ? pct.toFixed(1) : '0'}%</Text>
                      <Text className="text-sm font-bold text-foreground">{i.value > 0 ? formatCurrency(i.value, currencySymbol) : '—'}</Text>
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
