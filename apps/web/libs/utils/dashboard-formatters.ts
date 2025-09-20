/**
 * Common formatting utilities for dashboard components
 * These functions are pure and can be reused across components
 */

import { getCurrencySymbol } from "./format";

/**
 * Format currency values with K/M suffixes
 */
export const formatCurrency = (
  value: number,
  currency: string = "USD",
): string => {
  const absValue = Math.abs(value);
  const symbol = getCurrencySymbol(currency);

  if (absValue >= 1000000) {
    return `${symbol}${(value / 1000000).toFixed(1)}M`;
  } else if (absValue >= 1000) {
    return `${symbol}${(value / 1000).toFixed(1)}K`;
  }

  return `${symbol}${value.toFixed(0)}`;
};

/**
 * Format currency values with 2 decimal places
 */
export const formatCurrencyPrecise = (
  value: number,
  currency: string = "USD",
): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format numbers with K/M suffixes
 */
export const formatNumber = (value: number): string => {
  const safeValue = Number.isNaN(value) ? 0 : value;

  if (safeValue >= 1000000) {
    return `${(safeValue / 1000000).toFixed(2)}M`;
  } else if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(1)}K`;
  }

  return safeValue.toFixed(0);
};

/**
 * Format percentage change with +/- prefix and trend
 */
export const formatChange = (
  value: number,
  inverse: boolean = false,
): {
  text: string;
  type: "positive" | "negative";
  trend: "up" | "down";
} => {
  const safeValue = Number.isNaN(value) ? 0 : value;
  const isPositive = inverse ? safeValue <= 0 : safeValue >= 0;

  return {
    text: `${safeValue >= 0 ? "+" : ""}${safeValue.toFixed(1)}%`,
    type: isPositive ? "positive" : "negative",
    trend: value >= 0 ? "up" : "down",
  };
};

/**
 * Format relative time (e.g., "2 hours ago", "Just now")
 */
export const formatRelativeTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;

  return date.toLocaleDateString();
};

/**
 * Format future time (e.g., "In 2 hours", "Tomorrow")
 */
export const formatFutureTime = (timestamp: number): string => {
  const next = new Date(timestamp);
  const now = new Date();
  const diff = next.getTime() - now.getTime();

  if (diff < 0) return "Soon...";
  if (diff < 3600000) return `In ${Math.floor(diff / 60000)} minutes`;
  if (diff < 86400000) return `In ${Math.floor(diff / 3600000)} hours`;

  return next.toLocaleDateString();
};

/**
 * Get color for progress/status based on percentage
 */
export const getProgressColor = (
  value: number,
  target: number,
): "success" | "warning" | "danger" => {
  const percentage = (value / target) * 100;

  if (percentage >= 100) return "success";
  if (percentage >= 80) return "warning";

  return "danger";
};

/**
 * Get color for stock status
 */
export const getStockStatusConfig = (
  status: "healthy" | "low" | "critical" | "out",
): { color: "success" | "warning" | "danger" | "default"; label: string } => {
  switch (status) {
    case "healthy":
      return { color: "success", label: "Healthy" };
    case "low":
      return { color: "warning", label: "Low Stock" };
    case "critical":
      return { color: "danger", label: "Critical" };
    case "out":
      return { color: "default", label: "Out of Stock" };
  }
};

/**
 * Get color for ABC category
 */
export const getABCColor = (
  category: "A" | "B" | "C",
): "success" | "warning" | "default" => {
  switch (category) {
    case "A":
      return "success";
    case "B":
      return "warning";
    case "C":
      return "default";
  }
};

/**
 * Get segment style for customer segments
 */
export const getSegmentStyle = (segment: string): string => {
  switch (segment.toLowerCase()) {
    case "new":
      return "bg-info/10 text-info";
    case "repeated":
      return "bg-success/10 text-success";
    default:
      return "bg-default/10 text-default";
  }
};
