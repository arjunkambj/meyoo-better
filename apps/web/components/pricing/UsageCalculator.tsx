"use client";

import { Card, CardBody, Chip, Slider } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

import { overagePricing } from "../home/pricing/constants";

export default function UsageCalculator() {
  const [monthlyOrders, setMonthlyOrders] = React.useState(500);

  const calculateCost = (orders: number) => {
    const results = [];

    // Free plan
    if (orders <= 300) {
      results.push({
        plan: "Free",
        baseCost: 0,
        overageCost: 0,
        totalCost: 0,
        isRecommended: true,
      });
    } else {
      results.push({
        plan: "Free",
        baseCost: 0,
        overageCost: 0,
        totalCost: 0,
        isRecommended: false,
        note: "Exceeds limit",
      });
    }

    // Starter plan
    const starterBase = 40;
    const starterIncluded = 1200;
    let starterOverage = 0;

    if (orders > starterIncluded) {
      const extraOrders = orders - starterIncluded;

      starterOverage = Math.min(
        extraOrders * overagePricing.starter.ratePerOrder,
        overagePricing.starter.maxOverageCharge,
      );
    }
    results.push({
      plan: "Starter",
      baseCost: starterBase,
      overageCost: starterOverage,
      totalCost: starterBase + starterOverage,
      isRecommended: orders > 300 && orders <= 1500,
    });

    // Growth plan
    const growthBase = 90;
    const growthIncluded = 3500;
    let growthOverage = 0;

    if (orders > growthIncluded) {
      const extraOrders = orders - growthIncluded;

      growthOverage = Math.min(
        extraOrders * overagePricing.growth.ratePerOrder,
        overagePricing.growth.maxOverageCharge,
      );
    }
    results.push({
      plan: "Growth",
      baseCost: growthBase,
      overageCost: growthOverage,
      totalCost: growthBase + growthOverage,
      isRecommended: orders > 1500 && orders <= 4500,
    });

    // Business plan
    const businessBase = 160;
    const businessIncluded = 7500;
    let businessOverage = 0;

    if (orders > businessIncluded) {
      const extraOrders = orders - businessIncluded;

      businessOverage = Math.min(
        extraOrders * overagePricing.business.ratePerOrder,
        overagePricing.business.maxOverageCharge,
      );
    }
    results.push({
      plan: "Business",
      baseCost: businessBase,
      overageCost: businessOverage,
      totalCost: businessBase + businessOverage,
      isRecommended: orders > 4500,
    });

    return results;
  };

  const costs = calculateCost(monthlyOrders);
  const recommendedPlan = costs.find((c) => c.isRecommended);

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardBody className="p-8">
          {/* Slider Input */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <label
                htmlFor="monthly-orders-input"
                className="text-sm font-medium text-default-700"
              >
                Monthly Orders
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="monthly-orders-input"
                  className="w-24 px-3 py-1 text-sm border border-default-200 rounded-lg focus:outline-none focus:border-primary"
                  type="number"
                  value={monthlyOrders}
                  onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                />
                <span className="text-sm text-default-500">orders/month</span>
              </div>
            </div>
            <Slider
              aria-label="Monthly orders"
              className="max-w-full"
              color="primary"
              marks={[
                { value: 0, label: "0" },
                { value: 300, label: "300" },
                { value: 1200, label: "1.2K" },
                { value: 3500, label: "3.5K" },
                { value: 7500, label: "7.5K" },
                { value: 15000, label: "15K" },
              ]}
              maxValue={15000}
              minValue={0}
              size="sm"
              step={50}
              value={monthlyOrders}
              onChange={(value) => setMonthlyOrders(value as number)}
            />
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {costs.map((cost) => (
              <div
                key={cost.plan}
                className={`relative p-4 rounded-lg border ${
                  cost.isRecommended
                    ? "border-primary bg-primary/5"
                    : cost.note
                      ? "border-danger/30 bg-danger/5 opacity-60"
                      : "border-default-200 bg-default-50"
                }`}
              >
                {cost.isRecommended && (
                  <Chip
                    className="absolute -top-2 right-2"
                    color="primary"
                    size="sm"
                  >
                    Recommended
                  </Chip>
                )}

                <h4 className="font-semibold text-sm mb-3">{cost.plan}</h4>

                {cost.note ? (
                  <p className="text-xs text-danger">{cost.note}</p>
                ) : (
                  <>
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-default-500">Base cost:</span>
                        <span className="font-medium">${cost.baseCost}</span>
                      </div>
                      {cost.overageCost > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-default-500">Overage:</span>
                          <span className="font-medium text-warning">
                            +${cost.overageCost.toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-default-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-default-700">
                          Total:
                        </span>
                        <span className="text-lg font-bold text-foreground">
                          ${cost.totalCost.toFixed(0)}
                        </span>
                      </div>
                      <p className="text-xs text-default-400 mt-1">/month</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Recommendation Message */}
          {recommendedPlan && (
            <div className="mt-6 p-4 bg-success/10 border border-success/30 rounded-lg">
              <div className="flex gap-3">
                <Icon
                  className="text-success shrink-0"
                  icon="solar:verified-check-bold"
                  width={20}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    We recommend the {recommendedPlan.plan} plan
                  </p>
                  <p className="text-xs text-default-600 mt-1">
                    Based on {monthlyOrders.toLocaleString()} monthly orders,
                    you&apos;ll pay ${recommendedPlan.totalCost}/month
                    {recommendedPlan.overageCost > 0 &&
                      ` (includes $${recommendedPlan.overageCost.toFixed(0)} in overages)`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Savings Tip */}
          <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
            <div className="flex gap-3">
              <Icon
                className="text-primary shrink-0"
                icon="solar:dollar-minimalistic-bold"
                width={20}
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Save with yearly billing
                </p>
                <p className="text-xs text-default-600 mt-1">
                  Get 2 months free when you pay annually. That&apos;s $
                  {(recommendedPlan?.baseCost || 0) * 2} in savings per year!
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
