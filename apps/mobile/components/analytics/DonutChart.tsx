import React from 'react';
import { View, Text } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

export type DonutDatum = {
  name: string;
  value: number;
  color: string;
};

interface DonutChartProps {
  data: DonutDatum[];
  size?: number; // px
  innerRadius?: number; // px
  totalLabel?: string;
  totalValue?: string;
}

function DonutChart({ data, size = 220, innerRadius = 70, totalLabel, totalValue }: DonutChartProps) {
  const chartData = data.map((d, i) => ({
    name: d.name,
    population: Math.max(0, d.value),
    color: d.color,
    legendFontColor: '#6b7280',
    legendFontSize: 12,
  }));

  const diameter = size;

  return (
    <View className="items-center justify-center">
      <View style={{ width: diameter, height: diameter }}>
        <PieChart
          data={chartData}
          width={diameter}
          height={diameter}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: 'transparent',
            backgroundGradientTo: 'transparent',
            color: () => '#000',
            decimalPlaces: 0,
          }}
          accessor="population"
          backgroundColor="transparent"
          hasLegend={false}
          paddingLeft={"0"}
          center={[0, 0]}
          absolute
        />
        {/* Inner circle to create donut effect */}
        <View
          style={{
            position: 'absolute',
            top: (diameter - innerRadius * 2) / 2,
            left: (diameter - innerRadius * 2) / 2,
            width: innerRadius * 2,
            height: innerRadius * 2,
            borderRadius: innerRadius,
            backgroundColor: 'white',
          }}
          className="dark:bg-background bg-background items-center justify-center"
        >
          {totalLabel && (
            <Text className="text-xs text-default-600">{totalLabel}</Text>
          )}
          {totalValue && (
            <Text className="text-xl font-bold text-foreground">{totalValue}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default DonutChart;
