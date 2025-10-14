import { parseDate } from "@internationalized/date";

export interface MsToDateOptions {
  timezone?: string;
  offsetMinutes?: number;
}

const ISO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDateWithOffset(date: Date, offsetMinutes: number): string {
  const adjusted = new Date(date.getTime() + offsetMinutes * 60_000);
  return ISO_DATE_FORMATTER.format(adjusted);
}

export function msToDateString(
  ms: number | null | undefined,
  options?: MsToDateOptions,
): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return null;
  }

  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (options?.timezone) {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: options.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(date);
    } catch (_error) {
      // Fallback to offset/UTC formatting when timezone is invalid
    }
  }

  if (typeof options?.offsetMinutes === "number" && Number.isFinite(options.offsetMinutes)) {
    return formatDateWithOffset(date, options.offsetMinutes);
  }

  return date.toISOString().slice(0, 10);
}

export function normalizeDateString(value: string): string {
  if (!value) {
    throw new Error("Date string is required");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${value}`);
  }

  return date.toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnightForLocalDate(
  dateString: string,
  options?: MsToDateOptions,
): Date {
  if (options?.timezone) {
    try {
      return parseDate(dateString).toDate(options.timezone);
    } catch (_error) {
      // Fallback to offset-based handling below
    }
  }

  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const offsetMinutes = typeof options?.offsetMinutes === "number" ? options.offsetMinutes : 0;

  return new Date(Date.UTC(year, month - 1, day) - offsetMinutes * 60_000);
}

export function buildDateSpan(
  daysBack: number,
  endDate?: string,
  options?: MsToDateOptions,
): string[] {
  const limit = Math.max(1, Math.floor(daysBack));
  const resolvedOptions = options ?? {};

  const anchorLocal =
    endDate ??
    msToDateString(Date.now(), resolvedOptions) ??
    new Date().toISOString().slice(0, 10);
  const normalizedAnchor = normalizeDateString(anchorLocal);
  const anchorUtc = utcMidnightForLocalDate(normalizedAnchor, resolvedOptions);

  const results: string[] = [];

  for (let offset = 0; offset < limit; offset += 1) {
    const currentMs = anchorUtc.getTime() - offset * DAY_MS;
    const formatted =
      msToDateString(currentMs, resolvedOptions) ??
      new Date(currentMs).toISOString().slice(0, 10);
    results.push(formatted);
  }

  return results;
}
