import { formatUtcDateKey, shopMidnightUtc } from "./shopifyTime";

export type RangeYYYYMMDD = { startDate: string; endDate: string };

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
  const endUtc = new Date(
    Date.UTC(ye, me - 1, de + 1) - offsetMinutes * 60_000 - 1,
  );

  return {
    startDate: formatUtcDateKey(startUtc),
    endDate: formatUtcDateKey(endUtc),
  };
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
  const endUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  const startUtc = new Date(todayStartUtc.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return { startDate: formatUtcDateKey(startUtc), endDate: formatUtcDateKey(endUtc) };
}
