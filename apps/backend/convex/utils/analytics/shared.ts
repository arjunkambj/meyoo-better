import type {
  AnalyticsSourceData,
  AnalyticsSourceResponse,
  MetricValue,
} from '@repo/types';

type DatasetResponse<T> = AnalyticsSourceResponse<T> | null | undefined;

export type AnyRecord = Record<string, unknown>;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function filterAccountLevelMetaInsights(metaInsights: AnyRecord[]): AnyRecord[] {
  return metaInsights.filter((insight) => {
    const entityType = typeof insight?.entityType === 'string'
      ? insight.entityType.toLowerCase()
      : null;
    return entityType === null || entityType === 'account';
  });
}

export function parseDateBoundary(value: string | undefined, end = false): number {
  if (!value) {
    const now = new Date();
    if (end) {
      now.setUTCHours(23, 59, 59, 999);
    } else {
      now.setUTCHours(0, 0, 0, 0);
    }
    return now.getTime();
  }

  const suffix = end ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const normalized = value.includes('T') ? value : `${value}${suffix}`;
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    const fallback = new Date();
    if (end) {
      fallback.setUTCHours(23, 59, 59, 999);
    } else {
      fallback.setUTCHours(0, 0, 0, 0);
    }
    return fallback.getTime();
  }
  return parsed;
}

export function getFrequencyDurationMs(cost: AnyRecord): number | null {
  const rawFrequency = String(
    cost.frequency ?? cost.recurrence ?? cost.intervalUnit ?? cost.interval ?? '',
  ).toLowerCase();

  switch (rawFrequency) {
    case 'day':
    case 'daily':
      return DAY_MS;
    case 'week':
    case 'weekly':
      return 7 * DAY_MS;
    case 'biweekly':
    case 'fortnight':
    case 'fortnightly':
      return 14 * DAY_MS;
    case 'month':
    case 'monthly':
      return 30 * DAY_MS;
    case 'bimonthly':
      return 60 * DAY_MS;
    case 'quarter':
    case 'quarterly':
      return 91 * DAY_MS;
    case 'semiannual':
    case 'semiannually':
    case 'biannual':
      return 182 * DAY_MS;
    case 'year':
    case 'yearly':
    case 'annual':
    case 'annually':
      return 365 * DAY_MS;
    default:
      return null;
  }
}

export function computeCostOverlap(
  cost: AnyRecord,
  rangeStartMs: number,
  rangeEndMs: number,
): { overlapMs: number; windowMs: number | null } {
  const rawFrom = cost.effectiveFrom;
  const rawTo = cost.effectiveTo;

  const hasExplicitFrom = rawFrom !== undefined && rawFrom !== null;
  const hasExplicitEnd = rawTo !== undefined && rawTo !== null;

  const startCandidate = hasExplicitFrom ? safeNumber(rawFrom) : rangeStartMs;
  const endCandidate = hasExplicitEnd ? safeNumber(rawTo) : rangeEndMs;

  const start = Number.isFinite(startCandidate) ? startCandidate : rangeStartMs;
  const end = Number.isFinite(endCandidate) ? endCandidate : rangeEndMs;

  const overlapStart = Math.max(rangeStartMs, start);
  const overlapEnd = Math.min(rangeEndMs, end);
  const overlapMs = overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;

  if (hasExplicitFrom && hasExplicitEnd && end > start) {
    return { overlapMs, windowMs: end - start };
  }

  return { overlapMs, windowMs: null };
}

export function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function sumBy<T>(items: T[] | undefined, getter: (item: T) => number): number {
  if (!items?.length) return 0;
  return items.reduce((total, item) => total + getter(item), 0);
}

export function toStringId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if ('id' in (value as AnyRecord) && typeof (value as AnyRecord).id === 'string') {
      return (value as AnyRecord).id as string;
    }
    if ('_id' in (value as AnyRecord) && typeof (value as AnyRecord)._id === 'string') {
      return (value as AnyRecord)._id as string;
    }
  }
  return String(value ?? '');
}

export function ensureDataset<T = AnyRecord>(
  response: DatasetResponse<T>,
): AnalyticsSourceData<T> | null {
  if (!response) return null;
  return (response.data ?? {}) as AnalyticsSourceData<T>;
}

export function defaultMetric(value = 0, change = 0): MetricValue {
  return { value, change };
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function overlapsWindow(
  entryStart: number,
  entryEnd: number,
  window?: { start: number; end: number },
): boolean {
  if (!window) return true;
  const normalizedStart = Number.isFinite(entryStart)
    ? entryStart
    : Number.NEGATIVE_INFINITY;
  const normalizedEnd = Number.isFinite(entryEnd)
    ? entryEnd
    : Number.POSITIVE_INFINITY;
  return normalizedStart <= window.end && normalizedEnd >= window.start;
}

export function resolveManualReturnRate(
  entries: AnyRecord[] | undefined,
  window?: { start: number; end: number },
): { ratePercent: number } {
  if (!entries?.length) {
    return { ratePercent: 0 };
  }

  const filtered = entries.filter((entry) => {
    const activeFlag = entry.isActive;
    if (activeFlag === false) {
      const from = safeNumber(entry.effectiveFrom ?? entry.createdAt ?? 0);
      const toRaw = entry.effectiveTo;
      const to = toRaw === undefined || toRaw === null ? Number.POSITIVE_INFINITY : safeNumber(toRaw);
      return overlapsWindow(from, to, window) && window !== undefined;
    }

    const from = safeNumber(entry.effectiveFrom ?? entry.createdAt ?? 0);
    const toRaw = entry.effectiveTo;
    const to = toRaw === undefined || toRaw === null ? Number.POSITIVE_INFINITY : safeNumber(toRaw);
    return overlapsWindow(from, to, window);
  });

  if (filtered.length === 0) {
    return { ratePercent: 0 };
  }

  filtered.sort((a, b) => {
    const aTimestamp = safeNumber(a.updatedAt ?? a.effectiveFrom ?? a.createdAt ?? 0);
    const bTimestamp = safeNumber(b.updatedAt ?? b.effectiveFrom ?? b.createdAt ?? 0);
    return bTimestamp - aTimestamp;
  });

  const selected = filtered[0]!;
  const rawRate = safeNumber(selected.ratePercent ?? selected.rate ?? selected.value ?? 0);
  return { ratePercent: clampPercentage(rawRate) };
}

export function percentageChange(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) {
    if (current > 0) {
      return 100;
    }
    if (current < 0) {
      return -100;
    }
    return 0;
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number.isFinite(change) ? change : 0;
}
