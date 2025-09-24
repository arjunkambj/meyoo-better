"use client";

import { BadgeCheck } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import type { ComponentProps } from "react";

import type { Frequency, Tier } from "@/components/home/pricing/types";
import { cn } from "@/libs/utils";

export type PricingTierCardButton = {
  label: string;
  className?: string;
} & Pick<
  ComponentProps<typeof Button>,
  | "color"
  | "variant"
  | "onPress"
  | "isLoading"
  | "disabled"
  | "size"
  | "fullWidth"
  | "endContent"
>;

export type PricingTierCardProps = {
  tier: Tier;
  selectedFrequency: Frequency;
  button: PricingTierCardButton;
  highlight?: "active" | "popular" | null;
  className?: string;
};

const highlightClassNames: Record<
  NonNullable<PricingTierCardProps["highlight"]>,
  string
> = {
  active: "border-success ring-2 ring-success/20",
  popular: "border-primary/70 ring-2 ring-primary/20",
};

export function PricingTierCard({
  tier,
  selectedFrequency,
  button,
  highlight = null,
  className,
}: PricingTierCardProps) {
  const price =
    typeof tier.price === "string"
      ? tier.price
      : (tier.price?.[selectedFrequency.key] ?? "--");
  const periodCopy =
    tier.period?.[selectedFrequency.key] ??
    tier.priceSuffix ??
    selectedFrequency.priceSuffix;

  const cardClassName = cn(
    "flex h-full w-full flex-col rounded-2xl border bg-content2 dark:bg-content1 shadow-none transition duration-300",
    highlight
      ? highlightClassNames[highlight]
      : "border-default-100 hover:border-primary/30",
    className
  );

  return (
    <Card className={cardClassName} shadow="sm">
      <CardHeader className="flex flex-col gap-4 py-6">
        <div className="flex items-center gap-3">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-center tracking-tight text-foreground">
              {tier.title}
            </h3>
            {tier.description ? (
              <p className="text-sm text-center text-default-500">
                {tier.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-3xl font-semibold text-center tracking-tight text-foreground">
            {price}
          </div>
          <div className="text-xs font-medium text-center text-default-500">
            {periodCopy}
          </div>
        </div>

        <Button
          {...button}
          className={cn("mt-2", button.className)}
          fullWidth={button.fullWidth ?? true}
        >
          {button.label}
        </Button>
      </CardHeader>

      {tier.features && tier.features.length > 0 ? (
        <>
          <Divider className="my-2 bg-default-200" />
          <CardBody className="flex flex-col px-6 pb-6 pt-2">
            <ul className="space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 size-5 text-primary/60" />
                  <span className="text-sm leading-relaxed text-default-600">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </>
      ) : null}
    </Card>
  );
}
