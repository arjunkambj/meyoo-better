import { useAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import type { AnalyticsDateRange } from '@repo/types';
import {
  DATE_RANGE_PRESETS,
  DEFAULT_DATE_RANGE_PRESET_KEYS,
  type CalendarDateRange,
  type DateRangePresetKey,
  getPresetRange,
  parseAnalyticsRange,
  presetToAnalyticsRange,
} from '@/libs/dateRangePresets';
import { analyticsDateRangesAtom } from '@/store/atoms';

interface AnalyticsDateRangeOptions {
  defaultPreset?: DateRangePresetKey;
}

const isPresetKey = (value: string | undefined): value is DateRangePresetKey => {
  if (!value) return false;
  return value in DATE_RANGE_PRESETS;
};

const normalizeRange = (range: AnalyticsDateRange): AnalyticsDateRange => {
  const normalized: AnalyticsDateRange = { ...range };

  if (normalized.preset && !isPresetKey(normalized.preset)) {
    normalized.preset = undefined;
  }

  return normalized;
};

export function useAnalyticsDateRange(key: string, options?: AnalyticsDateRangeOptions) {
  const [ranges, setRanges] = useAtom(analyticsDateRangesAtom);
  const defaultPreset =
    options?.defaultPreset ?? DEFAULT_DATE_RANGE_PRESET_KEYS[0] ?? 'last_30_days';

  const fallbackRange = useMemo(
    () => presetToAnalyticsRange(defaultPreset),
    [defaultPreset],
  );
  const storedRange = ranges[key];
  const activeRange = useMemo<AnalyticsDateRange>(() => {
    if (storedRange) {
      return normalizeRange(storedRange);
    }
    return fallbackRange;
  }, [storedRange, fallbackRange]);

  const calendarRange = useMemo<CalendarDateRange>(() => {
    try {
      return parseAnalyticsRange(activeRange);
    } catch {
      return getPresetRange(defaultPreset);
    }
  }, [activeRange, defaultPreset]);

  const activePreset = useMemo<DateRangePresetKey | null>(() => {
    const candidate = activeRange.preset;
    return isPresetKey(candidate) ? candidate : null;
  }, [activeRange.preset]);

  const updateRange = useCallback(
    (next: AnalyticsDateRange) => {
      const normalized = normalizeRange(next);
      setRanges((prev) => ({
        ...prev,
        [key]: normalized,
      }));
    },
    [key, setRanges],
  );

  const reset = useCallback(() => {
    setRanges((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [key, setRanges]);

  return {
    analyticsRange: activeRange,
    calendarRange,
    preset: activePreset,
    updateRange,
    reset,
  } as const;
}
