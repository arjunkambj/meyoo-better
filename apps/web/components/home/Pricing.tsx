"use client";

import { BadgeCheck } from "lucide-react";
import React, { useMemo, useState } from "react";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Switch,
} from "@heroui/react";

import { frequencies, tiers } from "./pricing/constants";
import { type Frequency, FrequencyEnum, TiersEnum } from "./pricing/types";

const showcasedTiers = tiers.filter(
  (tier) => tier.key !== TiersEnum.Enterprise
);

const Pricing = () => {
  const defaultFrequency = frequencies[0];

  if (!defaultFrequency) {
    throw new Error("No pricing frequencies configured");
  }

  const [billingCycle, setBillingCycle] = useState<FrequencyEnum>(
    FrequencyEnum.Monthly
  );

  const selectedFrequency = useMemo<Frequency>(
    () =>
      frequencies.find((frequency) => frequency.key === billingCycle) ??
      defaultFrequency,
    [billingCycle, defaultFrequency]
  );

  return (
    <section
      id="pricing"
      className="bg-background py-16 sm:py-24 lg:py-32 scroll-mt-24"
    >
      <div className="container mx-auto flex flex-col gap-8 sm:gap-10 md:gap-13 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center">
          <p className="text-center mb-3 text-primary">Pricing</p>
          <h1 className="text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-foreground">
            Simple Pricing Plans
          </h1>
        </div>

        <div className="flex items-center justify-center gap-4">
          <span className="text-sm text-muted-foreground">Monthly</span>
          <Switch
            isSelected={billingCycle === FrequencyEnum.Yearly}
            onValueChange={(isSelected) => {
              setBillingCycle(
                isSelected ? FrequencyEnum.Yearly : FrequencyEnum.Monthly
              );
            }}
            size="sm"
          />
          <span className="text-sm text-muted-foreground">Yearly</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch justify-center gap-4 sm:gap-6">
          {showcasedTiers.map((tier) => {
            const price =
              typeof tier.price === "string"
                ? tier.price
                : tier.price[billingCycle];
            const periodCopy =
              typeof tier.price === "string"
                ? (tier.period?.[billingCycle] ?? "Custom pricing")
                : (tier.period?.[billingCycle] ??
                  selectedFrequency.priceSuffix);

            return (
              <Card
                key={tier.key}
                className={`h-full w-full bg-muted/70 sm:w-80 rounded-3xl pb-4  ${
                  tier.mostPopular ? "border-2 border-primary" : "border-border"
                }`}
              >
                <CardHeader className="flex flex-col  px-6 py-4  items-start">
                  <h3 className="text-lg font-medium text-foreground">
                    {tier.title}
                  </h3>
                  <div className="mt-4 gap-2 flex flex-col">
                    <div className="text-5xl font-semibold tracking-tight text-foreground/90">
                      {price}
                    </div>
                    <div className="text-xs">{periodCopy}</div>
                  </div>

                  <p className="text-sm mt-4 text-muted-foreground">
                    {tier.description}
                  </p>

                  <Button
                    className="mt-2 w-full"
                    color={tier.buttonColor}
                    as="a"
                    href={tier.href}
                    variant={tier.buttonVariant}
                  >
                    {tier.buttonText}
                  </Button>
                </CardHeader>

                <Divider className="my-2" />

                <CardBody className="flex flex-col justify-between px-6 pt-2">
                  <div className="flex-1">
                    <ul className="space-y-4">
                      {tier.features?.map((feature) => (
                        <li key={feature} className="flex items-center">
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
            );
          })}
        </div>
      </div>
    </section>
  );
};

export { Pricing };
