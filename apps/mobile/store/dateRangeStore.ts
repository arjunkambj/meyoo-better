import { atom, useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DateRange {
  start: string; // YYYY-MM-DD format
  end: string; // YYYY-MM-DD format
  preset?: string; // Optional preset identifier
}

// Helper to get dates for presets
export const getPresetDateRange = (preset: string): DateRange => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { start: todayStr, end: todayStr, preset };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return { start: yesterdayStr, end: yesterdayStr, preset };
    }

    case 'last_7_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return {
        start: start.toISOString().split('T')[0],
        end: todayStr,
        preset
      };
    }

    case 'last_30_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return {
        start: start.toISOString().split('T')[0],
        end: todayStr,
        preset
      };
    }

    case 'last_90_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return {
        start: start.toISOString().split('T')[0],
        end: todayStr,
        preset
      };
    }

    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        start: start.toISOString().split('T')[0],
        end: todayStr,
        preset
      };
    }

    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        preset
      };
    }

    case 'this_year': {
      const start = new Date(today.getFullYear(), 0, 1);
      return {
        start: start.toISOString().split('T')[0],
        end: todayStr,
        preset
      };
    }

    case 'last_year': {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear() - 1, 11, 31);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        preset
      };
    }

    default:
      // Default to last 30 days
      return getPresetDateRange('last_30_days');
  }
};

// Default to last 30 days
const defaultDateRange = getPresetDateRange('last_30_days');

// Create async storage for Jotai
const storage = createJSONStorage<DateRange>(() => AsyncStorage);

// Create persisted atom for date range
export const dateRangeAtom = atomWithStorage<DateRange>(
  'mobile-date-range',
  defaultDateRange,
  storage
);

// Derived atom for preset
export const presetAtom = atom(
  (get) => {
    const dateRange = get(dateRangeAtom);
    return (dateRange as DateRange).preset;
  },
  (get, set, preset: string) => {
    set(dateRangeAtom, getPresetDateRange(preset));
  }
);

// Hook for easy access to date range
export const useDateRange = () => {
  const [dateRange, setDateRange] = useAtom(dateRangeAtom);

  const setPreset = (preset: string) => {
    setDateRange(getPresetDateRange(preset));
  };

  const clearPreset = () => {
    setDateRange({ ...dateRange, preset: undefined });
  };

  const reset = () => {
    setDateRange(defaultDateRange);
  };

  return {
    dateRange,
    setDateRange,
    setPreset,
    clearPreset,
    reset
  };
};

// Format date for display
export const formatDateRange = (range: DateRange): string => {
  const start = new Date(range.start);
  const end = new Date(range.end);

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined
  };

  if (range.start === range.end) {
    return start.toLocaleDateString('en-US', { ...options, year: 'numeric' });
  }

  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
};

// Preset options for UI
export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'last_90_days', label: 'Last 90 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_year', label: 'This year' },
  { key: 'last_year', label: 'Last year' },
];