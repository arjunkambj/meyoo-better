"use client";

import {
  Button,
  Chip,
  cn,
  DatePicker,
  DateRangePicker,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { parseDate } from "@internationalized/date";
import React, { useCallback, useState } from "react";

export type FilterType =
  | "select"
  | "multiselect"
  | "search"
  | "date"
  | "daterange"
  | "number"
  | "boolean";

export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  color?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger";
}

export interface Filter {
  key: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
  icon?: string;
  defaultValue?: string | number | boolean | null;
}

export interface FilterPreset {
  key: string;
  label: string;
  icon?: string;
  filters: Record<string, string | number | boolean | null>;
}

export interface FilterBarProps {
  filters: Filter[];
  values: Record<string, unknown>;
  onFilterChange: (key: string, value: unknown) => void;
  onReset?: () => void;
  presets?: FilterPreset[];
  onPresetSelect?: (preset: FilterPreset) => void;
  className?: string;
}

export function FilterBar({
  filters,
  values,
  onFilterChange,
  onReset,
  presets,
  onPresetSelect,
  className,
}: FilterBarProps) {
  const [searchValues, setSearchValues] = useState<Record<string, string>>({});

  // Check if we should display inline (for header usage) - moved to top
  const isInline = className?.includes("inline");

  const handleSearchChange = useCallback((key: string, value: string) => {
    setSearchValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSearchSubmit = useCallback(
    (key: string) => {
      onFilterChange(key, searchValues[key] || "");
    },
    [searchValues, onFilterChange],
  );

  const getActiveFiltersCount = () => {
    return Object.entries(values).filter(([key, value]) => {
      const filter = filters.find((f) => f.key === key);

      if (!filter) return false;

      if (filter.type === "multiselect" && Array.isArray(value)) {
        return value.length > 0;
      }

      return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        value !== filter.defaultValue
      );
    }).length;
  };

  const renderFilter = (filter: Filter) => {
    const value = values[filter.key];

    switch (filter.type) {
      case "select":
        return (
          <Dropdown>
            <DropdownTrigger>
              <Button
                endContent={
                  <Icon
                    className="w-4 h-4"
                    icon="solar:alt-arrow-down-linear"
                  />
                }
                size={isInline ? "sm" : "md"}
                startContent={
                  filter.icon && <Icon className="w-4 h-4" icon={filter.icon} />
                }
                variant="flat"
              >
                {value && filter.options?.find((o) => o.value === value)?.label
                  ? filter.options.find((o) => o.value === value)?.label
                  : filter.label}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={filter.label}
              selectedKeys={value ? new Set([value as string]) : new Set()}
              selectionMode="single"
              onAction={(key) => onFilterChange(filter.key, key)}
            >
              {filter.options?.map((option) => (
                <DropdownItem
                  key={option.value}
                  startContent={
                    option.icon && (
                      <Icon className="w-4 h-4" icon={option.icon} />
                    )
                  }
                >
                  {option.label}
                </DropdownItem>
              )) || []}
            </DropdownMenu>
          </Dropdown>
        );

      case "multiselect": {
        const selectedValues = (value || []) as string[];

        return (
          <Dropdown>
            <DropdownTrigger>
              <Button
                endContent={
                  <Icon
                    className="w-4 h-4"
                    icon="solar:alt-arrow-down-linear"
                  />
                }
                size={isInline ? "sm" : "md"}
                startContent={
                  filter.icon && <Icon className="w-4 h-4" icon={filter.icon} />
                }
                variant="flat"
              >
                {selectedValues && selectedValues.length > 0
                  ? `${filter.label} (${selectedValues.length})`
                  : filter.label}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={filter.label}
              selectedKeys={new Set(selectedValues)}
              selectionMode="multiple"
              onAction={(key) => {
                const keyStr = String(key);
                const newValues = selectedValues.includes(keyStr)
                  ? selectedValues.filter((v) => v !== keyStr)
                  : [...selectedValues, keyStr];

                onFilterChange(filter.key, newValues);
              }}
            >
              {filter.options?.map((option) => (
                <DropdownItem
                  key={option.value}
                  startContent={
                    option.icon && (
                      <Icon className="w-4 h-4" icon={option.icon} />
                    )
                  }
                >
                  {option.label}
                </DropdownItem>
              )) || []}
            </DropdownMenu>
          </Dropdown>
        );
      }

      case "search":
        return (
          <Input
            isClearable
            className={isInline ? "w-40" : "max-w-xs"}
            placeholder={filter.placeholder || `Search...`}
            size={isInline ? "sm" : "md"}
            startContent={
              <Icon className="w-4 h-4" icon="solar:magnifer-linear" />
            }
            value={(searchValues[filter.key] || value || "") as string}
            onBlur={() => handleSearchSubmit(filter.key)}
            onClear={() => {
              handleSearchChange(filter.key, "");
              onFilterChange(filter.key, "");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit(filter.key);
              }
            }}
            onValueChange={(val) => handleSearchChange(filter.key, val)}
          />
        );

      case "date":
        return (
          <DatePicker
            className={isInline ? "w-40" : "max-w-xs"}
            label={filter.label}
            size={isInline ? "sm" : "md"}
            value={
              value ? (parseDate(value as string) as unknown as never) : null
            }
            onChange={(date: unknown) =>
              onFilterChange(filter.key, date ? String(date) : null)
            }
          />
        );

      case "daterange":
        return (
          <DateRangePicker
            className={isInline ? "w-60" : "max-w-xs"}
            label={filter.label}
            size={isInline ? "sm" : "md"}
            value={value as unknown as never}
            onChange={(range: unknown) => onFilterChange(filter.key, range)}
          />
        );

      case "number":
        return (
          <Input
            className={isInline ? "w-32" : "max-w-xs"}
            label={filter.label}
            placeholder={filter.placeholder}
            size={isInline ? "sm" : "md"}
            startContent={
              filter.icon && <Icon className="w-4 h-4" icon={filter.icon} />
            }
            type="number"
            value={(value || "") as string}
            onValueChange={(val) =>
              onFilterChange(filter.key, val ? Number(val) : undefined)
            }
          />
        );

      case "boolean":
        return (
          <Button
            color={value ? "primary" : "default"}
            size={isInline ? "sm" : "md"}
            startContent={
              filter.icon && <Icon className="w-4 h-4" icon={filter.icon} />
            }
            variant={value ? "solid" : "flat"}
            onPress={() => onFilterChange(filter.key, !value)}
          >
            {filter.label}
          </Button>
        );

      default:
        return null;
    }
  };

  const activeFilters = getActiveFiltersCount();

  if (isInline) {
    return (
      <div className={cn("flex gap-2 items-center flex-nowrap", className)}>
        {filters.map((filter) => (
          <React.Fragment key={filter.key}>
            {renderFilter(filter)}
          </React.Fragment>
        ))}
        {activeFilters > 0 && onReset && (
          <Button
            size="sm"
            startContent={
              <Icon className="w-4 h-4" icon="solar:restart-linear" />
            }
            variant="light"
            onPress={onReset}
          >
            Clear ({activeFilters})
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Presets */}
      {presets && presets.length > 0 && (
        <div className="flex gap-2 items-center">
          <span className="text-small text-default-500">Quick filters:</span>
          {presets.map((preset) => (
            <Button
              key={preset.key}
              size="sm"
              startContent={
                preset.icon && <Icon className="w-4 h-4" icon={preset.icon} />
              }
              variant="flat"
              onPress={() => onPresetSelect?.(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      {/* Single row for filters and active status */}
      <div className="flex items-center gap-2 flex-nowrap">
        {/* Filters */}
        {filters.map((filter) => (
          <React.Fragment key={filter.key}>
            {renderFilter(filter)}
          </React.Fragment>
        ))}

        {/* Active filters indicator and reset - kept inline */}
        {activeFilters > 0 && (
          <>
            <Chip color="primary" size="sm" variant="flat">
              {activeFilters} active
            </Chip>
            {onReset && (
              <Button
                size="sm"
                startContent={
                  <Icon className="w-4 h-4" icon="solar:restart-linear" />
                }
                variant="light"
                onPress={onReset}
              >
                Reset
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
