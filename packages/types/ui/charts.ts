// Chart types
export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}
