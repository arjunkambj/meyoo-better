"use client";

import { Button, Divider, Input, Popover, PopoverContent, PopoverTrigger, RangeCalendar } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type CalendarDate, type DateValue, parseDate } from '@internationalized/date';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyticsDateRange } from '@repo/types';
import {
  DATE_RANGE_PRESETS,
  DEFAULT_DATE_RANGE_PRESET_KEYS,
  type CalendarDateRange,
  type DateRangePresetKey,
  calendarDateToString,
  getPresetRange,
} from '@/libs/dateRangePresets';

interface RangeValue<T> {
  start: T;
  end: T;
}

interface GlobalDateRangePickerProps {
  value?: CalendarDateRange;
  preset?: DateRangePresetKey | null;
  onAnalyticsChange?: (range: AnalyticsDateRange) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
  placeholder?: string;
  presets?: DateRangePresetKey[];
  defaultPreset?: DateRangePresetKey;
  minDate?: CalendarDate;
  maxDate?: CalendarDate;
}

const formatSingleDate = (date?: CalendarDate): string => {
  if (!date) return '';
  try {
    const jsDate = new Date(date.year, date.month - 1, date.day);
    return jsDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return date.toString();
  }
};

const formatRangeLabel = (range?: CalendarDateRange): string => {
  if (!range) return 'Select date range';
  const startLabel = formatSingleDate(range.start);
  const endLabel = formatSingleDate(range.end);
  return `${startLabel} – ${endLabel}`;
};

const toAnalyticsRange = (range: CalendarDateRange, preset?: string | null): AnalyticsDateRange => ({
  startDate: calendarDateToString(range.start),
  endDate: calendarDateToString(range.end),
  preset: preset ?? undefined,
});

type CalendarDateConvertible = DateValue & {
  toCalendarDate: () => CalendarDate;
};

const isCalendarDateConvertible = (value: DateValue): value is CalendarDateConvertible => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toCalendarDate' in value &&
    typeof (value as CalendarDateConvertible).toCalendarDate === 'function'
  );
};

function toCalendarDateValue(value: DateValue): CalendarDate {
  if (isCalendarDateConvertible(value)) {
    return value.toCalendarDate();
  }
  return value as CalendarDate;
}

