"use client";

import React from "react";

import { cn } from "@/libs/utils";
import { designSystem } from "@/libs/design-system";
import Image from "next/image";
import { Marquee } from "@/components/ui/marquee";
import { Icon } from "@iconify/react";

const howItWorks = [
  {
    number: "01",
    title: "Connect Shopify",
    description:
      "Install Meyoo and sync Shopify. We import orders, products, and customers automatically—no CSV shuffling.",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    imageOrder: "order-1",
    contentOrder: "order-2",
  },
  {
    number: "02",
    title: "Link your ad spend",
    description:
      "Plug in Meta and Google Ads. We keep spend, ROAS, and conversions in sync so marketing and finance see the same truth.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    imageOrder: "order-2",
    contentOrder: "order-1",
  },
  {
    number: "03",
    title: "Track profit automatically",
    description:
      "Set up costs like COGS, shipping, and fees once. Meyoo updates profit and margin every day without extra work.",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    imageOrder: "order-1",
    contentOrder: "order-2",
  },
];

const Integration = () => {
  const logos = [
    { icon: "logos:shopify", name: "Shopify", className: "" },
    { icon: "logos:meta-icon", name: "Meta Ads", className: "" },
    { icon: "logos:google-ads", name: "Google Ads", className: "" },
    { icon: "logos:tiktok-icon", name: "TikTok Ads", className: "" },
    { icon: "ri:snapchat-fill", name: "Snapchat Ads", className: "text-[#FFFC00]" },
    { icon: "logos:twitter", name: "Twitter Ads", className: "" },
    { icon: "logos:google-analytics", name: "Google Analytics", className: "" },
  ];

  return (
    <section
      className={`relative flex w-full flex-col items-center justify-center ${designSystem.spacing.section} ${designSystem.background.gradient}`}
    >
      <div className={designSystem.spacing.container}>
        <div className="text-center">
          <div className={designSystem.typography.sectionChip}>
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              Integrations
            </span>
          </div>
        </div>
        <h2 className={designSystem.typography.sectionTitle}>How Meyoo Works</h2>
        <p className={designSystem.typography.sectionSubtitle}>
          From setup to scale in three simple steps: connect your tools, unlock insights, and make better decisions to grow your brand.
        </p>

        <div className="relative mt-12">
          <Marquee pauseOnHover className="[--duration:20s]">
            {logos.map((logo, index) => (
              <div
                key={index}
                className="flex items-center justify-center gap-4 rounded-full bg-muted/40 px-5 py-2 backdrop-blur-sm"
              >
                {"icon" in logo && logo.icon ? (
                  <Icon
                    icon={logo.icon}
                    width={20}
                    height={20}
                    className={cn("", logo?.className)}
                  />
                ) : (
                  <Image
                    alt={logo.name}
                    className={cn("size-5", logo?.className)}
                    height={20}
                    src={(logo as any).image}
                    unoptimized
                    width={20}
                  />
                )}
                <p className="text-lg">{logo.name}</p>
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-background"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-36 bg-gradient-to-l from-background"></div>
        </div>
      </div>
      <div className="relative mx-auto mt-12 grid min-h-[28rem] w-full max-w-7xl items-stretch ${designSystem.spacing.gap.md} gap-10 px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-3">
        {howItWorks.map((feature, index) => (
          <PinContainer
            key={index}
            className={`${designSystem.card.base} w-full rounded-2xl p-4 transition-all duration-300`}
          >
            <div className="flex flex-col">
              <div className={feature.imageOrder}>
                <Image
                  src={feature.image}
                  height={1000}
                  width={1000}
                  className="h-64 w-full sm:h-70 rounded-xl object-cover"
                  alt="thumbnail"
                />
              </div>
              <div className={`mt-4 w-full p-3 ${feature.contentOrder}`}>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Step {feature.number}
                </p>
                <h2 className="my-3 text-xl font-semibold tracking-tight">
                  {feature.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          </PinContainer>
        ))}
      </div>
    </section>
  );
};

export { Integration };

export const PinContainer = ({
  children,
  title,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
  containerClassName?: string;
}) => {
  return (
    <div className={cn("relative h-full ", containerClassName)}>
      <div className={cn("relative h-full flex flex-col", className)}>
        {children}
      </div>
      {title && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-zinc-950 text-white text-xs font-bold px-4 py-0.5 rounded-full ring-1 ring-white/10">
            {title}
          </span>
        </div>
      )}
    </div>
  );
};
