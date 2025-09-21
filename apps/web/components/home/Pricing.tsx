"use client";

import { BadgeCheck } from "lucide-react";
import React, { useState } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Switch,
} from "@heroui/react";

const PRICING_PLANS = [
  {
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    period: {
      monthly: "Per month/store",
      yearly: "Per year/store",
    },
    description: {
      monthly: "Perfect for testing Meyoo.",
      yearly: "Perfect for testing Meyoo.",
    },
    buttonText: "Start for Free",
    highlighted: false,
    features: [
      "Up to 300 orders/month",
      "Basic Profit Dashboard",
      "1 Marketing Channel",
      "$10 Per Extra Seat (AI included)",
      "Email Support",
      "Real-time Shopify sync",
      "$0.30 per extra order",
    ],
  },
  {
    name: "Starter",
    monthlyPrice: "$40",
    yearlyPrice: "$399",
    period: {
      monthly: "Per month/store",
      yearly: "Per year/store",
    },
    description: {
      monthly: "Perfect for growing stores.",
      yearly: "Perfect for growing stores.",
    },
    buttonText: "Get Started",
    highlighted: false,
    features: [
      "Up to 1,200 orders/month",
      "Custom Profit Dashboard",
      "All Marketing Channels",
      "3 Free Team Members",
      "Email Support",
      "$0.20 Per Extra Order",
      "Max $299 Overage Charge",
    ],
  },
  {
    name: "Growth",
    monthlyPrice: "$90",
    yearlyPrice: "$899",
    period: {
      monthly: "Per month/store",
      yearly: "Per year/store",
    },
    description: {
      monthly: "Most popular choice.",
      yearly: "Most popular choice.",
    },
    buttonText: "Get Started",
    highlighted: true,
    features: [
      "Up to 3,500 orders/month",
      "Advanced Analytics",
      "All Marketing Channels",
      "5 Free Team Members",
      "Email Support",
      "$0.10 Per Extra Order",
      "Max $399 Overage Charge",
    ],
  },
  {
    name: "Business",
    monthlyPrice: "$160",
    yearlyPrice: "$1,599",
    period: {
      monthly: "Per month/store",
      yearly: "Per year/store",
    },
    description: {
      monthly: "For high-volume stores.  ",
      yearly: "For high-volume stores.",
    },
    buttonText: "Get Started",
    highlighted: false,
    features: [
      "Up to 7,500 orders/month",
      "AI-powered Insights",
      "All Marketing Channels",
      "10 Free Team Members",
      "$0.05 Per Extra Order",
      "Max $499 Overage Charge",
      "Priority Support",
    ],
  },
];

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState("monthly");

  return (
    <section className="bg-background py-32">
      <div className="container mx-auto flex flex-col gap-13">
        <h1 className="text-center text-6xl font-bold tracking-tighter text-foreground">
          Simple Pricing Plans
        </h1>

        <div className="flex justify-center items-center gap-4">
          <span className="text-sm text-muted-foreground">Monthly</span>
          <Switch
            isSelected={billingCycle === "yearly"}
            onValueChange={(isSelected) => {
              setBillingCycle(isSelected ? "yearly" : "monthly");
            }}
            size="sm"
          />
          <span className="text-sm text-muted-foreground">Yearly</span>
        </div>

        {/* Pricing Cards */}
        <div className="flex justify-center items-stretch gap-6">
          {PRICING_PLANS.map((plan, index) => (
            <Card
              key={index}
              className={`w-80 h-full rounded-3xl px-4 py-3 border ${
                plan.highlighted ? "border-2 border-primary" : "border-border"
              } `}
            >
              <CardHeader className="flex flex-col items-start">
                <h3 className="text-lg font-medium text-foreground">
                  {plan.name}
                </h3>
                <div className="mt-4">
                  <div className="text-5xl font-semibold tracking-tight text-foreground/90">
                    {billingCycle === "monthly"
                      ? plan.monthlyPrice
                      : plan.yearlyPrice}
                  </div>
                  <div className="text-xs ">
                    {billingCycle === "monthly"
                      ? plan.period.monthly
                      : plan.period.yearly}
                  </div>
                </div>
              </CardHeader>

              <CardBody className="px-3 pt-2 flex flex-col justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {billingCycle === "monthly"
                      ? plan.description.monthly
                      : plan.description.yearly}
                  </p>

                  <Button color="primary" className="mt-3 w-full">
                    {plan.buttonText}
                  </Button>

                  <Divider className="my-4" />

                  <ul className="space-y-4">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center">
                        <BadgeCheck className="size-5 text-muted-foreground" />
                        <span className="ml-3 text-sm text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export { Pricing };
