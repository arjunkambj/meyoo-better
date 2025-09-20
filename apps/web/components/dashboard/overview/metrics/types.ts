export interface MetricDefinition {
  id: string;
  label: string;
  icon: string;
  category: string;
  format: "currency" | "percentage" | "number" | "decimal";
  prefix?: string;
  suffix?: string;
  decimal?: number;
  description?: string;
  iconColor?: string;
}

export interface MetricCategory {
  id: string;
  name: string;
  icon: string;
  metrics: string[];
}

export interface SelectedMetric {
  id: string;
  order: number;
  enabled: boolean;
}

export interface DashboardCustomization {
  selectedMetrics: SelectedMetric[];
}
