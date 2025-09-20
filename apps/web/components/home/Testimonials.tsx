"use client";

import { Avatar, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import Link from "next/link";

const testimonials = [
  {
    content:
      "Found three products losing money after ad costs. Paused campaigns and saved $15K in three months.",
    author: "Sarah Martinez",
    role: "Founder",
    company: "Beauty Brand",
    avatar: "https://i.pravatar.cc/100?img=1",
    metrics: {
      primary: "$15K Saved",
      secondary: "in 3 months",
    },
  },
  {
    content:
      "Discovered our best campaign was actually unprofitable after shipping costs. Fixed targeting and increased profit 22%.",
    author: "David Kim",
    role: "CEO",
    company: "Outdoor Gear",
    avatar: "https://i.pravatar.cc/100?img=2",
    metrics: {
      primary: "+22% Profit",
      secondary: "first month",
    },
  },
  {
    content:
      "Replaced 6 hours of Excel reports with 2-minute dashboards. Now we catch issues before they become problems.",
    author: "Emma Thompson",
    role: "Operations",
    company: "Home Goods",
    avatar: "https://i.pravatar.cc/100?img=3",
    metrics: {
      primary: "6hr → 2min",
      secondary: "reporting time",
    },
  },
];

export default function Testimonials({ className }: { className?: string }) {
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
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-6">
            <Icon className="text-primary" icon="solar:star-bold" width={16} />
            <span className="text-sm font-semibold text-default-700">
              Real Results
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">How Brands Found</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Hidden Profits
            </span>
          </h2>
          <p className="text-lg text-default-600 max-w-2xl mx-auto">
            Real stores, real results.
          </p>
        </motion.div>

        {/* Testimonials Grid - Clean cards */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {testimonials.map((testimonial, index) => (
            <div
              key={`testimonial-${testimonial.author}-${index}`}
              className="group"
            >
              <div className="h-full flex flex-col bg-content1/70 dark:bg-content1/40 backdrop-blur-md rounded-2xl p-8 border border-divider transition-colors duration-300 relative overflow-hidden">
                {/* Subtle inner highlight */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/5 dark:ring-white/10" />

                {/* Quote icon */}
                <Icon
                  className="text-primary/20 mb-4 relative z-10"
                  icon="ri:double-quotes-l"
                  width={32}
                />

                {/* Testimonial content */}
                <blockquote className="text-default-700 leading-relaxed mb-6 flex-grow relative z-10">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>

                {/* Metric highlight */}
                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/15 dark:to-secondary/15 rounded-2xl p-4 mb-6 relative z-10 border border-divider/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        {testimonial.metrics.primary}
                      </p>
                      <p className="text-sm text-default-600">
                        {testimonial.metrics.secondary}
                      </p>
                    </div>
                    <Icon
                      className="text-success"
                      icon="solar:verified-check-bold"
                      width={20}
                    />
                  </div>
                </div>

                {/* Author section */}
                <div className="flex items-center gap-3 relative z-10">
                  <Avatar
                    className="border-2 border-divider"
                    name={testimonial.author}
                    size="md"
                    src={testimonial.avatar}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {testimonial.author}
                    </p>
                    <p className="text-xs text-default-500">
                      {testimonial.role} • {testimonial.company}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Icon
                          key={`testimonial-star-${testimonial.author}-${i + 1}`}
                          className="text-primary"
                          icon="solar:star-bold"
                          width={10}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Social Proof CTA - simple and clean */}
        <motion.div
          className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 md:p-10 border border-divider relative overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10 dark:ring-white/5" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Ready to Find Your Hidden Profits?
              </h3>
              <p className="text-sm sm:text-base text-default-600 mb-2 md:mb-4">
                Join 500+ stores tracking real profit
              </p>
            </div>
            <Button
              as={Link}
              color="primary"
              endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
              href="/auth"
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
