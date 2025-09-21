'use client';

import { BadgeCheck } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { Button, Card, CardBody, CardHeader, Divider, Switch } from '@heroui/react';

import { frequencies, tiers } from './pricing/constants';
import { type Frequency, FrequencyEnum, TiersEnum } from './pricing/types';

const showcasedTiers = tiers.filter((tier) => tier.key !== TiersEnum.Enterprise);

const Pricing = () => {
  const defaultFrequency = frequencies[0];

  if (!defaultFrequency) {
    throw new Error('No pricing frequencies configured');
  }

  const [billingCycle, setBillingCycle] = useState<FrequencyEnum>(FrequencyEnum.Monthly);

  const selectedFrequency = useMemo<Frequency>(
    () =>
      frequencies.find((frequency) => frequency.key === billingCycle) ?? defaultFrequency,
    [billingCycle, defaultFrequency],
  );

  return (
    <section className="bg-background py-32">
      <div className="container mx-auto flex flex-col gap-13">
        <h1 className="text-center text-6xl font-bold tracking-tighter text-foreground">
          Simple Pricing Plans
        </h1>

        <div className="flex items-center justify-center gap-4">
          <span className="text-sm text-muted-foreground">Monthly</span>
          <Switch
            isSelected={billingCycle === FrequencyEnum.Yearly}
            onValueChange={(isSelected) => {
              setBillingCycle(isSelected ? FrequencyEnum.Yearly : FrequencyEnum.Monthly);
            }}
            size="sm"
          />
          <span className="text-sm text-muted-foreground">Yearly</span>
        </div>

        <div className="flex items-stretch justify-center gap-6">
          {showcasedTiers.map((tier) => {
            const price =
              typeof tier.price === 'string' ? tier.price : tier.price[billingCycle];
            const periodCopy =
              typeof tier.price === 'string'
                ? tier.period?.[billingCycle] ?? 'Custom pricing'
                : tier.period?.[billingCycle] ?? selectedFrequency.priceSuffix;

            return (
              <Card
                key={tier.key}
                className={`h-full w-80 rounded-3xl border px-4 py-3 ${
                  tier.mostPopular ? 'border-2 border-primary' : 'border-border'
                }`}
              >
                <CardHeader className="flex flex-col items-start">
                  <h3 className="text-lg font-medium text-foreground">{tier.title}</h3>
                  <div className="mt-4">
                    <div className="text-5xl font-semibold tracking-tight text-foreground/90">
                      {price}
                    </div>
                    <div className="text-xs">{periodCopy}</div>
                  </div>
                </CardHeader>

                <CardBody className="flex flex-col justify-between px-3 pt-2">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{tier.description}</p>

                    <Button
                      className="mt-3 w-full"
                      color={tier.buttonColor}
                      as="a"
                      href={tier.href}
                      variant={tier.buttonVariant}
                    >
                      {tier.buttonText}
                    </Button>

                    <Divider className="my-4" />

                    <ul className="space-y-4">
                      {tier.features?.map((feature) => (
                        <li key={feature} className="flex items-center">
                          <BadgeCheck className="size-5 text-muted-foreground" />
                          <span className="ml-3 text-sm text-muted-foreground">{feature}</span>
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
