"use client";

import { Button, Divider, Input, Popover, PopoverContent, PopoverTrigger, RangeCalendar } from "@heroui/react";
import { Icon } from "@iconify/react";
import { type CalendarDate, type DateValue, getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalyticsDateRange } from "@repo/types";

interface RangeValue<T> {
  start: T;
  end: T;
}

type CalendarDateRange = RangeValue<CalendarDate>;

interface GlobalDateRangePickerProps {
  value?: CalendarDateRange;
  onAnalyticsChange?: (range: AnalyticsDateRange) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  placeholder?: string;
  presets?: string[];
  defaultPreset?: keyof typeof allDateRangePresets;
  minDate?: CalendarDate;
  maxDate?: CalendarDate;
}

const allDateRangePresets = {
  today: { key: "today", label: "Today" },
  yesterday: { key: "yesterday", label: "Yesterday" },
  last_7_days: { key: "last_7_days", label: "Last 7 days" },
  last_30_days: { key: "last_30_days", label: "Last 30 days" },
  last_90_days: { key: "last_90_days", label: "Last 90 days" },
  this_month: { key: "this_month", label: "This month" },
  last_month: { key: "last_month", label: "Last month" },
  this_year: { key: "this_year", label: "This year" },
  last_year: { key: "last_year", label: "Last year" },
  lifetime: { key: "lifetime", label: "Lifetime" },
} as const;

const defaultPresetKeys: string[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_month",
  "last_month",
  "this_year",
  "lifetime",
];

const calendarDateToString = (date: CalendarDate): string => {
  const year = date.year;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatSingleDate = (date?: CalendarDate): string => {
  if (!date) return "";
  try {
    const jsDate = new Date(date.year, date.month - 1, date.day);
    return jsDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date.toString();
  }
};

const formatRangeLabel = (range?: CalendarDateRange): string => {
  if (!range) return "Select date range";
  const startLabel = formatSingleDate(range.start);
  const endLabel = formatSingleDate(range.end);
  return `${startLabel} – ${endLabel}`;
};

const toAnalyticsRange = (range: CalendarDateRange, preset?: string | null): AnalyticsDateRange => ({
  startDate: calendarDateToString(range.start),
  endDate: calendarDateToString(range.end),
  preset: preset ?? undefined,
});

const getPresetRange = (preset: string): CalendarDateRange => {
  const todayDate = today(getLocalTimeZone());
  const now = new Date();

  switch (preset) {
    case "today":
      return { start: todayDate, end: todayDate };
    case "yesterday": {
      const yesterday = todayDate.subtract({ days: 1 });
      return { start: yesterday, end: yesterday };
    }
    case "last_7_days": {
      const start = todayDate.subtract({ days: 6 });
      return { start, end: todayDate };
    }
    case "last_30_days": {
      const start = todayDate.subtract({ days: 29 });
      return { start, end: todayDate };
    }
    case "last_90_days": {
      const start = todayDate.subtract({ days: 89 });
      return { start, end: todayDate };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: parseDate(start.toISOString().slice(0, 10)),
        end: parseDate(end.toISOString().slice(0, 10)),
      };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: parseDate(start.toISOString().slice(0, 10)),
        end: parseDate(end.toISOString().slice(0, 10)),
      };
    }
    case "this_year": {
      const start = parseDate(`${now.getFullYear()}-01-01`);
      const end = parseDate(`${now.getFullYear()}-12-31`);
      return { start, end };
    }
    case "last_year": {
      const year = now.getFullYear() - 1;
      const start = parseDate(`${year}-01-01`);
      const end = parseDate(`${year}-12-31`);
      return { start, end };
    }
    case "lifetime": {
      const start = parseDate("1970-01-01");
      return { start, end: todayDate };
    }
    default:
      return { start: todayDate.subtract({ days: 29 }), end: todayDate };
  }
};

type CalendarDateConvertible = DateValue & {
  toCalendarDate: () => CalendarDate;
};

const isCalendarDateConvertible = (value: DateValue): value is CalendarDateConvertible => {
  return typeof value === "object" && value !== null && "toCalendarDate" in value &&
    typeof (value as CalendarDateConvertible).toCalendarDate === "function";
};

