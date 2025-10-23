import { type CalendarDate, getLocalTimeZone, parseDate, today } from '@internationalized/date';
import type { AnalyticsDateRange } from '@repo/types';

export const DATE_RANGE_PRESETS = {
  today: { key: 'today', label: 'Today' },
  yesterday: { key: 'yesterday', label: 'Yesterday' },
  last_7_days: { key: 'last_7_days', label: 'Last 7 days' },
  last_30_days: { key: 'last_30_days', label: 'Last 30 days' },
  last_90_days: { key: 'last_90_days', label: 'Last 90 days' },
  this_month: { key: 'this_month', label: 'This month' },
  last_month: { key: 'last_month', label: 'Last month' },
  this_year: { key: 'this_year', label: 'This year' },
  last_year: { key: 'last_year', label: 'Last year' },
  lifetime: { key: 'lifetime', label: 'Lifetime' },
} as const;

export type DateRangePresetKey = keyof typeof DATE_RANGE_PRESETS;

export const DEFAULT_DATE_RANGE_PRESET_KEYS: DateRangePresetKey[] = [
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'this_month',
  'last_month',
  'this_year',
  'lifetime',
];

export type CalendarDateRange = {
  start: CalendarDate;
  end: CalendarDate;
};

export const calendarDateToString = (date: CalendarDate): string => {
  const year = date.year;
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getPresetRange = (preset: DateRangePresetKey): CalendarDateRange => {
  const todayDate = today(getLocalTimeZone());
  const now = new Date();

  switch (preset) {
    case 'today':
      return { start: todayDate, end: todayDate };
    case 'yesterday': {
      const yesterday = todayDate.subtract({ days: 1 });
      return { start: yesterday, end: yesterday };
    }
    case 'last_7_days': {
      const start = todayDate.subtract({ days: 6 });
      return { start, end: todayDate };
    }
    case 'last_30_days': {
      const start = todayDate.subtract({ days: 29 });
      return { start, end: todayDate };
    }
    case 'last_90_days': {
      const start = todayDate.subtract({ days: 89 });
      return { start, end: todayDate };
    }
    case 'this_month': {
      const start = todayDate.set({ day: 1 });
      const monthEnd = start.add({ months: 1 }).subtract({ days: 1 });
      const end = monthEnd.compare(todayDate) > 0 ? todayDate : monthEnd;
      return { start, end };
    }
    case 'last_month': {
      const lastMonthStart = todayDate.subtract({ months: 1 }).set({ day: 1 });
      const lastMonthEnd = lastMonthStart.add({ months: 1 }).subtract({ days: 1 });
      return { start: lastMonthStart, end: lastMonthEnd };
    }
    case 'this_year': {
      const start = parseDate(`${now.getFullYear()}-01-01`);
      const end = parseDate(`${now.getFullYear()}-12-31`);
      return { start, end };
    }
    case 'last_year': {
      const year = now.getFullYear() - 1;
      const start = parseDate(`${year}-01-01`);
      const end = parseDate(`${year}-12-31`);
      return { start, end };
    }
    case 'lifetime': {
      const start = parseDate('1970-01-01');
      return { start, end: todayDate };
    }
    default: {
      const fallback = todayDate.subtract({ days: 29 });
      return { start: fallback, end: todayDate };
    }
  }
};

export const presetToAnalyticsRange = (
  preset: DateRangePresetKey,
): AnalyticsDateRange => {
  const range = getPresetRange(preset);
  return {
    startDate: calendarDateToString(range.start),
    endDate: calendarDateToString(range.end),
    preset,
  };
};

export const parseAnalyticsRange = (
  range: Pick<AnalyticsDateRange, 'startDate' | 'endDate'>,
): CalendarDateRange => ({
  start: parseDate(range.startDate),
  end: parseDate(range.endDate),
});
