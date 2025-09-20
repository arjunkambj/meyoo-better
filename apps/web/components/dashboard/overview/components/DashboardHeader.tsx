"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnalyticsHeader } from "@/components/shared/AnalyticsHeader";
import GlobalDateRangePicker from "@/components/shared/GlobalDateRangePicker";
import React from "react";

interface DashboardHeaderProps {
  onCustomize: () => void;
}

export function DashboardHeader({ onCustomize }: DashboardHeaderProps) {
  return (
    <AnalyticsHeader
      leftActions={<GlobalDateRangePicker />}
      rightActions={
        <div className="flex items-center gap-2">
          <Button
            color="primary"
            startContent={<Icon icon="solar:settings-linear" width={20} />}
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
