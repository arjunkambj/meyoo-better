"use client";

import React from "react";
import { Avatar } from "@heroui/avatar";
import { Icon } from "@iconify/react";
import { designSystem } from "@/libs/design-system";

const testimonials = [
  {
    id: "1",
    title: "We finally trust every margin call",
    description:
      "Within two weeks we spotted three SKUs that looked profitable in Shopify but were underwater after shipping. Killing them paid for Meyoo twice over.",
    user: {
      name: "Noah Patel",
      location: "CRO, Brightside Apparel",
      avatar:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80",
    },
  },
  {
    id: "2",
    title: "One dashboard for the whole growth squad",
    description:
      "Our merch, finance, and paid teams finally look at the same numbers. Meyoo replaced five spreadsheets and gave us a daily profit standup.",
    user: {
      name: "Jessie Han",
      location: "VP Growth, Kinfield Labs",
      avatar:
        "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80",
    },
  },
  {
    id: "3",
    title: "AI answers what I used to DM the analyst",
    description:
      "The Copilot surfaces blended CAC, refund drag, and cash impact in plain English. I make decisions in minutes instead of waiting for a deck.",
    user: {
      name: "Lena Ortiz",
      location: "COO, Ember Living",
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
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              Testimonial
            </span>
          </div>
        </div>
        <h2 className={designSystem.typography.sectionTitle}>What customers say</h2>
        <p className={designSystem.typography.sectionSubtitle}>Loved by operators and teams.</p>
      </div>
      <div
        className={`relative mx-auto mt-16 grid w-full max-w-7xl items-stretch gap-8 px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-3`}
      >
        {testimonials.map((testimonial) => (
          <article
            key={testimonial.id}
            className={`${designSystem.card.base} group relative flex h-full flex-col rounded-3xl p-1.5 transition-all duration-300 hover:scale-[1.02]`}
          >
            <div className="relative flex h-full flex-col p-6 sm:p-8">
              <div className="mb-5 inline-flex size-10 items-center justify-center rounded-full text-primary/70">
                <Icon icon="ri:double-quotes-l" width={26} />
              </div>

              <h3 className="mb-3 text-xl font-semibold tracking-tight leading-tight">
                {testimonial.title}
              </h3>

              <div className="mb-8 flex-1">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {testimonial.description}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  src={testimonial.user.avatar}
                  name={testimonial.user.name}
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {testimonial.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.user.location}
                  </p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export { Testimonial };
