import React, { useMemo } from 'react';
import { View, Text, Dimensions, ScrollView } from 'react-native';
import { Card } from 'heroui-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
// import { useDateRange } from '@/store/dateRangeStore';

const screenWidth = Dimensions.get('window').width;

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }[];
}

export function RevenueChart() {
  // Will use dateRange in future when API endpoints are available
  // const { dateRange } = useDateRange();

  // Mock data for demonstration - replace with real API call when endpoint is available
  const chartData = useMemo<ChartData>(() => {
    const today = new Date();
    const labels: string[] = [];
    const data: number[] = [];

    // Generate last 7 days of mock data
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(
        date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      );
      // Mock revenue data
      data.push(Math.floor(Math.random() * 10000) + 5000);
    }

    return {
      labels,
      datasets: [
        {
          data,
          color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  }, []);

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#6366f1',
    },
  };

  return (
    <Card surfaceVariant="1">
      <Card.Header>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold uppercase text-default-600">
            Revenue Trend
          </Text>
          <Text className="text-xs text-default-500">
            Last {chartData.labels.length} days
          </Text>
        </View>
      </Card.Header>
      <Card.Body className="-mx-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={chartData}
            width={Math.max(screenWidth - 32, chartData.labels.length * 60)}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            withInnerLines={false}
            withOuterLines={false}
            formatYLabel={(value: string) => {
              const num = parseFloat(value);
              if (num >= 1000) {
                return `$${(num / 1000).toFixed(0)}k`;
              }
              return `$${num}`;
            }}
          />
        </ScrollView>
      </Card.Body>
    </Card>
  );
}

export function ChannelBreakdown() {
  // Will use dateRange in future when API endpoints are available
  // const { dateRange } = useDateRange();

  // Mock channel data for demonstration
  const chartData = useMemo<ChartData>(() => {
    return {
      labels: ['Organic', 'Meta Ads', 'Google', 'Email', 'Direct'],
      datasets: [
        {
          data: [12000, 8500, 6200, 4800, 3500],
        },
      ],
    };
  }, []);

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    barPercentage: 0.7,
  };

  return (
    <Card surfaceVariant="1">
      <Card.Header>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold uppercase text-default-600">
            Channel Revenue
          </Text>
          <Text className="text-xs text-default-500">
            Top {chartData.labels.length} channels
          </Text>
        </View>
      </Card.Header>
      <Card.Body className="-mx-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChart
            data={chartData}
            width={Math.max(screenWidth - 32, chartData.labels.length * 80)}
            height={200}
            chartConfig={chartConfig}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withInnerLines={false}
            showBarTops={false}
            yAxisSuffix=""
            yAxisLabel=""
          />
        </ScrollView>
      </Card.Body>
    </Card>
  );
}