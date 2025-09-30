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
      className={`relative w-full min-h-[calc(90vh)] flex items-center justify-center overflow-hidden pt-24 sm:pt-28 md:pt-24 md:mt-8 ${designSystem.background.gradient} pb-12 sm:pb-16 lg:pb-20 2xl:pb-24`}
    >
      <div className={`${designSystem.spacing.container} relative z-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-left flex flex-col px-2 sm:px-0">
            {/* Header  */}
            <h1 className="text-3xl leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl xl:text-7xl font-semibold mb-4 sm:mb-5">
              See, Measure And <span className="text-primary">Grow Profit</span>
              <br />
              <span className="font-playfair italic text-2xl sm:text-4xl lg:text-5xl xl:text-6xl leading-[1.2]">
                Built for <span className="text-primary italic">D2C</span>{" "}
                brands.
              </span>
            </h1>

            {/* Professional info */}
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed text-left max-w-xl mb-2">
              Meyoo connects Shopify, ad platforms, and costs to show real profit
              by product and channel—so D2C brands can make smarter decisions fast.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 sm:mt-10 flex flex-col items-stretch gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-start">
              <Button
                as={Link}
                href="/signin"
                className="w-full sm:w-auto font-semibold px-6 sm:px-8 h-11 sm:h-12 transition-all duration-200 hover:scale-105 active:scale-100 text-sm sm:text-base"
                color="primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={18} />}
                size="lg"
              >
                Start free trial
              </Button>
              <Button
                as={Link}
                href="#pricing"
                variant="bordered"
                size="lg"
                className="w-full sm:w-auto h-11 sm:h-12 transition-all duration-200 hover:scale-105 active:scale-100 text-sm sm:text-base"
              >
                View pricing
              </Button>
            </div>

            {/* Money Back Guarantee */}
            <div className="mt-6 sm:mt-8">
              <div className="inline-flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm text-default-600">
                <Icon icon="solar:shield-check-bold" width={16} className="text-success sm:w-[18px]" />
                <span className="font-medium">14-day free trial · Cancel anytime</span>
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
            <Card className="relative h-[320px] w-full max-w-[720px] rounded-2xl sm:rounded-3xl bg-gradient-to-br from-muted/40 to-muted/20 p-1 sm:p-1.5 backdrop-blur-sm sm:h-[420px] md:h-[560px] lg:h-[640px] ring-1 ring-default-100">
              <CardBody className="relative size-full rounded-[16px] sm:rounded-[20px] bg-gradient-to-br from-background via-background to-muted/10 overflow-hidden p-2 sm:p-4">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5" />
                <Image
                  alt="Dashboard preview"
                  className="size-full rounded-xl sm:rounded-2xl object-cover transition-transform duration-300 hover:scale-[1.02]"
                  fill
                  priority
                  src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
                  unoptimized
                />
              </CardBody>
            </Card>
          </motion.div>
        </div>

        <div className="mt-16 sm:mt-20 lg:mt-24">
          <p className="text-center text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6 sm:mb-8 px-2">
            Trusted by leading D2C brands
          </p>
          <div className="mx-auto w-full max-w-7xl px-2 sm:px-4">
            <div className="grid grid-cols-3 sm:flex sm:flex-nowrap items-center justify-between gap-4 sm:gap-6 lg:gap-10 text-default-400">
              {d2cBrands.map((brand) => (
                <div
                  key={brand.name}
                  className="flex items-center justify-center opacity-60 transition-all duration-200 hover:opacity-100 hover:scale-105"
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
