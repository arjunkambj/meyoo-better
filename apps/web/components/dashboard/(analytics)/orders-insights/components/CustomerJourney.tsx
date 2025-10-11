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
  metaConversionRate?: number;
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
    Awareness: "Meta ad impressions introducing shoppers to your brand",
    Interest: "Total clicks generated from paid campaigns",
    Consideration:
      "Shoppers weighing a purchase (customers + active cart abandoners)",
    Purchase: "Customers who completed an order",
    Retention: "Returning customers who purchased again",
  };

  const journeyData = data ?? [];
  const hasJourneyData = journeyData.length > 0;

  const awarenessStage = journeyData.find(
    (stage) => stage.stage.toLowerCase() === "awareness",
  );
  const interestStage = journeyData.find(
    (stage) => stage.stage.toLowerCase() === "interest",
  );
  const purchaseStage = journeyData.find(
    (stage) => stage.stage.toLowerCase() === "purchase"
  );
  const retentionStage = journeyData.find(
    (stage) => stage.stage.toLowerCase() === "retention"
  );

  const visitorCount = interestStage?.customers ?? awarenessStage?.customers ?? 0;
  const safeVisitors = Number.isFinite(visitorCount) ? visitorCount : 0;
  const metaConversionRateValue = Number.isFinite(
    interestStage?.metaConversionRate ?? NaN,
  )
    ? (interestStage?.metaConversionRate ?? 0)
    : 0;

  const formatPercentValue = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);

  const safeCancelRate = Number.isFinite(cancelRate) ? cancelRate : 0;
  const safeReturnRate = Number.isFinite(returnRate) ? returnRate : 0;

  return (
    <Card className="p-6 rounded-2xl border border-default-100/60 bg-content2 dark:bg-content1 shadow-none backdrop-blur-sm">
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
            {formatNumber(safeVisitors)}
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
                  <div className="relative z-10 rounded-xl border border-default-100/70 bg-background p-4">
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
                          content={
                            stageDescriptions[stage.stage] || stage.stage
                          }
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
                          {formatPercentValue(stage.conversionRate)}%
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
              {formatPercentValue(
                retentionStage?.conversionRate ?? purchaseStage?.conversionRate ?? 0,
              )}
              %
            </p>
            <p className="text-xs text-default-500 mt-1">
              From awareness to purchase
            </p>
          </div>
          <div className="rounded-xl p-4 border bg-background border-default-50">
            <p className="text-xs font-medium text-default-600 mb-2">
              Meta Conversion
            </p>
            <p className="text-xl font-semibold text-default-900">
              {formatPercentValue(metaConversionRateValue)}%
            </p>
            <p className="text-xs text-default-500 mt-1">
              Landing page conversion from ads
            </p>
          </div>
          <div className="rounded-xl p-4 border bg-background border-default-50">
            <p className="text-xs font-medium text-default-600 mb-2">
              Cancel Rate
            </p>
            <p className="text-xl font-semibold text-default-900">
              {formatPercentValue(safeCancelRate)}%
            </p>
            <p className="text-xs text-default-500 mt-1">
              Orders cancelled before fulfillment
            </p>
          </div>
          <div className="rounded-xl p-4 border bg-background border-default-50">
            <p className="text-xs font-medium text-default-600 mb-2">
              Return / RTO Rate
            </p>
            <p className="text-xl font-semibold text-default-900">
              {formatPercentValue(safeReturnRate)}%
            </p>
            <p className="text-xs text-default-500 mt-1">
              Deliveries that resulted in returns or RTO
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
});
