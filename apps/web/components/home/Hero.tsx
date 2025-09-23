"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Button, Card, CardBody } from "@heroui/react";
import Link from "next/link";

const Hero = () => {
  return (
    <section className="relative w-full min-h-[calc(90vh)] flex items-center justify-center overflow-hidden bg-gradient-to-b from-background via-primary/5 to-background pt-[calc(env(safe-area-inset-top)+56px)] sm:pt-[calc(env(safe-area-inset-top)+72px)] md:pt-24 pb-16 sm:pb-24 lg:pb-32">
      <div className="container relative z-10 mx-auto py-16 sm:py-24 lg:py-32">
        <div className="text-center flex flex-col items-center">
          {/* Chip Badge */}
          <div className="inline-flex items-center gap-2.5 bg-default-50 border border-default-100 rounded-full px-5 py-2 mb-3">
            <Icon
              icon="solar:code-scan-bold-duotone"
              width={16}
              className="text-primary"
            />
            <span className="text-sm font-semibold text-primary">
              One Dashboard For Every Metric
            </span>
          </div>

          {/* Header  */}
          <h1 className="text-3xl leading-tight tracking-tighter text-balance sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="font-semibold">
              Track,<span> </span>Manage And{" "}
              <span className="text-primary">Optimize</span>
            </span>
            <br />
            <span className="font-playfair italic">
              Built for <span className="text-primary">D2C</span> Brands.
            </span>
          </h1>

          {/* Professional info */}
          <p className="mt-2 text-base sm:text-lg md:text-xl lg:text-2xl text-default-600 max-w-3xl mx-auto text-balance">
            Forget about outdated spreadsheets, From orders to expenses with 10+
            Integrations. Everything your brand needs in one place
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
              Get Started
            </Button>
            <Button
              className="w-full sm:w-auto font-medium px-6 sm:px-8"
              size="lg"
              variant="bordered"
            >
              Install App
            </Button>
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-6">
            <div className="inline-flex items-center gap-2 text-sm text-default-600">
              <Icon icon="solar:shield-check-bold" width={16} />
              <span>Free 14-Day Trial</span>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 200 }}
          className="px-2"
          animate={{ opacity: 100, y: 0 }}
          transition={{ ease: [0, 0.71, 0.2, 1.01], duration: 0.8 }}
        >
          <Card className="group relative mx-auto mt-12 h-[320px] w-full max-w-7xl rounded-4xl border border-default-200/70 bg-background/70 p-3 shadow-xl shadow-primary/10 backdrop-blur md:h-190">
            <div className="pointer-events-none absolute inset-0 rounded-4xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-80" />
            <CardBody className="relative size-full rounded-3xl border border-default-200/60 bg-gradient-to-br from-background via-content1 to-content2">
              <img
                src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
                className="size-full"
                alt=""
              />
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};

export { Hero };