function toCalendarDateValue(value: DateValue): CalendarDate {
  if (isCalendarDateConvertible(value)) {
    return value.toCalendarDate();
  }
  return value as CalendarDate;
}

export default function GlobalDateRangePicker({
  value,
  onAnalyticsChange,
  size = "md",
  className,
  label,
  placeholder = "Select date range",
  presets = defaultPresetKeys,
  defaultPreset,
  minDate,
  maxDate,
}: GlobalDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    defaultPreset ?? presets[0] ?? null,
  );

  const initialRange = useMemo(() => {
    if (value) return value;
    if (selectedPreset) return getPresetRange(selectedPreset);
    return getPresetRange("last_30_days");
  }, [value, selectedPreset]);

  const [internalRange, setInternalRange] = useState<CalendarDateRange>(initialRange);

  useEffect(() => {
    if (value) {
      setInternalRange(value);
    }
  }, [value]);

  const effectiveRange = value ?? internalRange;

  const emitChange = useCallback(
    (range: CalendarDateRange, preset?: string | null) => {
      if (onAnalyticsChange) {
        onAnalyticsChange(toAnalyticsRange(range, preset ?? undefined));
      }
    },
    [onAnalyticsChange],
  );

  const handlePresetChange = useCallback(
    (key: string) => {
      const presetRange = getPresetRange(key);
      setSelectedPreset(key);
      setInternalRange(presetRange);
      emitChange(presetRange, key);
    },
    [emitChange],
  );

  const handleCalendarChange = useCallback(
    (range: RangeValue<DateValue>) => {
      if (!range?.start || !range?.end) return;
      const nextRange: CalendarDateRange = {
        start: toCalendarDateValue(range.start),
        end: toCalendarDateValue(range.end),
      };
      setInternalRange(nextRange);
      setSelectedPreset(null);
      emitChange(nextRange, null);
    },
    [emitChange],
  );

  const handleInputChange = useCallback(
    (field: "start" | "end", nextValue: string) => {
      if (!nextValue || nextValue.length < 10) return;
      try {
        const parsed = parseDate(nextValue);
        const nextRange =
          field === "start"
            ? { start: parsed, end: effectiveRange.end }
            : { start: effectiveRange.start, end: parsed };
        setInternalRange(nextRange);
        setSelectedPreset(null);
        emitChange(nextRange, null);
      } catch (error) {
        console.error("Invalid date input", error);
      }
    },
    [effectiveRange, emitChange],
  );

  const presetItems = useMemo(() => {
    return presets.map((key) => {
      const preset = allDateRangePresets[key as keyof typeof allDateRangePresets];
      return {
        key,
        label: preset?.label ?? key,
      };
    });
  }, [presets]);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-start">
      <PopoverTrigger>
        <Button
          className={className}
          size={size}
          variant="bordered"
          startContent={<Icon icon="solar:calendar-date-bold-duotone" width={18} />}
        >
          {label ? (
            <div className="flex flex-col items-start">
              <span className="text-xs text-default-500">{label}</span>
              <span className="text-sm font-medium">
                {formatRangeLabel(effectiveRange)}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium">
              {formatRangeLabel(effectiveRange) || placeholder}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-4 w-[320px]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-default-900">Date Range</span>
            {selectedPreset && (
              <span className="text-xs text-default-500">
                {allDateRangePresets[selectedPreset as keyof typeof allDateRangePresets]?.label}
              </span>
            )}
          </div>

          <RangeCalendar
            aria-label="Analytics date range"
            minValue={minDate}
            maxValue={maxDate}
            value={effectiveRange}
            onChange={handleCalendarChange}
          />

          <Divider className="my-1" />

          <div className="flex flex-wrap gap-2">
            {presetItems.map((preset) => (
              <Button
                key={preset.key}
                size="sm"
                variant={selectedPreset === preset.key ? "solid" : "light"}
                onPress={() => handlePresetChange(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <Divider className="my-1" />

          <div className="flex items-center gap-2">
            <Input
              label="Start"
              value={calendarDateToString(effectiveRange.start)}
              onValueChange={(input) => handleInputChange("start", input)}
            />
            <Input
              label="End"
              value={calendarDateToString(effectiveRange.end)}
              onValueChange={(input) => handleInputChange("end", input)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="light" onPress={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
