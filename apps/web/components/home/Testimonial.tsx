"use client";

import React from "react";
import { Avatar } from "@heroui/react";
import { Icon } from "@iconify/react";

const testimonials = [
  {
    id: "1",
    title: "Very easy to connect ad accounts",
    description:
      "Very fantastic app, it is very easy to connect your ad account and install new pixels. And the support is very fast and helpful.",
    user: {
      name: "Premiumpatikeus",
      location: "Serbia",
      initials: "DDS",
    },
  },
  {
    id: "2",
    title: "Amazing profit tracking",
    description:
      "Meyoo has completely transformed how I track my profits. The integration with my store was seamless and the insights are invaluable.",
    user: {
      name: "Sarah Johnson",
      location: "United States",
      initials: "SJ",
    },
  },
  {
    id: "3",
    title: "Best analytics tool for e-commerce",
    description:
      "The most comprehensive analytics I've found for managing my online store. Everything I need in one place with beautiful visualizations.",
    user: {
      name: "Mike Chen",
      location: "Canada",
      initials: "MC",
    },
  },
];

const Testimonial = () => {
  return (
    <section className="flex w-full flex-col items-center justify-center py-16 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center mb-3 text-primary">Testimonials</p>
        <h1 className="text-center text-5xl font-medium tracking-tight md:text-7xl">
          Happy Customer Stories
        </h1>
      </div>
      <div className="relative mx-auto mt-16 grid min-h-[32rem] w-full max-w-7xl items-stretch gap-6 px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <div
            key={testimonial.id}
            className="bg-muted/70 w-full rounded-3xl p-8"
          >
            <div className="flex flex-col h-full">
              {/* Quote Icon */}
              <div className="mb-4">
                <Icon icon="mdi:quote" className="text-3xl text-primary/60" />
              </div>

              {/* Title */}
              <h3 className="text-2xl font-semibold leading-tight mb-6">
                {testimonial.title}
              </h3>

              {/* Description */}
              <div className="flex-1 mb-8">
                <p className="text-muted-foreground leading-relaxed text-base">
                  {testimonial.description}
                </p>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3">
                <Avatar
                  size="md"
                  name={testimonial.user.initials}
                  className="bg-primary text-primary-foreground"
                />
                <div>
                  <p className="font-medium text-base">
                    {testimonial.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
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
