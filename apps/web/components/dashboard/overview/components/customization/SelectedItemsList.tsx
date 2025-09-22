"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Chip, ScrollShadow } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback, useMemo } from "react";

import { METRICS } from "../../metrics/registry";
import { WIDGETS } from "../../widgets/registry";

import { SortableItem } from "./SortableItem";

interface SelectedItemsListProps {
  items: string[];
  type: "kpi" | "widget";
  onItemsReorder: (items: string[]) => void;
  onItemRemove: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const SelectedItemsList = React.memo(function SelectedItemsList({
  items,
  type,
  onItemsReorder,
  onItemRemove,
  className,
  style,
}: SelectedItemsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);

        onItemsReorder(arrayMove(items, oldIndex, newIndex));
      }
    },
    [items, onItemsReorder]
  );

  const pinnedItems = useMemo(() => items.slice(0, 10), [items]);
  const additionalItems = useMemo(() => items.slice(10), [items]);

  return (
    <div
      className={`border-l pl-4 overflow-hidden ${className || ""}`}
      style={style}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-default-700">
          {type === "kpi" ? "Selected KPIs" : "Selected Widgets"}
        </h3>
        <Chip
          color={type === "kpi" ? "primary" : "secondary"}
          size="sm"
          variant="flat"
        >
          {items.length} total
        </Chip>
      </div>
      <ScrollShadow hideScrollBar className="h-[400px]" visibility="none">
        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {items.length === 0 ? (
              <EmptyState type={type} />
            ) : (
              <>
                {type === "kpi" && pinnedItems.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-default-500 font-medium mb-2 px-1">
                      Pinned Metrics
                    </div>
                    <div className="space-y-0">
                      {pinnedItems.map((itemId) => {
                        const metric = METRICS[itemId];

                        if (!metric) return null;

                        return (
                          <SortableItem
                            key={itemId}
                            icon={metric.icon}
                            id={itemId}
                            label={metric.label}
                            type="kpi"
                            onRemove={onItemRemove}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {type === "kpi" && additionalItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-divider">
                    <div className="text-xs text-default-500 font-medium mb-2 px-1">
                      Additional ({additionalItems.length})
                    </div>
                    <div className="space-y-0">
                      {additionalItems.map((itemId) => {
                        const metric = METRICS[itemId];

                        if (!metric) return null;

                        return (
                          <SortableItem
                            key={itemId}
                            icon={metric.icon}
                            id={itemId}
                            label={metric.label}
                            type="kpi"
                            onRemove={onItemRemove}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {type === "widget" &&
                  items.map((itemId) => {
                    const widget = WIDGETS[itemId];

                    if (!widget) return null;

                    return (
                      <SortableItem
                        key={itemId}
                        icon={widget.icon}
                        id={itemId}
                        label={widget.name}
                        type="widget"
                        onRemove={onItemRemove}
                      />
                    );
                  })}
              </>
            )}
          </SortableContext>
        </DndContext>
      </ScrollShadow>
    </div>
  );
});

function EmptyState({ type }: { type: "kpi" | "widget" }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-default-400">
      <Icon
        className="mb-2"
        icon={type === "kpi" ? "solar:chart-2-linear" : "solar:widget-linear"}
        width={32}
      />
      <p className="text-sm">No items selected</p>
      <p className="text-xs">
        Select {type === "kpi" ? "metrics" : "widgets"} from the left
      </p>
    </div>
  );
}
