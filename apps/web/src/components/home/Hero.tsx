"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Card, CardBody } from "@heroui/card";
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
      className={`relative w-full min-h-[calc(90vh)] flex items-center justify-center overflow-hidden mt-16 ${designSystem.background.gradient} pb-16 sm:pb-20 lg:pb-24 2xl:pb-32`}
    >
      <div className={`${designSystem.spacing.container} relative z-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-14 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center sm:text-left flex flex-col items-center sm:items-start px-2 sm:px-0">
            {/* Category Chip */}
            <Chip
              className="mb-6 text-xs  uppercase tracking-[0.05em] font-medium px-2"
              variant="flat"
            >
              Built for D2C brands
            </Chip>
            {/* Header  */}
            <h1 className="flex flex-col gap-4 font-semibold tracking-tight  text-pretty text-7xl mb-6">
              <span className="block text-balance text-default-900">
                See, Measure
              </span>

              <span className="block text-balance text-default-900">
                <span>and{` `}</span>
                <span className="text-primary">Grow Profit</span>
              </span>
              <span className="block text-5xl mt-2 text-default-900 font-playfair italic ">
                For every order. Every ad.
              </span>
            </h1>

            {/* Professional info */}
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed text-pretty text-center sm:text-left max-w-xl mx-auto sm:mx-0 mb-0">
              Meyoo pulls sales, ad spend, product costs, shipping, discounts,
              and fees into one simple view—so you can see real profit by order
              and SKU
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 sm:mt-12 flex flex-row flex-wrap justify-center sm:justify-start items-center gap-4">
              <Button
                as={Link}
                href="/signin"
                className="w-auto font-semibold px-6 sm:px-8 h-11 sm:h-12 transition-all duration-200 hover:scale-105 active:scale-100 text-sm sm:text-base"
                color="primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={18} />}
                size="lg"
              >
                Try Meyoo free
              </Button>
              <Button
                as={Link}
                href="#pricing"
                variant="flat"
                size="lg"
                className="w-auto h-11 sm:h-12 transition-all duration-200 hover:scale-105 active:scale-100 text-sm sm:text-base"
              >
                View pricing
              </Button>
            </div>

            {/* Trust line */}
            <div className="mt-8 sm:mt-10">
              <div className="inline-flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm text-default-600">
                <Icon
                  icon="solar:shield-check-bold"
                  width={16}
                  className="text-success sm:w-[18px]"
                />
                <span className="font-medium">
                  Fast setup · Free for 300 orders/month/store
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              ease: [0.16, 1, 0.3, 1],
              duration: 0.9,
              delay: 0.1,
            }}
            className="relative flex justify-center lg:justify-end px-2 sm:px-0"
          >
            <Card className="relative h-[320px] shadow-none w-full max-w-[720px] rounded-2xl sm:rounded-3xl bg-gradient-to-br from-muted/40 to-muted/20 p-1 sm:p-1.5 backdrop-blur-sm sm:h-[420px] md:h-[560px] lg:h-[640px] ring-1 ring-default-100">
              <CardBody className="relative size-full rounded-[16px] sm:rounded-[20px] bg-gradient-to-br from-background via-background to-muted/10 overflow-hidden p-0">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 pointer-events-none z-10" />
                {/* Light mode preview */}
                <Image
                  alt="Meyoo dashboard preview (light)"
                  className="block dark:hidden size-full rounded-xl sm:rounded-2xl object-cover object-left-top transition-transform duration-300 scale-[1.02]  hover:scale-[1.03]"
                  fill
                  priority
                  src="/meyoo light.png"
                />
                {/* Dark mode preview */}
                <Image
                  alt="Meyoo dashboard preview (dark)"
                  className="hidden dark:block size-full rounded-xl sm:rounded-2xl object-cover object-left-top transition-transform duration-300 scale-[1.02] hover:scale-[1.03]"
                  fill
                  priority
                  src="/dark-meyoo.png"
                />
              </CardBody>
            </Card>
          </motion.div>
        </div>

        <div className="mt-20">
          <div className="mx-auto w-full max-w-7xl px-2 sm:px-4">
            <p className="text-center text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8">
              Trusted by data‑driven D2C teams.
            </p>
            <div className="grid grid-cols-3 sm:flex sm:flex-nowrap items-center justify-between gap-6 sm:gap-8 lg:gap-12 text-default-400">
              {d2cBrands.map((brand) => (
                <div
                  key={brand.name}
                  className="flex items-center justify-center  transition-all duration-200 hover:opacity-100 hover:scale-105"
                >
                  <Image
                    alt={`${brand.name} logo`}
                    src={brand.logo}
                    width={brand.width}
                    height={32}
                    className="h-5 sm:h-7 lg:h-9 w-auto max-w-[70px] sm:max-w-[100px] lg:max-w-[120px] grayscale hover:grayscale-0 transition-all"
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
