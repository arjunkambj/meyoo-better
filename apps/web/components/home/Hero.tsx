"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Button, Card, CardBody } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { designSystem } from "@/libs/design-system";

const d2cBrands = [
  { name: "Allbirds", logo: "/logos/d2c/allbirds.svg", width: 96 },
  { name: "Glossier", logo: "/logos/d2c/glossier.svg", width: 104 },
  { name: "Warby Parker", logo: "/logos/d2c/warby-parker.svg", width: 122 },
  { name: "Outdoor Voices", logo: "/logos/d2c/outdoor-voices.svg", width: 128 },
  { name: "Everlane", logo: "/logos/d2c/everlane.svg", width: 108 },
  { name: "Gymshark", logo: "/logos/d2c/gymshark.svg", width: 118 },
];

const Hero = () => {
  return (
    <section
      className={`relative w-full min-h-[calc(90vh)] flex items-center justify-center overflow-hidden md:mt-8 ${designSystem.background.gradient} py-16 sm:py-20 lg:py-20 2xl:py-24`}
    >
      <div className={`${designSystem.spacing.container} relative z-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-left flex flex-col">
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
            className="relative flex justify-center lg:justify-end"
          >
            <Card className="relative h-[420px] w-full max-w-[720px] rounded-2xl bg-muted/30 p-4 backdrop-blur-sm md:h-[560px] lg:h-[640px] ring-1 ring-white/10">
              <CardBody className="relative size-full rounded-xl bg-gradient-to-br from-background/90 via-background/80 to-muted/20 overflow-hidden">
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

        <div className="mt-16">
          <div className="mx-auto w-full max-w-7xl px-4">
            <div className="flex w-full flex-nowrap items-center justify-between gap-4 text-default-400 sm:gap-8">
              {d2cBrands.map((brand) => (
                <div
                  key={brand.name}
                  className="flex flex-1 items-center justify-center px-1 opacity-90 transition-opacity duration-150 hover:opacity-100"
                >
                  <Image
                    alt={`${brand.name} logo`}
                    src={brand.logo}
                    width={brand.width}
                    height={32}
                    className="h-8 w-auto max-w-[128px] sm:h-10"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Hero };
