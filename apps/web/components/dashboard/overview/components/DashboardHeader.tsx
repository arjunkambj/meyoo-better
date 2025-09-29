"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import { ExportButton } from "@/components/shared/actions/ExportButton";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import React from "react";

interface DashboardHeaderProps {
  onCustomize: () => void;
  exportData?: Record<string, unknown>[] | (() => Promise<Record<string, unknown>[]>);
  onDateRangeChange?: (range: { startDate: string; endDate: string }) => void;
}

export function DashboardHeader({ onCustomize, exportData, onDateRangeChange }: DashboardHeaderProps) {
  return (
    <AnalyticsHeader
      leftActions={<GlobalDateRangePicker onAnalyticsChange={onDateRangeChange} />}
      rightActions={
        <div className="flex items-center gap-2">
          {exportData && (
            <ExportButton
              data={exportData}
              filename="dashboard-overview"
              formats={["csv", "pdf"]}
              color="primary"
              variant="flat"
            />
          )}
          <Button
            color="primary"
            startContent={<Icon icon="solar:widget-bold-duotone" width={18} />}
            variant="solid"
            onPress={onCustomize}
          >
            Customize
          </Button>
        </div>
      }
    />
  );
}
