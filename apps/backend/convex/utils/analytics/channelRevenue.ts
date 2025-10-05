import type {
  AnalyticsSourceResponse,
  ChannelRevenueBreakdown,
} from '@repo/types';

import type { AnyRecord } from './shared';
import {
  ensureDataset,
  safeNumber,
} from './shared';

export function computeChannelRevenue(
  response: AnalyticsSourceResponse<any> | null | undefined,
): ChannelRevenueBreakdown {
  if (!response) {
    return { channels: [] };
  }

  const data = ensureDataset(response);
  if (!data) return { channels: [] };

  const orders = (data.orders || []) as AnyRecord[];
  const channelMap = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    const rawSource =
      order.utmSource ??
      order.utm_source ??
      "Direct";
    const channel = String(rawSource || "Direct").trim() || "Direct";
    const stats = channelMap.get(channel) ?? { revenue: 0, orders: 0 };
    stats.revenue += safeNumber(order.totalPrice);
    stats.orders += 1;
    channelMap.set(channel, stats);
  }

  const channels = Array.from(channelMap.entries())
    .map(([name, stats]) => ({
      name,
      revenue: stats.revenue,
      orders: stats.orders,
      change: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return { channels };
}

