"use client";

import { Button, Chip, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { frequencies, tiers } from "./pricing/constants";
import { type Frequency, FrequencyEnum } from "./pricing/types";

export default function Pricing({ className }: { className?: string }) {
  const router = useRouter();
  const [selectedFrequency, setSelectedFrequency] = React.useState<Frequency>(
    (frequencies[0] as Frequency) ?? (frequencies[0] as Frequency),
  );
  const [loadingTier, setLoadingTier] = React.useState<string | null>(null);

  const onFrequencyChange = (selectedKey: React.Key) => {
    const frequencyIndex = frequencies.findIndex((f) => f.key === selectedKey);
    setSelectedFrequency(
      (frequencies[frequencyIndex] ?? frequencies[0]) as Frequency,
    );
  };

  return (
    <section
      className={`relative w-full py-24 bg-background overflow-hidden ${className}`}
    >
      {/* Section background unify */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Thin 1px gradient line at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent dark:via-primary/25" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 lg:px-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-6">
            <Icon
              className="text-primary"
              icon="solar:tag-price-bold"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              Pricing
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">Start Tracking Real Profit</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              In 3 Minutes
            </span>
          </h2>
          <p className="text-lg text-default-600 max-w-2xl mx-auto">
            Join 500+ Shopify brands that increased profits by 25% on average.
            All plans include 14-day free trial.
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <Tabs
            classNames={{
              tab: "data-[hover-unselected=true]:opacity-90 font-medium",
            }}
            radius="full"
            size="lg"
            onSelectionChange={onFrequencyChange}
          >
            <Tab key={FrequencyEnum.Monthly} title="Pay Monthly" />
            <Tab
              key={FrequencyEnum.Yearly}
              aria-label="Pay Yearly"
              className="pr-1.5"
              title={
                <div className="flex items-center gap-2">
                  <p>Pay Yearly</p>
                  <Chip className="bg-primary/10 text-primary" size="sm">
                    Save 2 Months
                  </Chip>
                </div>
              }
            />
          </Tabs>
        </div>

        {/* Clean Free Usage Notice */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-success/10 rounded-full border border-success/30">
            <Icon className="text-success" icon="solar:gift-bold" width={20} />
            <p className="text-sm font-medium text-foreground">
              Free for stores with less than 200 orders/month
            </p>
          </div>
        </div>

        {/* Pricing Cards Grid - Show only first 4 tiers (exclude Enterprise) */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          {tiers.slice(0, 4).map((tier) => (
            <div
              key={tier.key}
              className="relative h-full flex flex-col bg-content1/70 dark:bg-content1/40 backdrop-blur-md rounded-2xl p-8 border border-divider hover:border-primary/30 transition-all duration-300 overflow-hidden"
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10 dark:ring-white/5" />
              <div className="mb-6 relative z-10">
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {tier.title}
                </h3>
                <p className="text-sm text-default-600">{tier.description}</p>
              </div>

              <div className="mb-6">
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {typeof tier.price === "string"
                      ? tier.price
                      : tier.price[selectedFrequency.key]}
                  </span>
                  {typeof tier.price !== "string" ? (
                    <span className="text-sm font-medium text-default-500">
                      {tier.priceSuffix
                        ? `/${tier.priceSuffix}/${selectedFrequency.priceSuffix}`
                        : `/${selectedFrequency.priceSuffix}`}
                    </span>
                  ) : null}
                </p>
                {tier.price !== "$0" && (
                  <p className="text-xs text-default-500 mt-2">
                    14-day free trial included
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {tier.features?.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Icon
                      className="text-success shrink-0 mt-0.5"
                      icon="solar:check-circle-bold"
                      width={16}
                    />
                    <span className="text-sm text-default-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                fullWidth
                color="primary"
                endContent={
                  <Icon className="w-4 h-4" icon="solar:arrow-right-linear" />
                }
                radius="lg"
                size="lg"
                variant="solid"
                isLoading={loadingTier === tier.key}
                isDisabled={loadingTier === tier.key}
                onPress={() => {
                  if (loadingTier) return;
                  setLoadingTier(tier.key);
                  router.push(tier.href);
                }}
              >
                {tier.buttonText}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center space-y-6 mt-16">
          <p className="text-default-600">
            Questions? Check our{" "}
            <Link
              className="font-semibold text-primary hover:text-primary/80"
              href="#faq"
            >
              FAQ
            </Link>{" "}
            or{" "}
            <Link
              className="font-semibold text-primary hover:text-primary/80"
              href="/contact"
            >
              Contact sales
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
