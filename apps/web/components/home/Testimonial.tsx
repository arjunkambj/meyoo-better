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
            className=" ring-1 bg-primary/5 ring-primary/10 backdrop-blur-sm w-full rounded-2xl p-6 sm:p-8 transition-all duration-300"
          >
            <div className="flex flex-col h-full relative">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-primary/40">
                <Icon icon="ri:double-quotes-l" width={40} />
              </div>

              <h3 className="text-2xl font-semibold text-foreground leading-tight mb-6">
                {testimonial.title}
              </h3>

              <div className="flex-1 mb-8">
                <p className={`$ text-muted-foreground leading-relaxed`}>
                  {testimonial.description}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  src={testimonial.user.avatar}
                  name={testimonial.user.name}
                />
                <div>
                  <p className="font-medium text-base text-default-900">
                    {testimonial.user.name}
                  </p>
                  <p className="text-sm text-default-600">
                    {testimonial.user.location}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export { Testimonial };
