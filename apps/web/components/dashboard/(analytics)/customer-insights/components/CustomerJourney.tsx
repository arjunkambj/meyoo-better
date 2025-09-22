"use client";

import { Card, Chip, Progress, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { memo } from "react";

import { formatNumber } from "@/libs/utils/format";

export interface JourneyStage {
  stage: string;
  customers: number;
  percentage: number;
  avgDays: number;
  conversionRate: number;
  icon: string;
  color: string;
  bgColor: string;
  textColor: string;
}

interface CustomerJourneyProps {
  data?: JourneyStage[];
  cancelRate?: number;
  returnRate?: number;
}

export const CustomerJourney = memo(function CustomerJourney({
  data,
  cancelRate = 3.2,
  returnRate = 5.8,
}: CustomerJourneyProps) {
  // D2C-friendly stage descriptions
  const stageDescriptions: Record<string, string> = {
    Awareness:
      "People who discovered your brand through ads, social media, or search",
    Interest:
      "Visitors actively browsing your products and spending time on your site",
    Consideration:
      "Shoppers who added items to cart or wishlist, comparing options",
    Purchase: "Customers who completed their first order with you",
    Retention: "Happy customers who came back and bought again",
  };

  const defaultData: JourneyStage[] = [
    {
      stage: "Awareness",
      customers: 5234,
      percentage: 100,
      avgDays: 0,
      conversionRate: 45,
      icon: "solar:eye-scan-bold-duotone",
      color: "primary",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
    },
    {
      stage: "Interest",
      customers: 2355,
      percentage: 45,
      avgDays: 2,
      conversionRate: 67,
      icon: "solar:heart-shine-bold-duotone",
      color: "secondary",
      bgColor: "bg-secondary/10",
      textColor: "text-secondary",
    },
    {
      stage: "Consideration",
      customers: 1578,
      percentage: 30,
      avgDays: 5,
      conversionRate: 42,
      icon: "solar:cart-large-4-bold-duotone",
      color: "warning",
      bgColor: "bg-warning/10",
      textColor: "text-warning",
    },
    {
      stage: "Purchase",
      customers: 663,
      percentage: 13,
      avgDays: 8,
      conversionRate: 78,
      icon: "solar:bag-check-bold-duotone",
      color: "success",
      bgColor: "bg-success/10",
      textColor: "text-success",
    },
    {
      stage: "Retention",
      customers: 517,
      percentage: 10,
      avgDays: 30,
      conversionRate: 85,
      icon: "solar:refresh-circle-bold-duotone",
      color: "primary",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
    },
  ];

  const journeyData = data || defaultData;

  return (
    <Card className="p-5 border bg-default-50 border-default-200  rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">Customer Journey</h3>
          <p className="text-sm text-default-500 mt-1">
            Conversion funnel and customer lifecycle stages
          </p>
        </div>
        <Chip size="sm" variant="flat">
          {formatNumber(journeyData[0]?.customers ?? 0)} total visitors
        </Chip>
      </div>

      <div className="space-y-6">
        {/* Journey Stages */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {journeyData.map((stage, index) => (
              <div key={stage.stage} className="relative">
                {/* Connecting line with arrow - positioned at middle of icon */}
                {index < journeyData.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] pointer-events-none">
                    <div className="relative">
                      <div className="h-0.5 bg-gradient-to-r from-default-300 to-default-200 w-full" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-1">
                        <Icon
                          className="w-4 h-4 text-default-400"
                          icon="solar:arrow-right-linear"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div
                    className={`p-3 rounded-2xl ${stage.bgColor} mb-3 transition-transform hover:scale-110`}
                  >
                    <Icon
                      className={`w-6 h-6 ${stage.textColor}`}
                      icon={stage.icon}
                    />
                  </div>
                  <Tooltip
                    closeDelay={0}
                    content={stageDescriptions[stage.stage] || stage.stage}
                    placement="top"
                  >
                    <p className="font-semibold text-sm mb-1 cursor-help border-b border-dotted border-divider">
                      {stage.stage}
                    </p>
                  </Tooltip>
                  <p className="text-xs text-default-500 mb-2">
                    {formatNumber(stage.customers)} ({stage.percentage}%)
                  </p>
                  <Chip
                    className="font-medium"
                    color={
                      stage.color as
                        | "primary"
                        | "secondary"
                        | "success"
                        | "warning"
                        | "danger"
                        | "default"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {stage.conversionRate}% CVR
                  </Chip>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-default-100 hover:bg-default-200 border border-default-200/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon
                  className="w-5 h-5 text-primary"
                  icon="solar:chart-square-bold-duotone"
                />
              </div>
              <p className="text-sm font-medium">Overall Conversion</p>
            </div>
            <p className="text-2xl font-bold">
              {(() => {
                const visitors = journeyData[0]?.customers || 0;
                const purchasers = journeyData[3]?.customers || 0;
                if (visitors <= 0) return "0.0%";
                return `${((purchasers / visitors) * 100).toFixed(1)}%`;
              })()}
            </p>
            <p className="text-xs text-default-500 mt-1">Visitor to customer</p>
          </Card>

          <Card className="p-4 bg-default-100 hover:bg-default-200 border border-default-200/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-success/10">
                <Icon
                  className="w-5 h-5 text-success"
                  icon="solar:refresh-bold-duotone"
                />
              </div>
              <p className="text-sm font-medium">Repeat Purchase Rate</p>
            </div>
            <p className="text-2xl font-bold">
              {(() => {
                const purchasers = journeyData[3]?.customers || 0;
                const repeat = journeyData[4]?.customers || 0;
                if (purchasers <= 0) return "0%";
                return `${((repeat / purchasers) * 100).toFixed(0)}%`;
              })()}
            </p>
            <p className="text-xs text-default-500 mt-1">
              Customers who buy again
            </p>
          </Card>

          <Card className="p-4 bg-default-100 hover:bg-default-200 border border-default-200/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-danger/10">
                <Icon
                  className="w-5 h-5 text-danger"
                  icon="solar:close-circle-bold-duotone"
                />
              </div>
              <p className="text-sm font-medium">Cancel Rate</p>
            </div>
            <p className="text-2xl font-bold">{cancelRate.toFixed(1)}%</p>
            <p className="text-xs text-default-500 mt-1">Orders cancelled</p>
          </Card>

          <Card className="p-4 bg-default-100 hover:bg-default-200 border border-default-200/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <Icon
                  className="w-5 h-5 text-warning"
                  icon="solar:rewind-back-bold-duotone"
                />
              </div>
              <p className="text-sm font-medium">Return Rate</p>
            </div>
            <p className="text-2xl font-bold">{returnRate.toFixed(1)}%</p>
            <p className="text-xs text-default-500 mt-1">Products returned</p>
          </Card>
        </div>

        {/* Conversion Breakdown */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Stage-to-Stage Conversion</p>
          {journeyData.slice(0, -1).map((stage, index) => {
            const nextStage = journeyData[index + 1] ?? {
              stage: "",
              customers: 0,
            };
            const conversionRate =
              ((nextStage.customers || 0) / (stage.customers || 1)) * 100;

            return (
              <div key={`${stage.stage}-conversion`} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-default-600">
                    {stage.stage} → {nextStage.stage}
                  </span>
                  <span className="font-medium">
                    {conversionRate.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  color={
                    conversionRate > 50
                      ? "success"
                      : conversionRate > 30
                        ? "warning"
                        : "danger"
                  }
                  size="sm"
                  value={conversionRate}
                />
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
});
