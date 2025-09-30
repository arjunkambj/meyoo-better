import React, { useMemo } from 'react';
import { View, Text, useColorScheme } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

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

const TAU = Math.PI * 2;

type ArcSegment = {
  key: string;
  path: string;
  color: string;
  name: string;
};

const polarToCartesian = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
});

const describeArc = (
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) => {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const sweepAngle = endAngle - startAngle;
  const largeArcFlag = sweepAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
};

function DonutChart({ data, size = 240, innerRadius = 80, totalLabel, totalValue }: DonutChartProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const radius = size / 2;
  const rawInnerRadius = Math.min(innerRadius, radius - 8);
  const ringInnerRadius = rawInnerRadius > 0 ? rawInnerRadius : radius * 0.55;

  const segments = useMemo<ArcSegment[]>(() => {
    const filtered = data.filter((item) => Number.isFinite(item.value) && item.value > 0);
    const total = filtered.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return [];

    let currentAngle = -Math.PI / 2;

    return filtered.map((item) => {
      const sweep = (item.value / total) * TAU;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweep;
      currentAngle = endAngle;

      if (endAngle <= startAngle) {
        return null;
      }

      return {
        key: `${item.name}-${item.value}`,
        path: describeArc(radius, radius, radius, ringInnerRadius, startAngle, endAngle),
        color: item.color,
        name: item.name,
      };
    }).filter(Boolean) as ArcSegment[];
  }, [data, radius, ringInnerRadius]);

  const totalActiveSegments = segments.length;
  const emptyRingColor = isDark ? 'rgba(148,163,184,0.25)' : 'rgba(226,232,240,0.9)';

  return (
    <View className="items-center justify-center">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {totalActiveSegments === 0 ? (
            <G>
              <Circle cx={radius} cy={radius} r={radius} fill={isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.9)'} />
              <Circle
                cx={radius}
                cy={radius}
                r={ringInnerRadius + (radius - ringInnerRadius) * 0.85}
                stroke={emptyRingColor}
                strokeWidth={10}
                strokeDasharray="12 12"
                fill="none"
              />
            </G>
          ) : (
            <G>
              {segments.map((segment) => (
                <Path
                  key={segment.key}
                  d={segment.path}
                  fill={segment.color}
                  stroke={isDark ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.9)'}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </G>
          )}
        </Svg>
        <View
          style={{
            position: 'absolute',
            top: radius - ringInnerRadius,
            left: radius - ringInnerRadius,
            width: ringInnerRadius * 2,
            height: ringInnerRadius * 2,
            borderRadius: ringInnerRadius,
            paddingHorizontal: 16,
          }}
          className="bg-background/95 dark:bg-background/95 items-center justify-center gap-1.5"
        >
          {totalLabel && (
            <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-default-500">
              {totalLabel}
            </Text>
          )}
          {totalValue && (
            <Text className="text-2xl font-bold text-foreground">
              {totalValue}
            </Text>
          )}
          {totalActiveSegments > 0 ? (
            <Text className="text-xs text-default-400">
              {totalActiveSegments} {totalActiveSegments === 1 ? 'category' : 'categories'}
            </Text>
          ) : (
            <Text className="text-xs text-default-400">Awaiting cost data</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default DonutChart;
