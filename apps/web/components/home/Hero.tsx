"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Button, Card, CardBody } from "@heroui/react";

const Hero = () => {
  return (
    <section className="relative w-full min-h-[calc(90vh)] flex items-center justify-center bg-background overflow-hidden pt-[calc(env(safe-area-inset-top)+56px)] sm:pt-[calc(env(safe-area-inset-top)+72px)] md:pt-10">
      <div className="container py-20 md:py-28 lg:py-36 mx-auto">
        <div className="text-center flex flex-col items-center">
          {/* Chip Badge */}
          <div className="inline-flex items-center gap-2.5 bg-default-200/50 border border-default-100  rounded-full px-5 py-2 mb-3">
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
          <h1 className="text-5xl leading-tight tracking-tighter md:text-6xl lg:text-7xl">
            <span className="font-semibold">Track, Manage, and Optimize</span>
            <br />
            <span className="font-playfair italic">Built for D2C Brands.</span>
          </h1>

          {/* Professional info */}
          <p className="mt-4 md:mt-6 text-lg md:text-xl lg:text-2xl text-default-600 max-w-3xl mx-auto">
            Forget about outdated spreadsheets, From orders to expenses with 10+
            Integrations. Everything your brand needs in one place
          </p>
          {/* CTA Buttons */}
          <div className="mt-8 md:mt-10 lg:mt-12 flex flex-col items-center gap-4 md:flex-row">
            <Button
              className="font-semibold px-8"
              color="primary"
              endContent={<Icon icon="solar:arrow-right-linear" width={20} />}
              size="lg"
              variant="shadow"
            >
              Start Tracking
            </Button>
            <Button className="font-medium px-8" size="lg" variant="bordered">
              Watch Demo
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
          animate={{ opacity: 100, y: 0 }}
          transition={{ ease: [0, 0.71, 0.2, 1.01], duration: 0.8 }}
        >
          <Card className="group mx-auto mt-16  h-100 w-full rounded-4xl border border-default-200 bg-content2/30 p-2 shadow-none md:h-190 md:p-3">
            <CardBody className="size-full rounded-3xl border-2 border-background bg-content2">
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
