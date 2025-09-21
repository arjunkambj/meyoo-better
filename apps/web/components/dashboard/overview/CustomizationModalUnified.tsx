"use client";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tab,
  Tabs,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback, useMemo, useState, useTransition } from "react";
import { SelectedItemsList } from "./components/customization/SelectedItemsList";
import { VirtualizedItemSelector } from "./components/customization/VirtualizedItemSelector";
import { METRICS, METRIC_CATEGORIES } from "./metrics/registry";
import { getAllWidgets } from "./widgets/registry";

// Memoized components for better performance
const MemoizedVirtualizedItemSelector = React.memo(VirtualizedItemSelector);
const MemoizedSelectedItemsList = React.memo(SelectedItemsList);

interface CustomizationModalUnifiedProps {
  isOpen: boolean;
  onClose: () => void;
  kpiItems: string[]; // KPI metric IDs
  widgetItems: string[]; // Widget IDs
  onApply: (kpiItems: string[], widgetItems: string[]) => void;
}

export function CustomizationModalUnified({
  isOpen,
  onClose,
  kpiItems,
  widgetItems,
  onApply,
}: CustomizationModalUnifiedProps) {
  const [activeTab, setActiveTab] = useState<"kpi" | "widget">("kpi");
  const [selectedKpis, setSelectedKpis] = useState<string[]>(kpiItems);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(widgetItems);
  const [_isPending, startTransition] = useTransition();

  // Memoize all metrics and widgets to avoid recalculation
  const allMetrics = useMemo(() => Object.values(METRICS), []);
  const allWidgets = useMemo(() => getAllWidgets(), []);

  // Get items based on active tab - with section headers for better organization
  const displayItems = useMemo(() => {
    if (activeTab === "kpi") {
      // Get all metrics with section headers for categories
      const itemsWithHeaders: Array<
        | (typeof allMetrics)[number]
        | {
            type: "section";
            id: string;
            label: string;
            icon: string;
            count: number;
          }
      > = [];

      for (const category of Object.values(METRIC_CATEGORIES)) {
        const metricsInCategory = allMetrics.filter(
          (m) => m.category === category.id
        );
        if (metricsInCategory.length === 0) continue;

        // Add section header with count
        itemsWithHeaders.push({
          type: "section",
          id: `section-${category.id}`,
          label: category.name,
          icon: category.icon,
          count: metricsInCategory.length,
        });

        // Keep order stable by the order in category.metrics, fallback to label
        const orderIndex: Record<string, number> = Object.create(null);
        category.metrics.forEach((id, idx) => (orderIndex[id] = idx));
        metricsInCategory
          .slice()
          .sort((a, b) => {
            const ai = orderIndex[a.id];
            const bi = orderIndex[b.id];
            if (ai !== undefined && bi !== undefined) return ai - bi;
            if (ai !== undefined) return -1;
            if (bi !== undefined) return 1;
            return a.label.localeCompare(b.label);
          })
          .forEach((metric) => itemsWithHeaders.push(metric));
      }

      return itemsWithHeaders;
    } else {
      // Return all widgets
      return allWidgets;
    }
  }, [activeTab, allMetrics, allWidgets]);

  // no-op

  const handleKPIToggle = useCallback((metricId: string, checked: boolean) => {
    if (checked) {
      setSelectedKpis((prev) =>
        prev.includes(metricId) ? prev : [...prev, metricId]
      );
    } else {
      setSelectedKpis((prev) => prev.filter((id) => id !== metricId));
    }
  }, []);

  const handleWidgetToggle = useCallback(
    (widgetId: string, checked: boolean) => {
      if (checked) {
        setSelectedWidgets((prev) =>
          prev.includes(widgetId) ? prev : [...prev, widgetId]
        );
      } else {
        setSelectedWidgets((prev) => prev.filter((id) => id !== widgetId));
      }
    },
    []
  );

  const handleApply = useCallback(() => {
    onApply(selectedKpis, selectedWidgets);
    onClose();
  }, [selectedKpis, selectedWidgets, onApply, onClose]);

  const handleItemRemove = useCallback(
    (id: string) => {
      if (activeTab === "kpi") {
        setSelectedKpis((prev) => prev.filter((i) => i !== id));
      } else {
        setSelectedWidgets((prev) => prev.filter((i) => i !== id));
      }
    },
    [activeTab]
  );

  const handleItemsReorder = useCallback(
    (items: string[]) => {
      if (activeTab === "kpi") {
        setSelectedKpis(items);
      } else {
        setSelectedWidgets(items);
      }
    },
    [activeTab]
  );

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="4xl" onClose={onClose}>
      <ModalContent className="max-h-[85vh]">
        {(onClose) => (
          <>
            <ModalHeader className="pb-3 pt-5 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-default-900">
                  Customize Dashboard
                </h2>
                <p className="text-xs text-default-600 mt-1">
                  Select KPIs and widgets for your dashboard
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="p-4 overflow-hidden flex flex-col bg-default-50 gap-4">
              {/* Tabs and Clear button in same row */}
              <div className="flex items-center justify-between">
                <Tabs
                  aria-label="Customization tabs"
                  selectedKey={activeTab}
                  onSelectionChange={(key) => {
                    startTransition(() => {
                      setActiveTab(key as "kpi" | "widget");
                    });
                  }}
                >
                  <Tab
                    key="kpi"
                    title={
                      <div className="flex items-center gap-1.5">
                        <Icon icon="solar:chart-2-bold-duotone" width={14} />
                        <span className="text-sm">KPI Cards</span>
                        <Chip
                          className="h-5 text-xs"
                          color="primary"
                          size="sm"
                          variant="flat"
                        >
                          {selectedKpis.length}
                        </Chip>
                      </div>
                    }
                  />
                  <Tab
                    key="widget"
                    title={
                      <div className="flex items-center gap-1.5">
                        <Icon icon="solar:widget-bold-duotone" width={14} />
                        <span className="text-sm">Widgets</span>
                        <Chip
                          className="h-5 text-xs"
                          color="secondary"
                          size="sm"
                          variant="flat"
                        >
                          {selectedWidgets.length}
                        </Chip>
                      </div>
                    }
                  />
                </Tabs>
                <Button
                  size="sm"
                  variant="light"
                  startContent={<Icon icon="solar:eraser-linear" width={14} />}
                  onPress={() =>
                    activeTab === "kpi"
                      ? setSelectedKpis([])
                      : setSelectedWidgets([])
                  }
                >
                  Clear
                </Button>
              </div>

              <div className="flex gap-4 h-[450px]">
                {/* Left: Items selection with 2 per row (70%) */}
                <MemoizedVirtualizedItemSelector
                  style={{ flex: "0 0 70%" }}
                  items={displayItems}
                  selectedIds={
                    activeTab === "kpi" ? selectedKpis : selectedWidgets
                  }
                  onItemToggle={
                    activeTab === "kpi" ? handleKPIToggle : handleWidgetToggle
                  }
                />

                {/* Right: Selected Items with Position Control (30%) */}
                <MemoizedSelectedItemsList
                  style={{ flex: "0 0 30%" }}
                  items={activeTab === "kpi" ? selectedKpis : selectedWidgets}
                  type={activeTab}
                  onItemRemove={handleItemRemove}
                  onItemsReorder={handleItemsReorder}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleApply}>
                Apply Changes
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
