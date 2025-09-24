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
            <Icon
              icon="solar:tag-price-bold"
              width={18}
              className="text-primary/70"
            />
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
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

        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Monthly</span>
          <Switch
            isSelected={billingCycle === FrequencyEnum.Yearly}
            onValueChange={(isSelected) => {
              setBillingCycle(
                isSelected ? FrequencyEnum.Yearly : FrequencyEnum.Monthly
              );
            }}
            size="sm"
          />
          <span className="font-medium text-foreground">Yearly</span>
        </div>

        <div className="flex flex-col items-stretch justify-center gap-5 sm:flex-row sm:gap-6">
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
                className={`h-full w-full ${designSystem.card.base} rounded-2xl pb-5 transition duration-300 sm:w-80`}
              >
                <CardHeader className="flex flex-col gap-4 px-6 py-6">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {tier.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {tier.description}
                  </p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-end gap-1 text-4xl font-semibold tracking-tight text-foreground">
                      {shouldAnimate ? (
                        <>
                          <span className="text-2xl font-medium text-muted-foreground">
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
                        <span>{price}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{periodCopy}</div>
                  </div>

                  <Button
                    as={Link}
                    className="mt-2 w-full"
                    color={tier.buttonColor}
                    href={tier.href}
                    variant={tier.buttonVariant}
                  >
                    {tier.buttonText}
                  </Button>
                </CardHeader>

                <Divider className="my-2 bg-default-200" />

                <CardBody className="flex flex-col px-6 pb-6 pt-2">
                  <div className="flex-1">
                    <ul className="space-y-3">
                      {tier.features?.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <BadgeCheck className="mt-0.5 size-5 text-primary/60" />
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
