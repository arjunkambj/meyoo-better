import { formatUtcDateKey, shopMidnightUtc } from "./shopifyTime";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RangeYYYYMMDD = {
  startDate: string;
  endDate: string;
  /** Inclusive UTC instant for the range start (shop-local midnight). */
  startDateTimeUtc?: string;
  /** Inclusive UTC instant for the range end (last millisecond included). */
  endDateTimeUtc?: string;
  /** Exclusive UTC instant immediately after the range end. */
  endDateTimeUtcExclusive?: string;
  /** Number of whole shop-local days represented by the range. */
  dayCount?: number;
};

function buildUtcRange(startUtc: Date, endExclusiveUtc: Date): RangeYYYYMMDD {
  const endInclusiveUtc = new Date(endExclusiveUtc.getTime() - 1);
  const spanMs = Math.max(0, endExclusiveUtc.getTime() - startUtc.getTime());
  const rawDayCount = spanMs > 0 ? Math.round(spanMs / DAY_MS) : 0;

  return {
    startDate: formatUtcDateKey(startUtc),
    endDate: formatUtcDateKey(endInclusiveUtc),
    startDateTimeUtc: startUtc.toISOString(),
    endDateTimeUtc: endInclusiveUtc.toISOString(),
    endDateTimeUtcExclusive: endExclusiveUtc.toISOString(),
    dayCount: Math.max(1, rawDayCount),
  };
}

/**
 * Convert a YYYY-MM-DD range (interpreted in a shop's local time based on
 * fixed UTC offset minutes) into UTC date keys for backend filtering.
 */
export function toUtcRangeForOffset(
  range: RangeYYYYMMDD,
  offsetMinutes: number,
): RangeYYYYMMDD {
  // Parse YYYY-MM-DD components
  const ys = parseInt(range.startDate.slice(0, 4), 10);
  const ms = parseInt(range.startDate.slice(5, 7), 10);
  const ds = parseInt(range.startDate.slice(8, 10), 10);
  const ye = parseInt(range.endDate.slice(0, 4), 10);
  const me = parseInt(range.endDate.slice(5, 7), 10);
  const de = parseInt(range.endDate.slice(8, 10), 10);

  // Construct shop-local midnights using UTC constructors to avoid host timezone,
  // then convert back to real UTC by subtracting the shop offset.
  const startUtc = new Date(Date.UTC(ys, ms - 1, ds) - offsetMinutes * 60_000);
  const endExclusiveUtc = new Date(Date.UTC(ye, me - 1, de + 1) - offsetMinutes * 60_000);

  return buildUtcRange(startUtc, endExclusiveUtc);
}

/**
 * Compute a shop-local YYYY-MM-DD window of N days ending today (shop local),
 * and return as UTC date keys for backend filtering.
 */
export function daysBackUtcRangeForOffset(
  daysBack: number,
  offsetMinutes: number,
): RangeYYYYMMDD {
  const now = new Date();
  const todayStartUtc = shopMidnightUtc(now, offsetMinutes);
  const startUtc = new Date(todayStartUtc.getTime() - daysBack * DAY_MS);
  const endExclusiveUtc = new Date(todayStartUtc.getTime() + DAY_MS);

  return buildUtcRange(startUtc, endExclusiveUtc);
}
