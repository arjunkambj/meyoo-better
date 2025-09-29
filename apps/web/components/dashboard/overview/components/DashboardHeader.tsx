"use client";

import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { AnalyticsHeader } from '@/components/shared/AnalyticsHeader';
import { ExportButton } from '@/components/shared/actions/ExportButton';
import GlobalDateRangePicker from '@/components/shared/GlobalDateRangePicker';
import type { CalendarDateRange, DateRangePresetKey } from '@/libs/dateRangePresets';
import type { AnalyticsDateRange } from '@repo/types';
import React from 'react';

interface DashboardHeaderProps {
  onCustomize: () => void;
  exportData?: Record<string, unknown>[] | (() => Promise<Record<string, unknown>[]>);
  onDateRangeChange?: (range: AnalyticsDateRange) => void;
  dateRange?: CalendarDateRange;
  datePreset?: DateRangePresetKey | null;
}

export function DashboardHeader({
  onCustomize,
  exportData,
  onDateRangeChange,
  dateRange,
  datePreset,
}: DashboardHeaderProps) {
  return (
    <AnalyticsHeader
      leftActions={
        <GlobalDateRangePicker
          value={dateRange}
          preset={datePreset}
          onAnalyticsChange={onDateRangeChange}
        />
      }
      rightActions={
        <div className="flex items-center gap-2">
          {exportData && (
            <ExportButton
              data={exportData}
              filename="dashboard-overview"
              formats={['csv', 'pdf']}
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
