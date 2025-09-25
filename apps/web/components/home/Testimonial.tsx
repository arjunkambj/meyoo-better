"use client";

import React from "react";
import { Avatar } from "@heroui/react";
import { Icon } from "@iconify/react";
import { designSystem } from "@/libs/design-system";

const testimonials = [
  {
    id: "1",
    title: "We spotted bleeding campaigns fast",
    description:
      "Meyoo showed our hero SKU was underwater once returns hit. We tweaked bundles the same day and recovered 18% margin that week.",
    user: {
      name: "Lena Cho",
      location: "Glow Lab Skincare · Austin, TX",
      avatar:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80",
    },
  },
  {
    id: "2",
    title: "Everyone agrees on yesterday's profit",
    description:
      "Our agency and finance team finally look at the same number. Stand-ups went from 45 minutes of debates to a 10-minute review.",
    user: {
      name: "Marcus Reed",
      location: "Trailside Outfitters · Denver, CO",
      avatar:
        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80",
    },
  },
  {
    id: "3",
    title: "No more spreadsheet friday nights",
    description:
      "I used to export Shopify, Meta, and Spendesk just to see profit. Now Meyoo gives that answer when I open my laptop in the morning.",
    user: {
      name: "Priya Natarajan",
      location: "Hearth & Home · Toronto, ON",
      avatar:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80",
    },
  },
];

const Testimonial = () => {
  return (
    <section
      className={`relative flex w-full flex-col items-center justify-center ${designSystem.spacing.section} ${designSystem.background.gradient}`}
    >
      <div className={designSystem.spacing.container}>
        <div className="text-center">
          <div className={designSystem.typography.sectionChip}>
            <Icon
              icon="solar:chat-square-like-bold"
              width={18}
              className="text-primary/70"
            />
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              Customer stories
            </span>
          </div>
        </div>
        <h2 className={designSystem.typography.sectionTitle}>
          Trusted by smart operators
        </h2>
      </div>
      <div
        className={`relative mx-auto mt-12 grid min-h-[28rem] w-full max-w-7xl items-stretch ${designSystem.spacing.gap.md} px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-3`}
      >
        {testimonials.map((testimonial) => (
          <div
            key={testimonial.id}
            className="group relative flex h-full w-full rounded-2xl border border-primary/15 bg-primary/5 p-6 transition-colors duration-300 ease-out sm:p-8 dark:border-default-200/20 dark:bg-gradient-to-br dark:from-default-100/15 dark:via-default-100/10 dark:to-default-200/5 dark:backdrop-blur"
          >
            <div className="relative flex h-full flex-col">
              <div className="mb-5 inline-flex size-10 items-center justify-center rounded-full  text-primary/70 transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/20 group-hover:text-primary dark:text-primary/70">
                <Icon icon="ri:double-quotes-l" width={26} />
              </div>

              <h3 className="mb-5 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                {testimonial.title}
              </h3>

              <div className="mb-8 flex-1">
                <p className="text-base leading-7 italic text-default-700 ">
                  &ldquo;{testimonial.description}&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  src={testimonial.user.avatar}
                  name={testimonial.user.name}
                />
                <div className="space-y-1">
                  <p className="text-base font-semibold text-default-800 ">
                    {testimonial.user.name}
                  </p>
                  <p className="text-sm text-default-700">
                    {testimonial.user.location}
                  </p>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-primary/40 transition-opacity duration-300 group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </section>
  );
};

export { Testimonial };
