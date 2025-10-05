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

export function buildDateSpan(daysBack: number, endDate?: string): string[] {
  const limit = Math.max(1, Math.floor(daysBack));
  const anchor = endDate ? normalizeDateString(endDate) : normalizeDateString(new Date().toISOString());

  const results: string[] = [];
  const anchorDate = new Date(`${anchor}T00:00:00.000Z`);

  for (let offset = 0; offset < limit; offset += 1) {
    const current = new Date(anchorDate.getTime() - offset * 24 * 60 * 60 * 1000);
    results.push(current.toISOString().slice(0, 10));
  }

  return results;
}