export default function GlobalDateRangePicker({
  value,
  preset,
  onAnalyticsChange,
  size = 'md',
  className,
  label,
  placeholder = 'Select date range',
  presets = DEFAULT_DATE_RANGE_PRESET_KEYS,
  defaultPreset,
  minDate,
  maxDate,
}: GlobalDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePresetKey | null>(() => {
    if (preset !== undefined) return preset;
    if (defaultPreset) return defaultPreset;
    return presets[0] ?? null;
  });

  const initialRange = useMemo(() => {
    if (value) return value;
    if (selectedPreset) return getPresetRange(selectedPreset);
    if (defaultPreset) return getPresetRange(defaultPreset);
    if (presets.length > 0) {
      const fallbackPreset = presets[0] ?? 'last_30_days';
      return getPresetRange(fallbackPreset);
    }
    return getPresetRange('last_30_days');
  }, [value, selectedPreset, defaultPreset, presets]);

  const [internalRange, setInternalRange] = useState<CalendarDateRange>(initialRange);
  const [draftRange, setDraftRange] = useState<CalendarDateRange>(initialRange);
  const hasEmittedInitial = useRef(false);

  const emitChange = useCallback(
    (range: CalendarDateRange, nextPreset?: string | null) => {
      if (onAnalyticsChange) {
        onAnalyticsChange(toAnalyticsRange(range, nextPreset ?? undefined));
      }
    },
    [onAnalyticsChange],
  );

  const rangesEqual = useCallback((a?: CalendarDateRange, b?: CalendarDateRange) => {
    if (!a || !b) return false;
    return (
      calendarDateToString(a.start) === calendarDateToString(b.start) &&
      calendarDateToString(a.end) === calendarDateToString(b.end)
    );
  }, []);

  useEffect(() => {
    if (!value) {
      return;
    }
    if (rangesEqual(value, internalRange) && rangesEqual(value, draftRange)) {
      return;
    }
    setInternalRange(value);
    setDraftRange(value);
  }, [value, internalRange, draftRange, rangesEqual]);

  useEffect(() => {
    if (preset === undefined || preset === selectedPreset) {
      return;
    }
    setSelectedPreset(preset);
    if (!value && preset) {
      const presetRange = getPresetRange(preset);
      setInternalRange(presetRange);
      setDraftRange(presetRange);
    }
  }, [preset, selectedPreset, value]);

  const appliedRange = value ?? internalRange;

  useEffect(() => {
    if (value || hasEmittedInitial.current) {
      return;
    }

    hasEmittedInitial.current = true;
    emitChange(internalRange, selectedPreset ?? null);
  }, [value, internalRange, selectedPreset, emitChange]);

  const handlePresetChange = useCallback(
    (key: DateRangePresetKey) => {
      const presetRange = getPresetRange(key);
      setSelectedPreset(key);
      setInternalRange(presetRange);
      setDraftRange(presetRange);
      emitChange(presetRange, key);
      setIsOpen(false);
    },
    [emitChange],
  );

  const handleCalendarChange = useCallback((range: RangeValue<DateValue>) => {
    if (!range?.start || !range?.end) return;
    const nextRange: CalendarDateRange = {
      start: toCalendarDateValue(range.start),
      end: toCalendarDateValue(range.end),
    };
    setDraftRange(nextRange);
    setSelectedPreset(null);
  }, []);

  const handleInputChange = useCallback(
    (field: 'start' | 'end', nextValue: string) => {
      if (!nextValue || nextValue.length < 10) return;
      try {
        const parsed = parseDate(nextValue);
        const nextRange =
          field === 'start'
            ? { start: parsed, end: draftRange.end }
            : { start: draftRange.start, end: parsed };
        setDraftRange(nextRange);
        setSelectedPreset(null);
      } catch (error) {
        console.error('Invalid date input', error);
      }
    },
    [draftRange],
  );

  const handleApply = useCallback(() => {
    setInternalRange(draftRange);
    emitChange(draftRange, selectedPreset ?? null);
    setIsOpen(false);
  }, [draftRange, emitChange, selectedPreset]);

  const presetItems = useMemo(() => {
    return presets.map((key) => {
      const presetDefinition = DATE_RANGE_PRESETS[key];
      return {
        key,
        label: presetDefinition?.label ?? key,
      };
    });
  }, [presets]);

  useEffect(() => {
    if (isOpen) {
      setDraftRange(appliedRange);
    }
  }, [isOpen, appliedRange]);

  const triggerLabel = useMemo(() => {
    if (selectedPreset) {
      const presetDefinition = DATE_RANGE_PRESETS[selectedPreset];
      if (presetDefinition?.label) {
        return presetDefinition.label;
      }
    }
    return formatRangeLabel(appliedRange);
  }, [appliedRange, selectedPreset]);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-start">
      <PopoverTrigger>
        <Button
          className={className}
          size={size}
          variant="bordered"
          startContent={<Icon icon="solar:calendar-bold-duotone" width={18} className="text-primary" />}
          endContent={<Icon icon="solar:alt-arrow-down-linear" width={14} className="text-default-400" />}
        >
          {label ? (
            <div className="flex flex-col items-start">
              <span className="text-xs text-default-500">{label}</span>
              <span className="text-sm font-medium">{triggerLabel}</span>
            </div>
          ) : (
            <span className="text-sm font-medium">{triggerLabel || placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[700px] p-0">
        <div className="flex">
          <div className="w-40 border-r border-default-200 bg-default-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-default-400">Quick ranges</p>
            <div className="flex flex-col gap-1">
              {presetItems.map((presetItem) => {
                const isActive = selectedPreset === presetItem.key;
                return (
                  <Button
                    key={presetItem.key}
                    size="sm"
                    variant={isActive ? "flat" : "light"}
                    color={isActive ? "primary" : "default"}
                    className="justify-start text-left text-sm font-medium"
                    startContent={isActive && <Icon icon="solar:check-circle-bold" width={16} />}
                    onPress={() => handlePresetChange(presetItem.key)}
                  >
                    {presetItem.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                size="sm"
                placeholder="Start date"
                value={calendarDateToString(draftRange.start)}
                onValueChange={(input) => handleInputChange('start', input)}
                startContent={<Icon icon="solar:calendar-minimalistic-linear" width={16} className="text-default-400" />}
              />
              <Input
                size="sm"
                placeholder="End date"
                value={calendarDateToString(draftRange.end)}
                onValueChange={(input) => handleInputChange('end', input)}
                startContent={<Icon icon="solar:calendar-minimalistic-linear" width={16} className="text-default-400" />}
              />
            </div>

            <div className="mt-4">
              <RangeCalendar
                aria-label="Analytics date range"
                minValue={minDate}
                maxValue={maxDate}
                value={draftRange}
                onChange={handleCalendarChange}
                visibleMonths={2}
                weekdayStyle="short"
                calendarWidth={240}
              />
            </div>

            <Divider className="my-4" />

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="light" onPress={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" color="primary" onPress={handleApply} startContent={<Icon icon="solar:check-circle-bold" width={16} />}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
