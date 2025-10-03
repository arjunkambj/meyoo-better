"use client";

import { Checkbox, cn, ScrollShadow } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback, useMemo } from "react";

interface Item {
  id: string;
  label?: string;
  name?: string;
  icon: string;
  iconColor?: string;
  description?: string;
}

type SectionHeader = {
  type: "section";
  id: string;
  label: string;
  icon: string;
  count?: number;
};

type ListItem = Item | SectionHeader;

interface VirtualizedItemSelectorProps {
  items: ListItem[];
  selectedIds: string[];
  onItemToggle: (id: string, checked: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
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
      [item.id, onToggle]
    );

    return (
      <div
        className={`group relative rounded-md border transition-all ${
          isSelected
            ? "bg-primary-50/80 dark:bg-primary-50/20 border-default-200/20"
            : "bg-default-100 border-default-200/20"
        }`}
      >
        <Checkbox
          classNames={{
            base: "py-1.5 px-2 m-0 min-w-full",
            wrapper: "m-0 mr-1.5 w-4 h-4",
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
                  ? "text-primary-600 dark:text-primary-400"
                  : item.iconColor || "text-default-700"
              }
              icon={item.icon}
              width={14}
            />
            <span
              className={`text-xs font-medium flex-1 truncate leading-tight ${
                isSelected
                  ? "text-primary-700 dark:text-primary-400"
                  : "text-default-800"
              }`}
            >
              {item.label || item.name}
            </span>
          </div>
        </Checkbox>
      </div>
    );
  }
);

ItemRow.displayName = "ItemRow";

export function VirtualizedItemSelector({
  items,
  selectedIds,
  onItemToggle,
  className,
  style,
}: VirtualizedItemSelectorProps) {
  // Create a Set for faster lookup
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Memoized toggle handler
  const handleItemToggle = useCallback(
    (id: string, checked: boolean) => {
      onItemToggle(id, checked);
    },
    [onItemToggle]
  );

  // Process items into renderable rows
  const renderableRows = useMemo(() => {
    const rows: Array<
      | { type: "section"; section: SectionHeader }
      | { type: "items"; items: Item[] }
    > = [];
    let currentRowItems: Item[] = [];

    items.forEach((item) => {
      const isSection = "type" in item && item.type === "section";

      if (isSection) {
        // Flush current row if it has items
        if (currentRowItems.length > 0) {
          rows.push({ type: "items", items: currentRowItems });
          currentRowItems = [];
        }
        // Add section header
        rows.push({ type: "section", section: item as SectionHeader });
      } else {
        // Add item to current row
        currentRowItems.push(item as Item);

        // If we have 2 items, flush the row
        if (currentRowItems.length === 2) {
          rows.push({ type: "items", items: currentRowItems });
          currentRowItems = [];
        }
      }
    });

    // Flush any remaining items
    if (currentRowItems.length > 0) {
      rows.push({ type: "items", items: currentRowItems });
    }

    return rows;
  }, [items]);

  return (
    <div
      className={cn(
        "px-3 py-2 flex flex-col rounded-lg bg-background",
        className
      )}
      style={style}
    >
      <ScrollShadow hideScrollBar className="h-[430px]" visibility="none">
        <div className="pr-1">
          {renderableRows.map((row, index) => {
            if (row.type === "section") {
              const section = row.section;
              return (
                <div key={section.id} className="w-full mt-4 mb-2 first:mt-0">
                  <div className="flex items-center justify-between px-2 py-1.5 bg-default-100 rounded-md border border-default-200/80">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="text-primary-600 dark:text-primary-400"
                        icon={section.icon}
                        width={14}
                      />
                      <span className="text-xs font-semibold text-default-800">
                        {section.label}
                      </span>
                    </div>
                    {section.count && (
                      <span className="text-xs font-medium text-default-600 bg-default-200/50 px-2 py-0.5 rounded-full">
                        {section.count}
                      </span>
                    )}
                  </div>
                </div>
              );
            } else {
              // Render items row
              const rowItems = row.items;
              if (rowItems.length === 0) return null;

              return (
                <div key={`row-${index}`} className="flex gap-2 mb-2">
                  {rowItems[0] && (
                    <div className="w-[calc(50%-0.25rem)]">
                      <ItemRow
                        isSelected={selectedIdSet.has(rowItems[0].id)}
                        item={rowItems[0]}
                        onToggle={handleItemToggle}
                      />
                    </div>
                  )}
                  {rowItems[1] ? (
                    <div className="w-[calc(50%-0.25rem)]">
                      <ItemRow
                        isSelected={selectedIdSet.has(rowItems[1].id)}
                        item={rowItems[1]}
                        onToggle={handleItemToggle}
                      />
                    </div>
                  ) : (
                    <div className="w-[calc(50%-0.25rem)]"></div>
                  )}
                </div>
              );
            }
          })}
        </div>
      </ScrollShadow>
    </div>
  );
}
