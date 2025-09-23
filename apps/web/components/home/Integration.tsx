"use client";

import React from "react";

import { cn } from "@/libs/utils";

import Image from "next/image";
import { Marquee } from "@/components/ui/marquee";

const howItWorks = [
  {
    number: "01",
    title: "Connect your store",
    description:
      "Link Shopify in seconds. We’ll pull in orders, products, and customers—no setup stress.",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    imageOrder: "order-1",
    contentOrder: "order-2",
  },
  {
    number: "02",
    title: "Add your ads",
    description:
      "Bring in Meta and Google Ads. Spend, ROAS, and conversions flow into one clear view.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    imageOrder: "order-2",
    contentOrder: "order-1",
  },
  {
    number: "03",
    title: "See the real profit",
    description:
      "Add costs like COGS, shipping, and fees. Meyoo shows your true profit daily.",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
    imageOrder: "order-1",
    contentOrder: "order-2",
  },
];

const Integration = () => {
  const logos = [
    {
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/slack-icon.svg",
      name: "Slack",
      className: " ",
    },
    {
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/notion-icon.svg",
      name: "Notion",
      className: " ",
    },
    {
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/github-icon.svg",
      name: "Github",
      className: " ",
    },
    {
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/google-icon.svg",
      name: "Google",
      className: " ",
    },
    {
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/nike-icon.svg",
      name: "Nike",
      className: " ",
    },
    {
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/sketch-icon.svg",
      name: "Sketch",
      className: " ",
    },
    {
      image:
        "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/figma-icon.svg",
      name: "Figma",
      className: " ",
    },
  ];

  return (
    <section className="flex w-full flex-col items-center justify-center py-16 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center mb-3 text-primary">How it Works</p>
        <h1 className="text-center text-5xl font-medium tracking-tight md:text-7xl">
          Stop Guessing, Start Knowing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center tracking-tight text-muted-foreground/80 md:text-lg">
          Meyoo brings your sales, ads, and costs together—so you always see the
          full picture.
        </p>

        <div className="relative mt-12">
          <Marquee pauseOnHover className="[--duration:20s]">
            {logos.map((logo, index) => (
              <div
                key={index}
                className="flex items-center justify-center gap-4 rounded-full bg-muted px-5 py-2"
              >
                <img
                  src={logo.image}
                  alt={logo.name}
                  className={cn("size-5", logo?.className)}
                />
                <p className="text-lg">{logo.name}</p>
              </div>
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-background"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-36 bg-gradient-to-l from-background"></div>
        </div>
      </div>
      <div className="relative mx-auto mt-16 grid min-h-[32rem] w-full max-w-7xl items-stretch gap-6 px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-3">
        {howItWorks.map((feature, index) => (
          <PinContainer
            key={index}
            className="!bg-muted/70 w-full rounded-3xl p-4"
          >
            <div className="flex flex-col">
              <div className={feature.imageOrder}>
                <Image
                  src={feature.image}
                  height={1000}
                  width={1000}
                  className="h-64 w-full sm:h-70 rounded-3xl object-cover"
                  alt="thumbnail"
                />
              </div>
              <div className={`mt-4 w-full p-3 ${feature.contentOrder}`}>
                <p className="leading-none tracking-tighter opacity-50">
                  {feature.number}
                </p>
                <h2 className="my-3 text-3xl font-semibold leading-none tracking-tighter">
                  {feature.title}
                </h2>
                <p className="leading-5 opacity-50">{feature.description}</p>
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
  href,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  title?: string;
  href?: string;
  className?: string;
  containerClassName?: string;
}) => {
  return (
    <div className={cn("relative h-full", containerClassName)}>
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
