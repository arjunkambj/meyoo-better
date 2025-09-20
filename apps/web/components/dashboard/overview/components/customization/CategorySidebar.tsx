"use client";

import { Button, Chip, ScrollShadow } from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback } from "react";

import { METRIC_CATEGORIES, METRICS } from "../../metrics/registry";

interface CategorySidebarProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategorySidebar = React.memo(function CategorySidebar({
  activeCategory,
  onCategoryChange,
}: CategorySidebarProps) {
  // Memoize category handler
  const handleCategoryChange = useCallback(
    (category: string) => {
      onCategoryChange(category);
    },
    [onCategoryChange],
  );

  return (
    <div className="col-span-3 border-r pr-4 flex flex-col">
      <h3 className="text-sm font-semibold mb-3 text-default-700">
        Categories
      </h3>
      <ScrollShadow hideScrollBar className="h-[400px]" visibility="none">
        <div className="space-y-1">
          {/* All Metrics */}
          <Button
            fullWidth
            className="justify-start"
            size="sm"
            startContent={
              <Icon
                className={activeCategory === "all" ? "text-primary" : "text-default-400"}
                icon="solar:list-bold-duotone"
                width={16}
              />
            }
            variant={activeCategory === "all" ? "flat" : "light"}
            onPress={() => handleCategoryChange("all")}
          >
            <span className="text-left flex-1 text-default-700">All Metrics</span>
            <Chip className="h-5 text-xs" size="sm" variant="flat">
              {Object.keys(METRICS).length}
            </Chip>
          </Button>

          {Object.values(METRIC_CATEGORIES).map((category) => {
            const isActive = activeCategory === category.id;
            const count = Object.values(METRICS).filter(
              (m) => m.category === category.id,
            ).length;

            return (
              <Button
                key={category.id}
                fullWidth
                className="justify-start"
                size="sm"
                startContent={
                  <Icon
                    className={isActive ? "text-primary" : "text-default-400"}
                    icon={category.icon}
                    width={16}
                  />
                }
                variant={isActive ? "flat" : "light"}
                onPress={() => handleCategoryChange(category.id)}
              >
                <span className="text-left flex-1 text-default-700">
                  {category.name}
                </span>
                <Chip className="h-5 text-xs" size="sm" variant="flat">
                  {count}
                </Chip>
              </Button>
            );
          })}
        </div>
      </ScrollShadow>
    </div>
  );
});
