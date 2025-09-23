"use client";

import { Card, Tooltip } from "@heroui/react";
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
  cancelRate = 0,
  returnRate = 0,
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

  const journeyData = data ?? [];
  const hasJourneyData = journeyData.length > 0;

  const firstStage = hasJourneyData ? journeyData[0] : undefined;
  const purchaseStage = journeyData.find(
    (stage) => stage.stage.toLowerCase() === "purchase",
  );
  const retentionStage = journeyData.find(
    (stage) => stage.stage.toLowerCase() === "retention",
  );

  const safeCancelRate = Number.isFinite(cancelRate) ? cancelRate : 0;
  const safeReturnRate = Number.isFinite(returnRate) ? returnRate : 0;

  return (
    <Card className="p-6 rounded-2xl border border-default-100/60 bg-content2/90 dark:bg-content1 shadow-none backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-default-900">
            Customer Journey
          </h3>
          <p className="text-sm text-default-500 mt-0.5">
            Track customer progression through your sales funnel
          </p>
        </div>
        <div className="text-sm bg-background border border-default-50 rounded-full px-4 py-2 text-default-600">
          <span className="font-medium">
            {formatNumber(firstStage?.customers ?? 0)}
          </span>
          <span className="text-default-400 ml-1">visitors</span>
        </div>
      </div>

      <div className="space-y-8">
        {/* Journey Stages */}
        <div className="relative">
          {hasJourneyData ? (
            <div className="grid grid-cols-1 md:grid-cols-2  lg:grid-cols-5 gap-3">
              {journeyData.map((stage, index) => (
                <div key={stage.stage} className="relative">
                  {/* Simple connecting line */}
                  {index < journeyData.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-[calc(100%-1rem)] w-8 pointer-events-none z-0">
                      <div className="h-px bg-default-100 w-full" />
                    </div>
                  )}
                  <div className="relative z-10 rounded-xl border border-default-100/70 bg-background border-default-50 p-4">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${stage.bgColor}`}
                      >
                        <Icon
                          className={`w-5 h-5 ${stage.textColor}`}
                          icon={stage.icon}
                        />
                      </div>
                      <div>
                        <Tooltip
                          closeDelay={0}
                          content={stageDescriptions[stage.stage] || stage.stage}
                          placement="top"
                        >
                          <p className="font-medium text-sm text-default-900 mb-1">
                            {stage.stage}
                          </p>
                        </Tooltip>
                        <p className="text-xs text-default-500">
                          {formatNumber(stage.customers)}
                        </p>
                      </div>
                      <div className="w-full pt-2 border-t border-default-100/70">
                        <p className="text-xs text-default-400 mb-1">
                          Conversion
                        </p>
                        <p className="text-sm font-medium text-default-700">
                          {stage.conversionRate}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-default-100/70 bg-background p-6 text-center text-sm text-default-500">
              No customer journey data is available for the selected period yet.
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 border bg-background border-default-50">
            <p className="text-xs font-medium text-default-600 mb-2">
              Overall Conversion
            </p>
            <p className="text-xl font-semibold text-default-900">
              {(() => {
                const visitors = firstStage?.customers || 0;
                const purchasers = purchaseStage?.customers || 0;
                if (visitors <= 0 || purchasers <= 0) return "0.0%";
                return `${((purchasers / visitors) * 100).toFixed(1)}%`;
              })()}
            </p>
            <p className="text-xs text-default-400 mt-1">Visitor to customer</p>
          </div>
          <div className="rounded-xl p-4 border bg-background border-default-50">
            <p className="text-xs font-medium text-default-600 mb-2">
              Repeat Rate
            </p>
            <p className="text-xl font-semibold text-default-900">
              {(() => {
                const purchasers = purchaseStage?.customers || 0;
                const repeat = retentionStage?.customers || 0;
                if (purchasers <= 0) return "0%";
                return `${((repeat / purchasers) * 100).toFixed(0)}%`;
              })()}
            </p>
            <p className="text-xs text-default-400 mt-1">Buy again</p>
          </div>

          <div className="rounded-xl p-4 border bg-background border-default-50">
            <p className="text-xs font-medium text-default-600 mb-2">
              Cancel Rate
            </p>
            <p className="text-xl font-semibold text-default-900">
              {safeCancelRate.toFixed(1)}%
            </p>
            <p className="text-xs text-default-400 mt-1">Orders cancelled</p>
          </div>
          <div className="rounded-xl p-4 border bg-background border-default-50">
            <p className="text-xs font-medium text-default-600 mb-2">
              Return Rate
            </p>
            <p className="text-xl font-semibold text-default-900">
              {safeReturnRate.toFixed(1)}%
            </p>
            <p className="text-xs text-default-400 mt-1">Products returned</p>
          </div>
        </div>

        {/* Conversion Breakdown */}
        <div className="rounded-xl p-5 border bg-background border-default-50">
          <p className="text-sm font-medium text-default-900 mb-4">
            Stage Progression
          </p>
          {hasJourneyData ? (
            <div className="space-y-3">
              {journeyData.slice(0, -1).map((stage, index) => {
                const nextStage = journeyData[index + 1] ?? {
                  stage: "",
                  customers: 0,
                };
                const conversionRate =
                  ((nextStage.customers || 0) / (stage.customers || 1)) * 100;

                // Simple color based on conversion rate
                const getProgressBarClass = () => {
                  if (conversionRate >= 70) return "bg-success";
                  if (conversionRate >= 50) return "bg-primary";
                  if (conversionRate >= 30) return "bg-warning";
                  return "bg-danger";
                };

                return (
                  <div key={`${stage.stage}-conversion`}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-default-600">
                        {stage.stage} → {nextStage.stage}
                      </span>
                      <span className="font-medium text-default-900">
                        {conversionRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-default-200/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressBarClass()}`}
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(conversionRate, 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-default-500">
              We need more customer activity to show stage-by-stage conversions.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
});
