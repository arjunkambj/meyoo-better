"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Button, Card, CardBody } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";

const Hero = () => {
  return (
    <section className="relative w-full min-h-[calc(90vh)] flex items-center justify-center overflow-hidden bg-gradient-to-b from-background via-primary/5 to-background pt-[calc(env(safe-area-inset-top)+56px)] sm:pt-[calc(env(safe-area-inset-top)+72px)] md:pt-20 pb-12 sm:pb-16 lg:pb-20 dark:via-primary/15">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-55 dark:opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(99,102,241,0.18), rgba(15,23,42,0) 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-50 dark:opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "140px 140px",
          }}
        />
        <div className="absolute left-1/2 top-[10%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl opacity-70 dark:bg-primary/25" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/90 to-transparent" />
      </div>
      <div className="container relative z-10 mx-auto py-12 sm:py-16 lg:py-20">
        <div className="text-center flex flex-col items-center">
          {/* Chip Badge */}
          <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-white/10 border border-white/40 dark:border-white/10 rounded-full px-4 py-1.5 mb-4 backdrop-blur">
            <Icon
              icon="solar:target-bold-duotone"
              width={18}
              className="text-primary"
            />
            <span className="text-sm font-semibold text-primary">
              Finally see today&apos;s profit
            </span>
          </div>

          {/* Header  */}
          <h1 className="text-3xl leading-tight tracking-tighter text-balance sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="font-semibold">
              See,<span> </span>Measure And{" "}
              <span className="text-primary">Grow Profit</span>
            </span>
            <br />
            <span className="font-playfair italic">
              Built for <span className="text-primary">D2C</span> brands.
            </span>
          </h1>

          {/* Professional info */}
          <p className="mt-2 text-base sm:text-lg md:text-xl text-default-600 max-w-2xl mx-auto text-balance">
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
          <Card className="group relative mx-auto mt-12 h-[320px] w-full max-w-7xl rounded-4xl border border-default-200/70 bg-background/70 p-3 shadow-sm shadow-primary/10 backdrop-blur md:h-190">
            <div className="pointer-events-none absolute inset-0 rounded-4xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-80" />
            <CardBody className="relative size-full rounded-3xl border border-default-200/60 bg-gradient-to-br from-background via-content1 to-content2">
              <Image
                alt="Dashboard preview"
                className="size-full rounded-3xl object-cover"
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
