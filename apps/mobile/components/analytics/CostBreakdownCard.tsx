import React from 'react';
import { View, Text } from 'react-native';
import { Card } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';
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
    <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
      <Card.Body className="px-4 py-4">
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-foreground">Cost Breakdown</Text>
              <Text className="text-xs text-default-500 mt-0.5">{data.length} categories tracked</Text>
            </View>
            <View className="h-10 w-10 rounded-xl bg-orange-500/10 items-center justify-center">
              <Ionicons name="wallet-outline" size={20} color="#f97316" />
            </View>
          </View>

          <View className="items-center justify-center p-4 rounded-2xl border border-border/40 bg-surface-1">
            <DonutChart
              data={data}
              size={220}
              innerRadius={75}
              totalLabel="Total Costs"
              totalValue={formatCurrency(total, currencySymbol)}
            />
          </View>

          <View className="mt-0 -mx-1.5 flex-row flex-wrap">
            {items.slice(0, 6).map((i) => {
              const pct = total > 0 ? (i.value / total) * 100 : 0;
              return (
                <View key={i.key} className="w-1/2 px-1.5 mb-3">
                  <View className="flex-col gap-2 rounded-2xl border border-border/40 bg-surface-1 px-3.5 py-2.5">
                    <View className="flex-row items-center gap-2">
                      <View className="h-3 w-3 rounded-full" style={{ backgroundColor: i.color, shadowColor: i.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 4 }} />
                      <Text className="text-xs font-bold text-foreground flex-1" numberOfLines={1}>{i.label}</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <View className="px-2 py-0.5 rounded-full bg-surface-2">
                        <Text className="text-xs font-bold text-default-600">{pct > 0 ? pct.toFixed(1) : '0'}%</Text>
                      </View>
                      <Text className="text-sm font-black text-foreground">{i.value > 0 ? formatCurrency(i.value, currencySymbol) : '—'}</Text>
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
