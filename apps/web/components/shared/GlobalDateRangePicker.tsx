"use client";

import {
  Button,
  cn,
  Divider,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RangeCalendar,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  type CalendarDate,
  getLocalTimeZone,
  parseDate,
  today,
} from "@internationalized/date";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// RangeValue type from @react-aria (equivalent to HeroUI's expected type)
interface RangeValue<T> {
  start: T;
  end: T;
}

import { useAtom } from "jotai";

import { createLogger } from "@/libs/logging/Logger";
import {
  analyticsDateRangeFamily,
  type AnalyticsDateRange,
} from "@/store/atoms";

const logger = createLogger("GlobalDateRangePicker");

// Use the compatible RangeValue type
type CalendarDateRange = RangeValue<CalendarDate>;

// Helper function to format single date
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

// Convert CalendarDate to YYYY-MM-DD string
const calendarDateToString = (date: CalendarDate): string => {
  const year = date.year;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Convert DateRange to AnalyticsDateRange
const toAnalyticsDateRange = (
  range: CalendarDateRange,
  preset?: string | null
): AnalyticsDateRange => {
  return {
    start: calendarDateToString(range.start),
    end: calendarDateToString(range.end),
    preset: preset || undefined,
  };
};

interface GlobalDateRangePickerProps {
  value?: CalendarDateRange;
  onAnalyticsChange?: (range: AnalyticsDateRange) => void; // Analytics-specific callback
  mode?: "button" | "select"; // Button with popover or select dropdown
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  placeholder?: string;
  showCustomRange?: boolean;
  presets?: string[]; // Allow custom preset list
  minDate?: CalendarDate;
  maxDate?: CalendarDate;
  selectedPreset?: string | null;
  useGlobalState?: boolean; // Whether to use Jotai atom for state
  stateKey?: string; // Optional scoped key when using global state
  defaultPreset?: keyof typeof allDateRangePresets; // Optional preset applied on first load
}

// Comprehensive date range presets
const allDateRangePresets = {
  today: { key: "today", label: "Today" },
  yesterday: { key: "yesterday", label: "Yesterday" },
  last_7_days: { key: "last_7_days", label: "Last 7 days" },
  last_30_days: { key: "last_30_days", label: "Last 30 days" },
  last_90_days: { key: "last_90_days", label: "Last 90 days" },
  this_month: { key: "this_month", label: "This month" },
  this_year: { key: "this_year", label: "This year" },
  last_month: { key: "last_month", label: "Last month" },
  last_year: { key: "last_year", label: "Last year" },
  lifetime: { key: "lifetime", label: "Lifetime" },
};

// Default presets for different contexts
const defaultPresets = [
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

export default function GlobalDateRangePicker({
  value: externalValue,
  onAnalyticsChange,
  mode = "button",
  size = "md",
  className = "",
  label,
  placeholder = "Select date range",
  showCustomRange: _showCustomRange = true,
  presets = defaultPresets,
  minDate: _minDate,
  maxDate: _maxDate,
  selectedPreset: externalSelectedPreset,
  useGlobalState = true,
  stateKey,
  defaultPreset,
}: GlobalDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const globalScopeKey = useMemo(
    () => stateKey ?? pathname ?? "default",
    [pathname, stateKey],
  );

  // Use Jotai atom for global state management
  const [globalDateRange, setGlobalDateRange] = useAtom(
    analyticsDateRangeFamily(globalScopeKey),
  );

  const hasAppliedDefaultPresetRef = useRef(false);

  const [selectedPreset, setSelectedPreset] = useState<string | null>(
    externalSelectedPreset ||
      (useGlobalState ? globalDateRange?.preset || null : null)
  );

  // Convert global date range to CalendarDateRange
  const globalCalendarRange = useMemo(() => {
    if (!useGlobalState || !globalDateRange) return null;

    try {
      return {
        start: parseDate(globalDateRange.start),
        end: parseDate(globalDateRange.end),
      };
    } catch (error) {
      logger.error("Error parsing global date range", error);

      return null;
    }
  }, [globalDateRange, useGlobalState]);

  // Use either global state or external value
  const value = useGlobalState ? globalCalendarRange : externalValue;

  // Get date range from preset with error handling
  const getDateRangeFromPreset = useCallback(
    (preset: string): CalendarDateRange => {
      try {
        const todayDate = today(getLocalTimeZone());
        const now = new Date();

        switch (preset) {
          case "today":
            return { start: todayDate, end: todayDate };

          case "yesterday": {
            const yesterday = todayDate.subtract({ days: 1 });

            return { start: yesterday, end: yesterday };
          }

          case "last_7_days":
            return {
              start: todayDate.subtract({ days: 6 }),
              end: todayDate,
            };

          case "last_14_days":
            return {
              start: todayDate.subtract({ days: 13 }),
              end: todayDate,
            };

          case "last_30_days":
            return {
              start: todayDate.subtract({ days: 30 }),
              end: todayDate,
            };

          case "last_90_days":
            return {
              start: todayDate.subtract({ days: 89 }),
              end: todayDate,
            };

          case "last_6_months":
            return {
              start: todayDate.subtract({ months: 6 }),
              end: todayDate,
            };

          case "this_week": {
            const dayOfWeek = now.getDay();
            const startOfWeek = todayDate.subtract({ days: dayOfWeek });

            return {
              start: startOfWeek,
              end: todayDate,
            };
          }

          case "last_week": {
            const dayOfWeek = now.getDay();
            const startOfLastWeek = todayDate.subtract({ days: dayOfWeek + 7 });
            const endOfLastWeek = todayDate.subtract({ days: dayOfWeek + 1 });

            return {
              start: startOfLastWeek,
              end: endOfLastWeek,
            };
          }

          case "this_month": {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const startOfMonth = parseDate(`${year}-${month}-01`);

            return {
              start: startOfMonth,
              end: todayDate,
            };
          }

          case "last_month": {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
            const year = lastMonth.getFullYear();
            const month = String(lastMonth.getMonth() + 1).padStart(2, "0");
            const lastDay = new Date(
              year,
              lastMonth.getMonth() + 1,
              0
            ).getDate();

            const startOfLastMonth = parseDate(`${year}-${month}-01`);
            const endOfLastMonth = parseDate(
              `${year}-${month}-${String(lastDay).padStart(2, "0")}`
            );

            return {
              start: startOfLastMonth,
              end: endOfLastMonth,
            };
          }

          case "last_3_months":
            return {
              start: todayDate.subtract({ months: 3 }),
              end: todayDate,
            };

          case "this_quarter": {
            const quarter = Math.floor(now.getMonth() / 3);
            const startMonth = quarter * 3;
            const year = now.getFullYear();
            const month = String(startMonth + 1).padStart(2, "0");
            const startOfQuarter = parseDate(`${year}-${month}-01`);

            return {
              start: startOfQuarter,
              end: todayDate,
            };
          }

          case "last_quarter": {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
            const year =
              currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const startMonth = lastQuarter * 3;
            const endMonth = startMonth + 2;
            const lastDay = new Date(year, endMonth + 1, 0).getDate();

            const startOfQuarter = parseDate(
              `${year}-${String(startMonth + 1).padStart(2, "0")}-01`
            );
            const endOfQuarter = parseDate(
              `${year}-${String(endMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
            );

            return {
              start: startOfQuarter,
              end: endOfQuarter,
            };
          }

          case "this_year": {
            const year = now.getFullYear();
            const startOfYear = parseDate(`${year}-01-01`);

            return {
              start: startOfYear,
              end: todayDate,
            };
          }

          case "last_year": {
            const lastYear = now.getFullYear() - 1;
            const startOfLastYear = parseDate(`${lastYear}-01-01`);
            const endOfLastYear = parseDate(`${lastYear}-12-31`);

            return {
              start: startOfLastYear,
              end: endOfLastYear,
            };
          }

          case "week_to_date": {
            const dayOfWeek = now.getDay();
            const startOfWeek = todayDate.subtract({ days: dayOfWeek });

            return {
              start: startOfWeek,
              end: todayDate,
            };
          }

          case "month_to_date": {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const startOfMonth = parseDate(`${year}-${month}-01`);

            return {
              start: startOfMonth,
              end: todayDate,
            };
          }

          case "quarter_to_date": {
            const quarter = Math.floor(now.getMonth() / 3);
            const startMonth = quarter * 3;
            const year = now.getFullYear();
            const month = String(startMonth + 1).padStart(2, "0");
            const startOfQuarter = parseDate(`${year}-${month}-01`);

            return {
              start: startOfQuarter,
              end: todayDate,
            };
          }

          case "year_to_date": {
            const year = now.getFullYear();
            const startOfYear = parseDate(`${year}-01-01`);

            return {
              start: startOfYear,
              end: todayDate,
            };
          }

          case "lifetime": {
            // Limit to 2 years of data
            const twoYearsAgo = todayDate.subtract({ years: 2 });

            return {
              start: twoYearsAgo,
              end: todayDate,
            };
          }

          default:
            // Default to last 30 days
            return {
              start: todayDate.subtract({ days: 30 }),
              end: todayDate,
            };
        }
      } catch (error) {
        logger.error("Error calculating date range", { error });
        // Fallback to last 30 days
        const todayDate = today(getLocalTimeZone());

        return {
          start: todayDate.subtract({ days: 30 }),
          end: todayDate,
        };
      }
    },
    []
  );

  // Format date range for display
  const formatDateRange = useMemo(() => {
    if (!value?.start || !value?.end) return placeholder;

    try {
      const startStr = value.start.toString();
      const endStr = value.end.toString();

      if (startStr === endStr) {
        return startStr;
      }

      return `${startStr} - ${endStr}`;
    } catch {
      return placeholder;
    }
  }, [value, placeholder]);

  // Get label for current selection
  const getSelectionLabel = useCallback(() => {
    if (
      selectedPreset &&
      allDateRangePresets[selectedPreset as keyof typeof allDateRangePresets]
    ) {
      return allDateRangePresets[
        selectedPreset as keyof typeof allDateRangePresets
      ].label;
    }

    return formatDateRange;
  }, [selectedPreset, formatDateRange]);

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (preset: string) => {
      const range = getDateRangeFromPreset(preset);

      // Update global state if enabled
      if (useGlobalState) {
        const analyticsRange = toAnalyticsDateRange(range, preset);

        setGlobalDateRange(analyticsRange);
      }

      setSelectedPreset(preset);

      // Call analytics callback if provided
      if (onAnalyticsChange) {
        onAnalyticsChange(toAnalyticsDateRange(range, preset));
      }

      setIsOpen(false);
    },
    [
      getDateRangeFromPreset,
      onAnalyticsChange,
      useGlobalState,
      setGlobalDateRange,
    ]
  );

  // Handle custom range selection
  const handleCustomRangeChange = useCallback(
    (range: { start?: CalendarDate; end?: CalendarDate } | null) => {
      if (range?.start && range.end) {
        const dateRange = {
          start: range.start as CalendarDate,
          end: range.end as CalendarDate,
        };

        // Update global state if enabled
        if (useGlobalState) {
          const analyticsRange = toAnalyticsDateRange(dateRange, null);

          setGlobalDateRange(analyticsRange);
        }

        setSelectedPreset(null);

        // Call analytics callback if provided
        if (onAnalyticsChange) {
          onAnalyticsChange(toAnalyticsDateRange(dateRange, null));
        }
      }
    },
    [onAnalyticsChange, useGlobalState, setGlobalDateRange]
  );

  const applyDefaultPresetIfNeeded = useCallback(() => {
    if (
      !useGlobalState ||
      !defaultPreset ||
      hasAppliedDefaultPresetRef.current
    ) {
      return;
    }

    if (!presets.includes(defaultPreset)) {
      hasAppliedDefaultPresetRef.current = true;
      return;
    }

    if (globalDateRange?.preset === defaultPreset) {
      hasAppliedDefaultPresetRef.current = true;
      return;
    }

    const range = getDateRangeFromPreset(defaultPreset);
    const analyticsRange = toAnalyticsDateRange(range, defaultPreset);

    setGlobalDateRange(analyticsRange);
    setSelectedPreset(defaultPreset);

    if (onAnalyticsChange) {
      onAnalyticsChange(analyticsRange);
    }

    hasAppliedDefaultPresetRef.current = true;
  }, [
    defaultPreset,
    getDateRangeFromPreset,
    globalDateRange,
    onAnalyticsChange,
    presets,
    setGlobalDateRange,
    useGlobalState,
  ]);

  useEffect(() => {
    applyDefaultPresetIfNeeded();
  }, [applyDefaultPresetIfNeeded]);

  // Handle select mode change
  const handleSelectChange = useCallback(
    (keys: "all" | Set<string | number>) => {
      if (keys === "all") return;
      const selectedKey = Array.from(keys)[0] as string;

      if (selectedKey) {
        const range = getDateRangeFromPreset(selectedKey);

        // Update global state if enabled
        if (useGlobalState) {
          const analyticsRange = toAnalyticsDateRange(range, selectedKey);

          setGlobalDateRange(analyticsRange);
        }

        setSelectedPreset(selectedKey);

        // Call analytics callback if provided
        if (onAnalyticsChange) {
          onAnalyticsChange(toAnalyticsDateRange(range, selectedKey));
        }
      }
    },
    [
      getDateRangeFromPreset,
      onAnalyticsChange,
      useGlobalState,
      setGlobalDateRange,
    ]
  );

  // Filter available presets
  const availablePresets = presets
    .filter(
      (key) => allDateRangePresets[key as keyof typeof allDateRangePresets]
    )
    .map((key) => allDateRangePresets[key as keyof typeof allDateRangePresets]);

  // Render select mode
  if (mode === "select") {
    return (
      <Select
        className={className}
        label={label}
        placeholder={placeholder}
        selectedKeys={selectedPreset ? [selectedPreset] : []}
        size={size}
        onSelectionChange={handleSelectChange}
      >
        {availablePresets.map((option) => (
          <SelectItem key={option.key}>{option.label}</SelectItem>
        ))}
      </Select>
    );
  }

  // Render button mode with popover
  return (
    <Popover
      isOpen={isOpen}
      offset={10}
      placement="bottom"
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger>
        <Button
          aria-label="Select date range"
          className={cn(
            // Add border on trigger; subtle surface; no dropdown border
            "min-w-[220px] justify-between rounded-xl bg-content2 dark:bg-content1",
            className
          )}
          endContent={<Icon icon="solar:calendar-bold" width={20} />}
          size={size}
          variant="light"
        >
          <span className="text-left flex-1 truncate">
            {getSelectionLabel()}
          </span>
        </Button>
      </PopoverTrigger>
      {/* No border on dropdown; lighten chrome and tighten paddings */}
      <PopoverContent className="p-0 w-auto bg-transparent ">
        {/* Parent wrapper with different background and subtle border; remove dropdown shadow */}
        <div className="flex rounded-xl bg-content1 border border-divider">
          {/* Preset options */}
          <div className="w-44 bg-content2 p-3 rounded-l-xl">
            <div className="space-y-1">
              {availablePresets.map((option) => (
                <Button
                  key={option.key}
                  className={cn(
                    "w-full justify-start text-xs h-8 rounded-md",
                    selectedPreset === option.key
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-default-100"
                  )}
                  size="sm"
                  variant="light"
                  onPress={() => handlePresetSelect(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom range calendar */}
          <div className="p-4 bg-content1 rounded-r-xl">
            <div className="mb-3">
              <div className="flex gap-3 w-full items-center text-xs">
                <Input
                  readOnly
                  aria-label="Start date"
                  className="max-w-[160px]"
                  size="sm"
                  startContent={
                    <Icon
                      aria-hidden
                      className="mr-1"
                      icon="solar:calendar-bold"
                      width={16}
                    />
                  }
                  value={formatSingleDate(value?.start)}
                />
                <Icon
                  aria-hidden
                  className="text-default-800"
                  icon="solar:arrow-right-bold"
                  width={18}
                />
                <Input
                  readOnly
                  aria-label="End date"
                  className="max-w-[160px]"
                  size="sm"
                  startContent={
                    <Icon aria-hidden icon="solar:calendar-linear" width={16} />
                  }
                  value={formatSingleDate(value?.end)}
                />
              </div>
            </div>

            <RangeCalendar
              aria-label="Select custom date range"
              className="rounded-lg mt-2 overflow-hidden border shadow-none border-divider"
              classNames={{
                base: "bg-content1",
                headerWrapper: "pt-2",
                gridWrapper: "bg-content1",
              }}
              pageBehavior="visible"
              value={value as unknown as never}
              visibleMonths={2}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(range) => handleCustomRangeChange(range as any)}
            />

            <Divider className="bg-divider mt-4" />

            <div className="flex justify-end gap-2 mt-4 pt-3">
              <Button variant="light" onPress={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={() => {
                  if (value) {
                    // Update global state if enabled
                    if (useGlobalState) {
                      const analyticsRange = toAnalyticsDateRange(value, null);

                      setGlobalDateRange(analyticsRange);
                    }
                    setSelectedPreset(null);
                    // Call analytics callback if provided
                    if (onAnalyticsChange) {
                      onAnalyticsChange(toAnalyticsDateRange(value, null));
                    }
                    setIsOpen(false);
                  }
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
