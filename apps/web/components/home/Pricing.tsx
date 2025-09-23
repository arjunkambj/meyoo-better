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
import { designSystem } from "@/libs/design-system";
import { Icon } from "@iconify/react";

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
      className={`relative ${designSystem.spacing.section} ${designSystem.background.gradient} w-full scroll-mt-24`}
    >
      <div
        className={`${designSystem.spacing.container} flex flex-col gap-6 sm:gap-8 md:gap-10`}
      >
        <div className="flex flex-col items-center justify-center">
          <div className={designSystem.typography.sectionChip}>
            <Icon
              icon="solar:tag-price-bold"
              width={16}
              className="text-primary/70"
            />
            <span className="text-xs uppercase tracking-[0.15em] font-medium text-primary/70">
              Pricing plans
            </span>
          </div>
          <h2 className={designSystem.typography.sectionTitle}>
            Choose your growth plan
          </h2>
          <p className={designSystem.typography.sectionSubtitle}>
            Start with a 14-day free trial. All plans include the live profit
            dashboard, ad integrations, AI assistant, and automated cost
            tracking.
          </p>
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
                className={`h-full w-full bg-primary/5 ring-primary/10 backdrop-blur-sm sm:w-80 rounded-2xl pb-4 transition-all duration-300 ${
                  tier.mostPopular
                    ? "ring-2  bg-primary/5 ring-primary backdrop-blur-sm "
                    : "ring-1 ring-white/5"
                }`}
              >
                <CardHeader className="flex flex-col px-6 py-6 items-start">
                  <h3 className="text-lg font-semibold text-foreground text-default-900">
                    {tier.title}
                  </h3>
                  <div className="mt-4 gap-2 flex flex-col">
                    <div className="text-4xl font-semibold tracking-tight text-foreground text-default-900">
                      {price}
                    </div>
                    <div className="text-xs">{periodCopy}</div>
                  </div>

                  <p className="text-sm mt-4 text-muted-foreground text-default-800">
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

                <Divider className="my-2 bg-default-200" />

                <CardBody className="flex flex-col justify-between px-6 pt-2">
                  <div className="flex-1">
                    <ul className="space-y-4">
                      {tier.features?.map((feature) => (
                        <li key={feature} className="flex items-center">
                          <BadgeCheck className="size-5 text-primary/60" />
                          <span className="ml-3 text-sm text-muted-foreground leading-relaxed text-default-800  ">
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
