"use client";

import { Checkbox, cn, Input, ScrollShadow } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

interface Item {
  id: string;
  label?: string;
  name?: string;
  icon: string;
  iconColor?: string;
  description?: string;
}

type SectionEntry = {
  type: 'section';
  id: string; // unique section id
  label: string; // section label (e.g., category name)
  icon?: string; // optional icon for section
};

type ListEntry = Item | SectionEntry;

interface VirtualizedItemSelectorProps {
  items: ListEntry[];
  selectedIds: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onItemToggle: (id: string, checked: boolean) => void;
  placeholder: string;
  className?: string;
}

// Memoized item component for better performance
const ItemRow = React.memo(
  ({
    item,
    isSelected,
    onToggle,
  }: {
    item: Item;
    isSelected: boolean;
    onToggle: (id: string, checked: boolean) => void;
  }) => {
    const handleChange = useCallback(
      (checked: boolean) => {
        onToggle(item.id, checked);
      },
      [item.id, onToggle],
    );

    return (
      <div
        className={`py-1 px-2 border border-divider rounded-md hover:bg-default-50 transition-colors ${
          isSelected ? "bg-primary-50 border-primary-200" : ""
        }`}
      >
        <Checkbox
          classNames={{
            base: "p-0 m-0 min-w-full",
            wrapper: "m-0 mr-2 w-4 h-4",
            label: "w-full",
          }}
          isSelected={isSelected}
          size="sm"
          value={item.id}
          onValueChange={handleChange}
        >
          <div className="flex items-center gap-1.5 w-full">
            <Icon
              className={
                isSelected
                  ? "text-primary-500"
                  : item.iconColor || "text-default-400"
              }
              icon={item.icon}
              width={14}
            />
            <span className="text-xs font-medium text-default-700 flex-1">
              {item.label || item.name}
            </span>
            {item.description && (
              <span
                className="text-xs text-default-400 truncate max-w-[120px]"
                title={item.description}
              >
                {item.description.length > 20
                  ? `${item.description.substring(0, 20)}...`
                  : item.description}
              </span>
            )}
          </div>
        </Checkbox>
      </div>
    );
  },
);

ItemRow.displayName = "ItemRow";

// Simple non-selectable section header row
const SectionRow = React.memo(({ entry }: { entry: SectionEntry }) => {
  return (
    <div className="py-1 px-2 text-[11px] uppercase tracking-wide text-default-400 flex items-center gap-1.5">
      {entry.icon ? (
        <Icon className="text-default-300" icon={entry.icon} width={12} />
      ) : null}
      <span className="font-semibold">{entry.label}</span>
    </div>
  );
});
SectionRow.displayName = 'SectionRow';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function VirtualizedItemSelector({
  items,
  selectedIds,
  searchQuery,
  onSearchChange,
  onItemToggle,
  placeholder,
  className,
}: VirtualizedItemSelectorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);

  // Debounced search
  const debouncedSearchQuery = useDebounce(localSearchQuery, 200);

  // Update parent component when debounced value changes
  useEffect(() => {
    onSearchChange(debouncedSearchQuery);
  }, [debouncedSearchQuery, onSearchChange]);

  // Create a Set for faster lookup
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Estimate item size - much more compact now
  const estimateSize = useCallback(() => {
    return 32; // Compact size for all items
  }, []);

  // Virtual list configuration
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 8, // Render more items for smoother scrolling with compact items
    gap: 4, // Smaller gap between items
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Memoized toggle handler
  const handleItemToggle = useCallback(
    (id: string, checked: boolean) => {
      onItemToggle(id, checked);
    },
    [onItemToggle],
  );

  return (
    <div className={cn("px-4 flex flex-col", className)}>
      <Input
        className="mb-3 flex-shrink-0"
        placeholder={placeholder}
        size="sm"
        startContent={
          <Icon
            className="text-default-400"
            icon="solar:search-linear"
            width={14}
          />
        }
        value={localSearchQuery}
        onValueChange={setLocalSearchQuery}
      />

      <ScrollShadow hideScrollBar className="h-[400px]" visibility="none">
        <div ref={parentRef} className="h-full overflow-y-auto scrollbar-hide">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualItem) => {
              const entry = items[virtualItem.index];
              if (!entry) return null;
              const isSection = "type" in entry && entry.type === 'section';

              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {isSection ? (
                    <SectionRow entry={entry as SectionEntry} />
                  ) : (
                    <ItemRow
                      isSelected={selectedIdSet.has((entry as Item).id)}
                      item={entry as Item}
                      onToggle={handleItemToggle}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollShadow>
    </div>
  );
}
