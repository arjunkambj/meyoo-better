"use client";

import {
  Button,
  Chip,
  Input,
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
import { DEFAULT_DASHBOARD_CONFIG } from "@repo/types";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [_isPending, startTransition] = useTransition();

  // Memoize all metrics and widgets to avoid recalculation
  const allMetrics = useMemo(() => Object.values(METRICS), []);
  const allWidgets = useMemo(() => getAllWidgets(), []);

  // Filter items based on search query
  const filteredMetrics = useMemo(() => {
    if (!searchQuery.trim()) return allMetrics;
    const query = searchQuery.toLowerCase();
    return allMetrics.filter(
      (m) =>
        m.label.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query)
    );
  }, [allMetrics, searchQuery]);

  const filteredWidgets = useMemo(() => {
    if (!searchQuery.trim()) return allWidgets;
    const query = searchQuery.toLowerCase();
    return allWidgets.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.description?.toLowerCase().includes(query)
    );
  }, [allWidgets, searchQuery]);

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
        const metricsInCategory = filteredMetrics.filter(
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
      return filteredWidgets;
    }
  }, [activeTab, filteredMetrics, filteredWidgets]);

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

  const handleSelectAll = useCallback(() => {
    if (activeTab === "kpi") {
      const allIds = filteredMetrics.map((m) => m.id);
      setSelectedKpis((prev) => [...new Set([...prev, ...allIds])]);
    } else {
      const allIds = filteredWidgets.map((w) => w.id);
      setSelectedWidgets((prev) => [...new Set([...prev, ...allIds])]);
    }
  }, [activeTab, filteredMetrics, filteredWidgets]);

  const handleDeselectAll = useCallback(() => {
    if (activeTab === "kpi") {
      const idsToRemove = new Set(filteredMetrics.map((m) => m.id));
      setSelectedKpis((prev) => prev.filter((id) => !idsToRemove.has(id)));
    } else {
      const idsToRemove = new Set(filteredWidgets.map((w) => w.id));
      setSelectedWidgets((prev) => prev.filter((id) => !idsToRemove.has(id)));
    }
  }, [activeTab, filteredMetrics, filteredWidgets]);

  const handleResetToDefault = useCallback(() => {
    if (activeTab === "kpi") {
      setSelectedKpis([...DEFAULT_DASHBOARD_CONFIG.kpis]);
    } else {
      setSelectedWidgets([...DEFAULT_DASHBOARD_CONFIG.widgets]);
    }
  }, [activeTab]);

  // Calculate counts
  const totalCount = useMemo(
    () => (activeTab === "kpi" ? allMetrics.length : allWidgets.length),
    [activeTab, allMetrics.length, allWidgets.length]
  );

  const selectedCount = useMemo(
    () => (activeTab === "kpi" ? selectedKpis.length : selectedWidgets.length),
    [activeTab, selectedKpis.length, selectedWidgets.length]
  );

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="4xl" onClose={onClose}>
      <ModalContent className="max-h-[85vh] rounded-2xl bg-background border border-default-100">
        {(onClose) => (
          <>
            <ModalHeader className="px-6 pt-6 pb-3 bg-background flex-shrink-0 rounded-t-2xl">
              <div className="w-full">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-bold text-default-900">
                      Customize Dashboard
                    </h2>
                    <p className="text-xs text-default-500 mt-1">
                      Select and organize{" "}
                      {activeTab === "kpi" ? "KPI metrics" : "widgets"} for your
                      dashboard
                    </p>
                  </div>
                  <Chip size="sm" variant="flat" color="default">
                    {selectedCount} of {totalCount} selected
                  </Chip>
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="px-6 pb-6 pt-4 overflow-hidden flex flex-col bg-background gap-6">
              {/* Tabs */}
              <Tabs
                aria-label="Customization tabs"
                selectedKey={activeTab}
                onSelectionChange={(key) => {
                  startTransition(() => {
                    setActiveTab(key as "kpi" | "widget");
                    setSearchQuery(""); // Clear search on tab change
                  });
                }}
                classNames={{
                  tabList:
                    "border border-default-100 rounded-xl p-1 bg-default-100",
                  tab: "px-4 py-2 rounded-lg transition-colors data-[selected=true]:bg-background",
                  tabContent:
                    "text-default-600 group-data-[selected=true]:text-primary",
                }}
              >
                <Tab
                  key="kpi"
                  title={
                    <div className="flex items-center gap-1.5">
                      <Icon icon="solar:graph-bold-duotone" width={14} />
                      <span className="text-sm">KPI Cards</span>
                      <Chip className="h-5 text-xs" color="primary" size="sm">
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
                      <Chip className="h-5 text-xs" color="primary" size="sm">
                        {selectedWidgets.length}
                      </Chip>
                    </div>
                  }
                />
              </Tabs>

              {/* Search and action buttons */}
              <div className="flex gap-2">
                <Input
                  size="sm"
                  placeholder={`Search ${activeTab === "kpi" ? "metrics" : "widgets"}...`}
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  startContent={
                    <Icon
                      icon="solar:magnifer-linear"
                      width={16}
                      className="text-default-400"
                    />
                  }
                  isClearable
                  onClear={() => setSearchQuery("")}
                  classNames={{
                    input: "text-sm",
                    inputWrapper: "h-8",
                  }}
                />
                <Button
                  size="sm"
                  variant="flat"
                  onPress={handleSelectAll}
                  className="flex-shrink-0"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={handleDeselectAll}
                  className="flex-shrink-0"
                >
                  Deselect All
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  startContent={<Icon icon="solar:restart-linear" width={14} />}
                  onPress={handleResetToDefault}
                  className="flex-shrink-0"
                >
                  Reset
                </Button>
              </div>

              <div className="flex gap-4 h-[450px]">
                <div className="flex-1 min-w-0">
                  <MemoizedVirtualizedItemSelector
                    style={{ width: "100%" }}
                    items={displayItems}
                    selectedIds={
                      activeTab === "kpi" ? selectedKpis : selectedWidgets
                    }
                    onItemToggle={
                      activeTab === "kpi" ? handleKPIToggle : handleWidgetToggle
                    }
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <MemoizedSelectedItemsList
                    style={{ width: "100%" }}
                    items={activeTab === "kpi" ? selectedKpis : selectedWidgets}
                    type={activeTab}
                    onItemRemove={handleItemRemove}
                    onItemsReorder={handleItemsReorder}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="px-6 py-4 bg-background rounded-b-2xl">
              <Button variant="flat" onPress={onClose}>
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
