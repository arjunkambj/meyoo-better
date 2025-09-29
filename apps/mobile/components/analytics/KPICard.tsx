import React from 'react';
import { View, Text } from 'react-native';
import { Card, Skeleton } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';

export interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  loading?: boolean;
  format?: 'currency' | 'number' | 'percent';
  currencySymbol?: string;
  isPrimary?: boolean;
}

export function KPICard({
  title,
  value,
  change,
  changeType,
  icon,
  iconColor = '#6366f1',
  loading = false,
  format = 'number',
  currencySymbol = '$',
  isPrimary = false,
}: KPICardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        // Compact format for large numbers
        if (Math.abs(val) >= 10000000) {
          const abs = Math.abs(val);
          const units = ['', 'k', 'M', 'B'] as const;
          let u = 0;
          let v = abs;
          while (v >= 1000 && u < units.length - 1) {
            v /= 1000;
            u++;
          }
          return `${val < 0 ? '-' : ''}${currencySymbol}${v.toFixed(1)}${units[u]}`;
        }
        return `${currencySymbol}${val.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`;
      case 'percent':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString('en-US');
    }
  };

  const getChangeColor = () => {
    if (!changeType && change !== undefined) {
      return change >= 0 ? '#10b981' : '#ef4444';
    }
    switch (changeType) {
      case 'positive':
        return '#10b981';
      case 'negative':
        return '#ef4444';
      case 'neutral':
        return '#f59e0b';
      default:
        return '#666';
    }
  };

  const getChangeIcon = () => {
    if (!change) return null;
    return change >= 0 ? 'arrow-up' : 'arrow-down';
  };

  if (loading) {
    return (
      <Card surfaceVariant="1" className={isPrimary ? "border border-primary/20" : ""}>
        <Card.Body>
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </View>
            <Skeleton className={`${isPrimary ? 'h-10' : 'h-9'} w-32 rounded-md`} />
            <Skeleton className="h-4 w-20 rounded-md" />
          </View>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card surfaceVariant="1" className={isPrimary ? "border border-primary/20" : ""}>
      <Card.Body>
        <View className="gap-3">
          {/* Header with title and icon */}
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-default-600 flex-1" numberOfLines={1}>
              {title}
            </Text>
            {icon && (
              <Ionicons name={icon} size={24} color={iconColor} />
            )}
          </View>

          {/* Value */}
          <Text className={`${isPrimary ? 'text-3xl' : 'text-2xl'} font-bold text-foreground`}>
            {formatValue(value)}
          </Text>

          {/* Change indicator */}
          {change !== undefined && (
            <View className="flex-row items-center gap-1.5">
              {getChangeIcon() && (
                <Ionicons
                  name={getChangeIcon() as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={getChangeColor()}
                />
              )}
              <Text
                className="text-sm font-semibold"
                style={{ color: getChangeColor() }}
              >
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </Text>
              <Text className="text-xs text-default-500">vs last period</Text>
            </View>
          )}
        </View>
      </Card.Body>
    </Card>
  );
}

// Grid component for multiple KPI cards
export function KPIGrid({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row flex-wrap -mx-2">
      {React.Children.toArray(children).map((child, index) => (
        <View className="w-1/2 px-2 mb-4" key={index}>
          {child as any}
        </View>
      ))}
    </View>
  );
}