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
import Link from "next/link";
import { NumberTicker } from "@/components/ui/number-ticker";

const usePrevious = <T,>(value: T) => {
  const ref = React.useRef<T>(value);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
};

const getTierPrice = (
  tier: (typeof tiers)[number],
  cycle: FrequencyEnum
): string => {
  if (typeof tier.price === "string") {
    return tier.price;
  }
  return tier.price[cycle];
};

const parsePrice = (price: string): number => {
  const numeric = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isNaN(numeric) ? NaN : numeric;
};

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
  const previousBillingCycle = usePrevious(billingCycle);

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
        className={`${designSystem.spacing.container} flex flex-col gap-8 sm:gap-10`}
      >
        <div className="flex flex-col items-center text-center">
          <div className={designSystem.typography.sectionChip}>
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              Plans
            </span>
          </div>
          <h2 className={designSystem.typography.sectionTitle}>Simple, Transparent Pricing</h2>
          <p className={`${designSystem.typography.sectionSubtitle} max-w-2xl mx-auto`}>
            Choose the perfect plan for your business. Start free, scale as you grow, cancel anytime.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 text-sm">
          <span className={`font-medium transition-colors ${billingCycle === FrequencyEnum.Monthly ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
          <Switch
            isSelected={billingCycle === FrequencyEnum.Yearly}
            onValueChange={(isSelected) => {
              setBillingCycle(
                isSelected ? FrequencyEnum.Yearly : FrequencyEnum.Monthly
              );
            }}
            size="lg"
          />
          <div className="flex items-center gap-2">
            <span className={`font-medium transition-colors ${billingCycle === FrequencyEnum.Yearly ? 'text-foreground' : 'text-muted-foreground'}`}>Yearly</span>
            <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Save 20%</span>
          </div>
        </div>

        <div className="flex flex-col items-stretch justify-center gap-6 sm:flex-row sm:items-stretch">
          {showcasedTiers.map((tier) => {
            const price = getTierPrice(tier, billingCycle);
            const previousPrice = getTierPrice(
              tier,
              previousBillingCycle ?? billingCycle
            );
            const periodCopy =
              tier.period?.[billingCycle] ?? selectedFrequency.priceSuffix;
            const currentPriceValue = parsePrice(price);
            const previousPriceValue = parsePrice(previousPrice);
            const shouldAnimate =
              Number.isFinite(currentPriceValue) &&
              Number.isFinite(previousPriceValue);
            const tickerDirection =
              currentPriceValue >= previousPriceValue ? "up" : "down";

            return (
              <Card
                key={tier.key}
                className={`h-full w-full ${designSystem.card.base} rounded-3xl p-1.5 transition-all duration-300 hover:scale-[1.02] sm:w-96`}
              >
                <CardHeader className="flex flex-col gap-5 py-8 px-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">
                      {tier.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {tier.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="flex items-end gap-1.5 text-5xl font-bold tracking-tight text-foreground">
                      {shouldAnimate ? (
                        <>
                          <span className="text-3xl font-semibold text-muted-foreground">
                            $
                          </span>
                          <NumberTicker
                            value={currentPriceValue}
                            startValue={previousPriceValue}
                            decimalPlaces={0}
                            direction={tickerDirection}
                          />
                        </>
                      ) : (
                        <span className="text-3xl font-semibold text-muted-foreground">
                          {price}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">
                      {periodCopy}
                    </div>
                  </div>

                  <Button
                    as={Link}
                    className="mt-2 w-full h-11 font-semibold transition-all duration-200 hover:scale-105 active:scale-100"
                    color={tier.buttonColor}
                    href={tier.href}
                    variant={tier.buttonVariant}
                    size="lg"
                  >
                    {tier.buttonText}
                  </Button>
                </CardHeader>

                <Divider className="my-3 bg-default-100" />

                <CardBody className="flex flex-col px-6 pb-8 pt-4">
                  <div className="flex-1">
                    <ul className="space-y-4">
                      {tier.features?.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                          <span className="text-sm leading-relaxed text-muted-foreground">
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
