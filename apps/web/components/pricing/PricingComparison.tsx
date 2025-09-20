"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

const features = [
  {
    category: "Core Features",
    items: [
      {
        name: "Real-time profit tracking",
        free: true,
        starter: true,
        growth: true,
        business: true,
      },
      {
        name: "Shopify integration",
        free: true,
        starter: true,
        growth: true,
        business: true,
      },
      {
        name: "Basic dashboard",
        free: true,
        starter: true,
        growth: true,
        business: true,
      },
      {
        name: "Email support",
        free: true,
        starter: true,
        growth: true,
        business: true,
      },
    ],
  },
  {
    category: "Order Limits",
    items: [
      {
        name: "Included orders/month",
        free: "300",
        starter: "1,200",
        growth: "3,500",
        business: "7,500",
      },
      {
        name: "Overage rate",
        free: "N/A",
        starter: "$0.20",
        growth: "$0.10",
        business: "$0.05",
      },
      {
        name: "Max overage charge",
        free: "N/A",
        starter: "$299",
        growth: "$399",
        business: "$499",
      },
    ],
  },
  {
    category: "Marketing & Analytics",
    items: [
      {
        name: "Marketing channels",
        free: "1",
        starter: "All",
        growth: "All",
        business: "All",
      },
      {
        name: "Advanced analytics",
        free: false,
        starter: true,
        growth: true,
        business: true,
      },
      {
        name: "Custom reports",
        free: false,
        starter: false,
        growth: true,
        business: true,
      },
      {
        name: "AI-powered insights",
        free: false,
        starter: false,
        growth: false,
        business: true,
      },
      {
        name: "Predictive analytics",
        free: false,
        starter: false,
        growth: false,
        business: true,
      },
    ],
  },
  {
    category: "Team & Collaboration",
    items: [
      {
        name: "Free team members",
        free: "3",
        starter: "3",
        growth: "5",
        business: "10",
      },
      {
        name: "Additional team members",
        free: "$10/mo",
        starter: "$10/mo",
        growth: "$10/mo",
        business: "$10/mo",
      },
      {
        name: "Role-based permissions",
        free: false,
        starter: true,
        growth: true,
        business: true,
      },
      {
        name: "Activity logs",
        free: false,
        starter: false,
        growth: true,
        business: true,
      },
    ],
  },
  {
    category: "Support & Success",
    items: [
      {
        name: "Email support",
        free: true,
        starter: true,
        growth: true,
        business: true,
      },
      {
        name: "Priority support",
        free: false,
        starter: false,
        growth: true,
        business: true,
      },
      {
        name: "Dedicated success manager",
        free: false,
        starter: false,
        growth: false,
        business: true,
      },
      {
        name: "Onboarding assistance",
        free: false,
        starter: false,
        growth: true,
        business: true,
      },
    ],
  },
  {
    category: "Data & Integrations",
    items: [
      {
        name: "Data retention",
        free: "30 days",
        starter: "90 days",
        growth: "1 year",
        business: "Unlimited",
      },
      {
        name: "API access",
        free: false,
        starter: false,
        growth: true,
        business: true,
      },
      {
        name: "Webhook support",
        free: true,
        starter: true,
        growth: true,
        business: true,
      },
      {
        name: "Export data",
        free: "CSV",
        starter: "CSV, Excel",
        growth: "CSV, Excel, API",
        business: "All formats",
      },
    ],
  },
];

export default function PricingComparison() {
  const renderValue = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Icon
          className="text-success"
          icon="solar:check-circle-bold"
          width={20}
        />
      ) : (
        <Icon
          className="text-default-300"
          icon="solar:close-circle-linear"
          width={20}
        />
      );
    }

    return <span className="text-sm font-medium">{value}</span>;
  };

  return (
    <Card>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-default-200">
                <th className="text-left p-6 min-w-[250px]">
                  <span className="text-sm font-semibold text-default-700">
                    Features
                  </span>
                </th>
                <th className="text-center p-6 min-w-[120px]">
                  <div>
                    <p className="text-sm font-semibold">Free</p>
                    <p className="text-xs text-default-500 mt-1">$0/mo</p>
                  </div>
                </th>
                <th className="text-center p-6 min-w-[120px]">
                  <div>
                    <p className="text-sm font-semibold">Starter</p>
                    <p className="text-xs text-default-500 mt-1">$40/mo</p>
                  </div>
                </th>
                <th className="text-center p-6 min-w-[120px] bg-primary/5">
                  <div>
                    <p className="text-sm font-semibold text-primary">Growth</p>
                    <p className="text-xs text-primary/70 mt-1">$90/mo</p>
                    <p className="text-xs text-primary mt-1 font-medium">
                      Popular
                    </p>
                  </div>
                </th>
                <th className="text-center p-6 min-w-[120px]">
                  <div>
                    <p className="text-sm font-semibold">Business</p>
                    <p className="text-xs text-default-500 mt-1">$160/mo</p>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((category, categoryIndex) => (
                <React.Fragment
                  key={`category-${category.category}-${categoryIndex}`}
                >
                  <tr className="bg-default-50">
                    <td className="px-6 py-3" colSpan={5}>
                      <p className="text-sm font-semibold text-default-700">
                        {category.category}
                      </p>
                    </td>
                  </tr>
                  {category.items.map((item, itemIndex) => (
                    <tr
                      key={`feature-${item.name}-${itemIndex}`}
                      className="border-b border-default-100 hover:bg-default-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm text-default-700">
                          {item.name}
                        </span>
                      </td>
                      <td className="text-center px-6 py-4">
                        {renderValue(item.free)}
                      </td>
                      <td className="text-center px-6 py-4">
                        {renderValue(item.starter)}
                      </td>
                      <td className="text-center px-6 py-4 bg-primary/5">
                        {renderValue(item.growth)}
                      </td>
                      <td className="text-center px-6 py-4">
                        {renderValue(item.business)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
