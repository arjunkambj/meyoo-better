"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Avatar, AvatarGroup, Button, Card, CardBody } from "@heroui/react";
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
            {/* Trust Badge with Avatars */}
            <div className="inline-flex items-center gap-3 px-4 py-1.5 mb-6 w-fit rounded-full border border-primary/20 bg-primary/5 text-primary/80 backdrop-blur-sm dark:border-primary/40 dark:bg-primary/20 dark:text-primary/90">
              <AvatarGroup max={4} size="sm" className="-space-x-1.5">
                <Avatar
                  src="https://i.pravatar.cc/150?u=a042581f4e29026024d"
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-background dark:ring-default-50/60"
                />
                <Avatar
                  src="https://i.pravatar.cc/150?u=a04258a2462d826712d"
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-background dark:ring-default-50/60"
                />
                <Avatar
                  src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-background dark:ring-default-50/60"
                />
                <Avatar
                  src="https://i.pravatar.cc/150?u=a04258114e29026302d"
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-background dark:ring-default-50/60"
                />
              </AvatarGroup>
              <span className="text-xs uppercase tracking-[0.15em] font-medium text-primary/80 dark:text-primary/70">
                Trusted by 1000+ founders
              </span>
              <Icon
                icon="solar:arrow-right-linear"
                className="text-primary"
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
                className="w-full sm:w-auto font-semibold px-6 sm:px-8"
                color="primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={20} />}
                size="lg"
              >
                Start free trial
              </Button>
              <Button as={Link} href="#pricing" variant="flat" size="lg">
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
            <Card className="group relative h-[320px] w-full rounded-2xl bg-muted/30 p-3 backdrop-blur-sm md:h-[420px] lg:h-[480px] transition-all duration-300 ring-1 ring-white/10">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-60" />
              <CardBody className="relative size-full rounded-xl bg-gradient-to-br from-background/90 via-background/80 to-muted/20">
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
