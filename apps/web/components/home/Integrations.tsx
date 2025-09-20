"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import Link from "next/link";

const allIntegrations = [
  {
    name: "Shopify",
    icon: "logos:shopify",
    category: "E-commerce",
    status: "available",
  },
  {
    name: "Meta Ads",
    icon: "logos:meta-icon",
    category: "Marketing",
    status: "available",
  },
  {
    name: "Google Ads",
    icon: "logos:google-ads",
    category: "Marketing",
    status: "available",
  },
  {
    name: "Amazon",
    icon: "simple-icons:amazon",
    category: "E-commerce",
    status: "coming-soon",
    iconColor: "text-orange-500",
  },
  {
    name: "Shiprocket",
    icon: "tabler:rocket",
    category: "Logistics",
    status: "coming-soon",
    iconColor: "text-purple-500",
  },
  {
    name: "Snapchat Ads",
    icon: "simple-icons:snapchat",
    category: "Marketing",
    status: "coming-soon",
    iconColor: "text-yellow-400",
  },
];

export default function Integrations({ className }: { className?: string }) {
  return (
    <section
      className={`relative w-full py-24 bg-background overflow-hidden ${className}`}
    >
      {/* Section background unify */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Thin 1px gradient line at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent dark:via-primary/25" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 lg:px-12">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-6">
            <Icon
              className="text-primary"
              icon="solar:widget-6-bold"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              Integrations
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">Connect Shopify + Ads</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Your data, one source of truth.
            </span>
          </h2>
          <p className="text-lg text-default-600 max-w-2xl mx-auto">
            One-click connect, automatic sync. Orders, ad spend, fees—all
            unified so Meyoo can calculate real profit.
          </p>
        </motion.div>

        {/* All Integrations - simplified animations */}
        <motion.div
          className="relative mb-20"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
            {allIntegrations.map((item, idx) => {
              const isAvailable = item.status === "available";

              return (
                <motion.div
                  key={`integration-${item.name}-${idx}`}
                  className="group relative flex flex-col items-center rounded-xl p-6 md:p-7 border border-divider bg-content1/60 dark:bg-content1/30 backdrop-blur-sm transition-all duration-200 min-h-[200px] md:min-h-[220px]"
                >
                  {/* Icon with simple background */}
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-default-100/70 dark:bg-default-100/40 flex items-center justify-center mb-3.5 md:mb-4">
                    <Icon
                      aria-label={item.name}
                      className={item.iconColor || ""}
                      icon={item.icon}
                      width={32}
                    />
                  </div>

                  {/* Title */}
                  <h4 className="text-base md:text-lg font-semibold tracking-tight text-foreground text-center mb-2">
                    {item.name}
                  </h4>

                  {/* Category */}
                  <p className="text-sm text-default-600 text-center mb-3">
                    {item.category}
                  </p>

                  {/* Status */}
                  <div className="mt-auto">
                    <div
                      className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[11px] md:text-xs font-medium transition-all duration-200 ${
                        isAvailable
                          ? "bg-primary text-white ring-2 ring-primary/20"
                          : "bg-warning/10 text-warning border border-warning/30"
                      }`}
                    >
                      {isAvailable ? "Ready" : "Coming Soon"}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* CTA Section - simple and clean */}
        <motion.div
          className="mt-16 md:mt-20 bg-content1/70 dark:bg-content1/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 md:p-10 border border-divider relative overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10 dark:ring-white/5" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Stop Juggling Spreadsheets
              </h3>
              <p className="text-sm sm:text-base text-default-600">
                All your e-commerce data, unified. All your profits, visible.
              </p>
            </div>
            <Button
              as={Link}
              color="primary"
              endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
              href="/signin"
              radius="lg"
              size="lg"
              variant="solid"
            >
              Get Started
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
