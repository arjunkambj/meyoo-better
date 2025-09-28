"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Button, Card, CardBody } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { designSystem } from "@/libs/design-system";

const Hero = () => {
  return (
    <section
      className={`relative w-full min-h-[calc(90vh)] flex items-center justify-center overflow-hidden md:mt-8 ${designSystem.background.gradient} ${designSystem.spacing.section}`}
    >
      <div className={`${designSystem.spacing.container} relative z-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-left flex flex-col">
            {/* Trust Badge with Avatars (Next/Image) */}
            <div className="group inline-flex items-center gap-3 px-4 py-1.5 mb-6 w-fit rounded-full border border-primary/20 bg-primary/5 text-primary/80 backdrop-blur-sm transition-colors duration-200 hover:border-primary/30 hover:bg-primary/10 dark:border-primary/40 dark:bg-primary/20 dark:text-primary/90">
              <div className="flex -space-x-1.5">
                <Image
                  src="https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80"
                  alt="Founder avatar 1"
                  width={48}
                  height={48}
                  quality={90}
                  sizes="24px"
                  className="h-6 w-6 rounded-full ring-1 ring-background dark:ring-default-50/60 object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <Image
                  src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80"
                  alt="Founder avatar 2"
                  width={48}
                  height={48}
                  quality={90}
                  sizes="24px"
                  className="h-6 w-6 rounded-full ring-1 ring-background dark:ring-default-50/60 object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <Image
                  src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80"
                  alt="Founder avatar 3"
                  width={48}
                  height={48}
                  quality={90}
                  sizes="24px"
                  className="h-6 w-6 rounded-full ring-1 ring-background dark:ring-default-50/60 object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <Image
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80"
                  alt="Founder avatar 4"
                  width={48}
                  height={48}
                  quality={90}
                  sizes="24px"
                  className="h-6 w-6 rounded-full ring-1 ring-background dark:ring-default-50/60 object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </div>
              <span className="text-xs uppercase tracking-[0.15em] font-medium text-primary/80 dark:text-primary/70">
                Trusted by 1000+ founders
              </span>
              <Icon
                icon="solar:arrow-right-linear"
                className="text-primary transition-transform duration-200 group-hover:translate-x-0.5"
                width={16}
              />
            </div>

            {/* Header  */}
            <h1 className="text-4xl leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl font-semibold">
              See, Measure And <span className="text-primary">Grow Profit</span>
              <br />
              <span className="font-playfair italic">
                Built for <span className="text-primary italic">D2C</span>{" "}
                brands.
              </span>
            </h1>

            {/* Professional info */}
            <p
              className={`${designSystem.typography.sectionSubtitle} text-balance text-left`}
            >
              Meyoo gathers orders, ad spend, and every cost in one place so D2C
              operators can see margin without digging through spreadsheets.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-start sm:gap-4">
              <Button
                as={Link}
                href="/signin"
                className="w-full sm:w-auto font-semibold px-6 sm:px-8 transition-transform duration-200 will-change-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-primary/40"
                color="primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={20} />}
                size="lg"
              >
                Start free trial
              </Button>
              <Button
                as={Link}
                href="#pricing"
                variant="flat"
                size="lg"
                className="transition-transform duration-200 hover:-translate-y-0.5"
              >
                View pricing
              </Button>
            </div>

            {/* Money Back Guarantee */}
            <div className="mt-6">
              <div className="inline-flex items-center gap-2 text-sm text-default-600">
                <Icon icon="solar:shield-check-bold" width={16} />
                <span>14-day free trial · Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right Column - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              ease: [0, 0.71, 0.2, 1.01],
              duration: 0.8,
              delay: 0.2,
            }}
            className="relative"
          >
            <Card className="group relative h-[320px] w-full rounded-2xl bg-muted/30 p-3 backdrop-blur-sm md:h-[420px] lg:h-[480px] transition-all duration-300 ring-1 ring-white/10 hover:-translate-y-1 hover:shadow-2xl">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-60" />
              <CardBody className="relative size-full rounded-xl bg-gradient-to-br from-background/90 via-background/80 to-muted/20 overflow-hidden">
                {/* Subtle shine sweep on hover */}
                <div className="pointer-events-none absolute -inset-x-10 -top-1/2 h-[200%] rotate-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <Image
                  alt="Dashboard preview"
                  className="size-full rounded-xl object-cover"
                  fill
                  priority
                  src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
                  unoptimized
                />
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export { Hero };
