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
      className={`relative w-full min-h-[calc(90vh)] flex items-center justify-center overflow-hidden ${designSystem.background.gradient} ${designSystem.spacing.section}`}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-55 dark:opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(99,102,241,0.18), rgba(15,23,42,0) 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-50 dark:opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "140px 140px",
          }}
        />
        <div className="absolute left-1/2 top-[10%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl opacity-70 dark:bg-primary/25" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/90 to-transparent" />
      </div>
      <div className={`${designSystem.spacing.container} relative z-10`}>
        <div className="text-center flex flex-col items-center">
          {/* Chip Badge */}
          <div className={designSystem.typography.sectionChip}>
            <Icon
              icon="solar:target-bold-duotone"
              width={16}
              className="text-primary/70"
            />
            <span className="text-xs uppercase tracking-[0.15em] font-medium text-primary/70">
              Real-time profit tracking
            </span>
          </div>

          {/* Header  */}
          <h1 className="text-4xl leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl font-semibold">
            See, Measure And <span className="text-primary">Grow Profit</span>
            <br />
            <span className="font-playfair italic">
              Built for <span className="text-primary">D2C</span> brands.
            </span>
          </h1>

          {/* Professional info */}
          <p
            className={`${designSystem.typography.sectionSubtitle} text-balance`}
          >
            Meyoo gathers orders, ad spend, and every cost in one place so D2C
            operators can see margin without digging through spreadsheets.
          </p>
          {/* CTA Buttons */}
          <div className="mt-8  flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
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
            <Button
              as={Link}
              href="#pricing"
              className="w-full sm:w-auto font-medium px-6 sm:px-8 bg-white/80 text-foreground hover:bg-white"
              size="lg"
              variant="flat"
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

        <motion.div
          initial={{ opacity: 0, y: 200 }}
          className="px-2"
          animate={{ opacity: 100, y: 0 }}
          transition={{ ease: [0, 0.71, 0.2, 1.01], duration: 0.8 }}
        >
          <Card className="group relative mx-auto mt-12 h-[320px] w-full max-w-7xl rounded-2xl bg-muted/30 p-3 backdrop-blur-sm md:h-[480px] transition-all duration-300 ring-1 ring-white/10">
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
    </section>
  );
};

export { Hero };
