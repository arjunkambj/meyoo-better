"use client";

import { Button, Card, CardBody, Chip, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { frequencies, tiers } from "../home/pricing/constants";
import { type Frequency, FrequencyEnum } from "../home/pricing/types";
import { useRouter } from "next/navigation";

import PricingComparison from "./PricingComparison";
import PricingFAQ from "./PricingFAQ";

export default function PricingPageView() {
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
    <div className="min-h-screen bg-background pt-28">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-default-200/70 to-transparent dark:via-default-100/40" />

      {/* Hero Section - Similar to Contact Page */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 bg-content1/70 dark:bg-content1/50 backdrop-blur-md border border-divider rounded-full px-5 py-2.5 mb-6">
            <Icon
              className="text-primary"
              icon="solar:tag-price-bold-duotone"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              Pricing
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Pricing</h1>
          <p className="text-xl text-default-600">
            Choose the right plan for your business
          </p>
        </div>
      </section>

      {/* Pricing Cards Section */}
      <section>
        <div className="lg:max-w-[80dvw] max-w-7xl 3xl:max-w-8xl mx-auto px-6 md:px-8 lg:px-12">
          {/* Frequency Toggle */}
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
                    <Chip color="primary" size="sm">
                      Save 2 Months
                    </Chip>
                  </div>
                }
              />
            </Tabs>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {tiers.map((tier) => (
              <Card
                key={tier.key}
                className={`relative h-full ${
                  tier.mostPopular
                    ? "border-2 border-primary shadow-lg"
                    : "border border-default-200"
                }`}
              >
                {tier.mostPopular && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2">
                    <Chip color="primary">Most Popular</Chip>
                  </div>
                )}
                <CardBody className="p-8">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {tier.title}
                    </h3>
                    <p className="text-sm text-default-600">
                      {tier.description}
                    </p>
                  </div>

                  <div className="mb-6">
                    <p className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        {typeof tier.price === "string"
                          ? tier.price
                          : tier.price[selectedFrequency.key]}
                      </span>
                      {typeof tier.price !== "string" && (
                        <span className="text-sm font-medium text-default-500">
                          /{selectedFrequency.priceSuffix}
                        </span>
                      )}
                    </p>
                    {tier.price !== "$0" && (
                      <p className="text-xs text-default-500 mt-2">
                        Billed{" "}
                        {selectedFrequency.key === FrequencyEnum.Yearly
                          ? "annually"
                          : "monthly"}
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-grow">
                    {tier.features?.map((feature) => (
                      <li
                        key={`${tier.key}-feature-${feature}`}
                        className="flex items-start gap-3"
                      >
                        <Icon
                          className={
                            feature.includes("$") || feature.includes("Max")
                              ? "text-warning shrink-0 mt-0.5"
                              : "text-success shrink-0 mt-0.5"
                          }
                          icon={
                            feature.includes("$") || feature.includes("Max")
                              ? "solar:info-circle-bold"
                              : "solar:check-circle-bold"
                          }
                          width={16}
                        />
                        <span className="text-sm text-default-700">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    fullWidth
                    color={tier.mostPopular ? "primary" : "default"}
                    endContent={
                      <Icon
                        className="w-4 h-4"
                        icon="solar:arrow-right-linear"
                      />
                    }
                    radius="lg"
                    size="lg"
                    variant={tier.mostPopular ? "solid" : "flat"}
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
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 ">
        <div className="lg:max-w-[80dvw] max-w-7xl 3xl:max-w-8xl mx-auto px-6 md:px-8 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Compare Plans</h2>
            <p className="text-default-600 max-w-2xl mx-auto">
              All plans include core features. Higher tiers unlock advanced
              capabilities and higher limits.
            </p>
          </div>
          <PricingComparison />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-default-600 max-w-2xl mx-auto">
              Everything you need to know about our pricing and billing.
            </p>
          </div>
          <PricingFAQ />
        </div>
      </section>
    </div>
  );
}
