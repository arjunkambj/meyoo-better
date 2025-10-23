import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
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
import { analyticsDateRangesAtom, type AnalyticsDateRangeState } from '@/store/atoms';

export const DEFAULT_SHARED_ANALYTICS_RANGE_KEY = '__analytics-global-range__';

interface AnalyticsDateRangeOptions {
  defaultPreset?: DateRangePresetKey;
  /**
   * Optional key used to synchronise date range selections across screens.
   * Pass `null` to opt-out of the shared behaviour.
   */
  sharedKey?: string | null;
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
  const sharedKey =
    options?.sharedKey === null
      ? null
      : options?.sharedKey ?? DEFAULT_SHARED_ANALYTICS_RANGE_KEY;

  const fallbackRange = useMemo(
    () => presetToAnalyticsRange(defaultPreset),
    [defaultPreset],
  );
  const storedRange = ranges[key];
  const sharedRange = sharedKey ? ranges[sharedKey] : undefined;
  const activeRange = useMemo<AnalyticsDateRange>(() => {
    if (sharedRange) {
      return normalizeRange(sharedRange);
    }
    if (storedRange) {
      return normalizeRange(storedRange);
    }
    return fallbackRange;
  }, [sharedRange, storedRange, fallbackRange]);

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
      setRanges((prev) => {
        const nextState: AnalyticsDateRangeState = {
          ...prev,
          [key]: normalized,
        };

        if (sharedKey && sharedKey !== key) {
          nextState[sharedKey] = normalized;
        }

        return nextState;
      });
    },
    [key, setRanges, sharedKey],
  );

  const reset = useCallback(() => {
    setRanges((prev) => {
      let updated = false;
      const next = { ...prev };

      if (key in next) {
        delete next[key];
        updated = true;
      }

      if (sharedKey && sharedKey !== key && sharedKey in next) {
        delete next[sharedKey];
        updated = true;
      }

      return updated ? next : prev;
    });
  }, [key, setRanges, sharedKey]);

  // Backfill the shared key from any existing per-screen preference so that
  // legacy persisted ranges become the new shared default automatically.
  useEffect(() => {
    if (!sharedKey || sharedKey === key) return;
    if (!storedRange) return;
    if (sharedRange) return;

    setRanges((prev) => {
      if (prev[sharedKey]) {
        return prev;
      }

      return {
        ...prev,
        [sharedKey]: normalizeRange(storedRange),
      } satisfies AnalyticsDateRangeState;
    });
  }, [key, sharedKey, sharedRange, storedRange, setRanges]);

  return {
    analyticsRange: activeRange,
    calendarRange,
    preset: activePreset,
    updateRange,
    reset,
  } as const;
}
