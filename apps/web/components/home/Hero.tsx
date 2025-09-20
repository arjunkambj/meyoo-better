"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative w-full min-h-[calc(90vh)] flex items-center justify-center bg-background overflow-hidden pt-[calc(env(safe-area-inset-top)+64px)] sm:pt-[calc(env(safe-area-inset-top)+72px)] md:pt-20">
      {/* Sophisticated background system */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-background to-blue-50/20 dark:from-indigo-950/10 dark:via-background dark:to-blue-950/10" />

        {/* Floating orbs - positioned strategically */}
        <div
          className="absolute top-1/4 left-1/3 w-64 h-64 bg-primary/5 rounded-full blur-2xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-secondary/4 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "6s", animationDelay: "2s" }}
        />

        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiIHJlc3VsdD0ibm9pc2UiLz48ZmVDb2xvck1hdHJpeCBpbj0ibm9pc2UiIHR5cGU9InNhdHVyYXRlIiB2YWx1ZXM9IjAiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI25vaXNlKSIgb3BhY2l0eT0iMC4xIi8+PC9zdmc+')] bg-repeat" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 lg:px-12 pt-3 sm:pt-8 md:pt-16 lg:pt-20 pb-12 sm:pb-16 md:pb-20">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 md:gap-16 lg:gap-20 xl:gap-24 items-center">
          {/* Left: Content */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-4">
              <Icon
                className="text-primary"
                icon="solar:chart-square-bold"
                width={16}
              />
              <span className="text-sm font-semibold text-default-700">
                Shopify + Ads · Profit clarity
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-[1.1]">
              Know Your{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Real Profit
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg md:text-xl text-default-600 mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Connect Shopify and Meta/Google Ads. Meyoo shows true margins in
              real time&mdash;no spreadsheets, no guesswork.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              <Button
                as={Link}
                className="font-semibold"
                color="primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={20} />}
                href="/signin"
                size="lg"
                variant="shadow"
              >
                Start Free Trial
              </Button>
              <Button
                as={Link}
                className="font-medium"
                href="#demo"
                size="lg"
                variant="bordered"
              >
                Install App
              </Button>
            </div>

            {/* Trust claims — minimal, two items, single line on all breakpoints */}
            <div className="flex items-center justify-center lg:justify-start gap-x-6 sm:gap-x-8 text-sm sm:text-base flex-nowrap">
              <div className="inline-flex items-center gap-2 shrink-0">
                <Icon
                  className="text-warning"
                  icon="solar:star-linear"
                  width={18}
                />
                <span className="font-semibold text-foreground">4.9/5</span>
                <span className="text-default-500">· 500+ founders</span>
              </div>
              <div className="inline-flex items-center gap-2 shrink-0">
                <Icon
                  className="text-primary"
                  icon="solar:coins-linear"
                  width={18}
                />
                <span className="font-semibold text-foreground">$10M+</span>
                <span className="text-default-500">revenue tracked</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Clean Visual */}
          <motion.div
            className="relative hidden md:flex justify-center lg:justify-end"
            initial={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            {/* Professional Stats Display */}
            <div className="relative">
              {/* Main metric showcase */}
              <div className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-3xl px-6 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-6 sm:py-8 md:py-10 lg:py-12 shadow-lg w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
                <div className="text-center">
                  {/* Profit amount */}
                  <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-3 sm:mb-4 md:mb-5 lg:mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent leading-none">
                    $24.8K
                  </div>

                  {/* Growth indicator */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-success/10 rounded-full px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
                      <Icon
                        className="text-success"
                        icon="solar:alt-arrow-up-bold"
                        width={16}
                      />
                      <span className="text-success font-bold text-sm sm:text-base md:text-lg lg:text-xl">
                        +32.4%
                      </span>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="text-default-500 text-sm sm:text-base md:text-lg lg:text-xl font-medium">
                    Net Profit This Month
                  </div>
                </div>
              </div>

              {/* Key metric cards - enhanced size */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                className="absolute -top-3 sm:-top-4 md:-top-6 -left-6 sm:-left-8 md:-left-12 bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg ring-1 ring-white/10 dark:ring-white/5 hidden sm:block"
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-default-100/80 dark:bg-default-100/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/10 dark:ring-white/5">
                    <Icon
                      className="text-primary"
                      icon="solar:diagram-up-bold"
                      width={16}
                    />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm text-primary font-semibold">
                      Revenue
                    </div>
                    <div className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground">
                      $84.2K
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                className="absolute -bottom-3 sm:-bottom-4 md:-bottom-6 -right-6 sm:-right-8 md:-right-12 bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-lg ring-1 ring-white/10 dark:ring-white/5 hidden sm:block"
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 2,
                }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl bg-default-100/80 dark:bg-default-100/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/10 dark:ring-white/5">
                    <Icon
                      className="text-success"
                      icon="solar:graph-up-bold"
                      width={16}
                    />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm text-success font-semibold">
                      Margin
                    </div>
                    <div className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground">
                      29.4%
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Platform badges - cleaner positioning */}
              <motion.div
                animate={{ x: [0, 3, 0] }}
                className="absolute top-6 sm:top-8 md:top-12 -right-6 sm:-right-8 md:-right-12 bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 shadow-lg ring-1 ring-white/10 dark:ring-white/5 hidden md:block"
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
              >
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg bg-default-100/80 dark:bg-default-100/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/10 dark:ring-white/5">
                    <Icon
                      className="text-[#95BF47]"
                      icon="logos:shopify"
                      width={14}
                    />
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    Shopify
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ x: [0, -3, 0] }}
                className="absolute top-16 sm:top-20 md:top-28 -left-6 sm:-left-8 md:-left-12 bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 shadow-lg ring-1 ring-white/10 dark:ring-white/5 hidden md:block"
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 3,
                }}
              >
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg bg-default-100/80 dark:bg-default-100/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/10 dark:ring-white/5">
                    <Icon
                      className="text-[#4285F4]"
                      icon="logos:google-ads"
                      width={14}
                    />
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    Google Ads
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -4, 0] }}
                className="absolute bottom-16 sm:bottom-20 md:bottom-28 -right-6 sm:-right-8 md:-right-10 bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 shadow-lg ring-1 ring-white/10 dark:ring-white/5 hidden md:block"
                transition={{
                  duration: 7,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 4,
                }}
              >
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-md sm:rounded-lg bg-default-100/80 dark:bg-default-100/40 backdrop-blur-md flex items-center justify-center ring-1 ring-white/10 dark:ring-white/5">
                    <Icon
                      className="text-blue-600"
                      icon="simple-icons:meta"
                      width={14}
                    />
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    Meta
                  </div>
                </div>
              </motion.div>

              {/* Clean shadow only */}
              <div className="absolute inset-0 rounded-3xl -z-10" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
