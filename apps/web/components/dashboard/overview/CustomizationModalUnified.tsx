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
import { CategorySidebar } from "./components/customization/CategorySidebar";
import { SelectedItemsList } from "./components/customization/SelectedItemsList";
import { VirtualizedItemSelector } from "./components/customization/VirtualizedItemSelector";
import { METRICS, METRIC_CATEGORIES } from "./metrics/registry";
import { getAllWidgets } from "./widgets/registry";

// Memoized components for better performance
const MemoizedCategorySidebar = React.memo(CategorySidebar);
const MemoizedVirtualizedItemSelector = React.memo(VirtualizedItemSelector);
const MemoizedSelectedItemsList = React.memo(SelectedItemsList);

interface CustomizationModalUnifiedProps {
  isOpen: boolean;
  onClose: () => void;
  zone1Items: string[]; // KPI metric IDs
  zone2Items: string[]; // Widget IDs
  onApply: (zone1Items: string[], zone2Items: string[]) => void;
}

export function CustomizationModalUnified({
  isOpen,
  onClose,
  zone1Items: initialZone1,
  zone2Items: initialZone2,
  onApply,
}: CustomizationModalUnifiedProps) {
  // Home Dashboard preset (kpi.md)
  const HOME_DASHBOARD_PRESET = useMemo(
    () => [
      "netProfit",
      "revenue",
      "netProfitMargin",
      "orders",
      "avgOrderValue",
      "blendedRoas", // MER
      "totalAdSpend",
      "shopifyConversionRate",
      "repeatCustomerRate",
      "moMRevenueGrowth",
    ],
    [],
  );
  const [activeTab, setActiveTab] = useState<"kpi" | "widget">("kpi");
  const [zone1Items, setZone1Items] = useState<string[]>(initialZone1);
  const [zone2Items, setZone2Items] = useState<string[]>(initialZone2);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("coreKPIs");
  const [_isPending, startTransition] = useTransition();

  // Memoize all metrics and widgets to avoid recalculation
  const allMetrics = useMemo(() => Object.values(METRICS), []);
  const allWidgets = useMemo(() => getAllWidgets(), []);

  // Get items based on active tab (supports grouped KPI view when selecting All)
  const displayItems = useMemo(() => {
    if (activeTab === "kpi") {
      const searchLower = searchQuery.toLowerCase();

      // When searching, search across all metrics to avoid confusion
      if (searchQuery) {
        return allMetrics.filter(
          (metric) =>
            metric.label.toLowerCase().includes(searchLower) ||
            metric.id.toLowerCase().includes(searchLower),
        );
      }

      // Special case: "All KPIs" shows grouped list with section headers
      if (activeCategory === "all") {
        const entries: Array<
          (typeof allMetrics)[number] | { type: "section"; id: string; label: string; icon: string }
        > = [];
        // Render each canonical category in order; include only metrics whose
        // canonical category matches (from METRICS schema). This avoids duplicates
        // when a metric ID is listed in multiple category.metrics arrays.
        for (const category of Object.values(METRIC_CATEGORIES)) {
          const metricsInCategory = allMetrics.filter(
            (m) => m.category === category.id,
          );
          if (metricsInCategory.length === 0) continue;

          // Section header
          entries.push({
            type: "section",
            id: `section-${category.id}`,
            label: category.name,
            icon: category.icon,
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
            .forEach((def) => entries.push(def));
        }
        return entries;
      }

      // Default: filter by selected category
      return allMetrics.filter((metric) => metric.category === activeCategory);
    } else {
      // Show widgets for Widget tab (flat list)
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();

        return allWidgets.filter(
          (widget) =>
            widget.name.toLowerCase().includes(searchLower) ||
            widget.description.toLowerCase().includes(searchLower),
        );
      }

      return allWidgets;
    }
  }, [activeTab, activeCategory, searchQuery, allMetrics, allWidgets]);

  // no-op

  const handleKPIToggle = useCallback((metricId: string, checked: boolean) => {
    if (checked) {
      setZone1Items((prev) =>
        prev.includes(metricId) ? prev : [...prev, metricId],
      );
    } else {
      setZone1Items((prev) => prev.filter((id) => id !== metricId));
    }
  }, []);

  const handleWidgetToggle = useCallback(
    (widgetId: string, checked: boolean) => {
      if (checked) {
        setZone2Items((prev) =>
          prev.includes(widgetId) ? prev : [...prev, widgetId],
        );
      } else {
        setZone2Items((prev) => prev.filter((id) => id !== widgetId));
      }
    },
    [],
  );

  const handleApply = useCallback(() => {
    onApply(zone1Items, zone2Items);
    onClose();
  }, [zone1Items, zone2Items, onApply, onClose]);

  const handleCategoryChange = useCallback((category: string) => {
    startTransition(() => {
      setActiveCategory(category);
      setSearchQuery("");
    });
  }, []);

  const handleItemRemove = useCallback(
    (id: string) => {
      if (activeTab === "kpi") {
        setZone1Items((prev) => prev.filter((i) => i !== id));
      } else {
        setZone2Items((prev) => prev.filter((i) => i !== id));
      }
    },
    [activeTab],
  );

  const handleItemsReorder = useCallback(
    (items: string[]) => {
      if (activeTab === "kpi") {
        setZone1Items(items);
      } else {
        setZone2Items(items);
      }
    },
    [activeTab],
  );

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="4xl" onClose={onClose}>
      <ModalContent className="max-h-[85vh]">
        {(onClose) => (
          <>
            <ModalHeader className="pb-3 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-default-800">
                  Customize Dashboard
                </h2>
                <p className="text-xs text-default-500 mt-1">
                  Configure your dashboard KPIs and widgets
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="p-4 overflow-hidden flex flex-col bg-default-50 gap-6">
              {activeTab === "kpi" && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-xs text-default-500">
                    <Icon className="text-default-400" icon="solar:document-linear" width={14} />
                    <span>Aligned to Home Dashboard (10) from kpi.md</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Icon icon="solar:stars-bold-duotone" width={14} />}
                      onPress={() => setZone1Items(HOME_DASHBOARD_PRESET)}
                    >
                      Use Home Dashboard (10)
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      startContent={<Icon icon="solar:eraser-linear" width={14} />}
                      onPress={() => setZone1Items([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              {/* Tabs for KPI Cards and Widgets */}
              <Tabs
                aria-label="Customization tabs"
                className="mb-4"
                selectedKey={activeTab}
                onSelectionChange={(key) => {
                  startTransition(() => {
                    setActiveTab(key as "kpi" | "widget");
                    setSearchQuery("");
                    setActiveCategory("coreKPIs");
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
                        {zone1Items.length}
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
                        {zone2Items.length}
                      </Chip>
                    </div>
                  }
                />
              </Tabs>

              <div className="grid grid-cols-12 gap-4 h-[450px]">
                {/* Left: Categories (only for KPIs) */}
                {activeTab === "kpi" && (
                  <MemoizedCategorySidebar
                    activeCategory={activeCategory}
                    onCategoryChange={handleCategoryChange}
                  />
                )}

                {/* Middle: Search & Selection - Only render active tab content */}
                {activeTab === "kpi" ? (
                  <MemoizedVirtualizedItemSelector
                    className="col-span-5"
                    items={displayItems}
                    placeholder="Search metrics..."
                    searchQuery={searchQuery}
                    selectedIds={zone1Items}
                    onItemToggle={handleKPIToggle}
                    onSearchChange={setSearchQuery}
                  />
                ) : (
                  <MemoizedVirtualizedItemSelector
                    className="col-span-8"
                    items={displayItems}
                    placeholder="Search widgets..."
                    searchQuery={searchQuery}
                    selectedIds={zone2Items}
                    onItemToggle={handleWidgetToggle}
                    onSearchChange={setSearchQuery}
                  />
                )}

                {/* Right: Selected Items with Position Control */}
                <MemoizedSelectedItemsList
                  items={activeTab === "kpi" ? zone1Items : zone2Items}
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
