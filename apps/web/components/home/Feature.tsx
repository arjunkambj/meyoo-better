"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  LayoutDashboard,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useState } from "react";

import { cn } from "@/libs/utils";

const Feature = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const items = [
    {
      title: "Profit you can trust",
      description:
        "Revenue, ad spend, fees, and returns roll into one daily profit view—no spreadsheets needed.",
      icon: TrendingUp,
    },
    {
      title: "Every channel, one dashboard",
      description:
        "Shopify, Meta, Google, and more live side by side so the whole team works from the same numbers.",
      icon: LayoutDashboard,
    },
    {
      title: "Costs stay accurate",
      description:
        "Set COGS, shipping, and payment fees once. Meyoo applies them automatically to every order.",
      icon: Receipt,
    },
    {
      title: "Alerts before margins slip",
      description:
        "Get nudges when ROAS drops or profit falls so you can fix issues the same day.",
      icon: BellRing,
    },
    {
      title: "Ask the AI copilot",
      description:
        "Type questions like 'Which campaign lost us money yesterday?' and get plain-language answers.",
      icon: Sparkles,
    },
    {
      title: "Built for your whole team",
      description:
        "Invite founders, finance, and agencies with the right permissions and shared dashboards.",
      icon: Users,
    },
  ];

  return (
    <section className="flex w-full items-center justify-center overflow-hidden py-12 sm:py-16 lg:py-20">
      <div className="container mx-auto flex w-full flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <p className="px-4 text-xs uppercase tracking-[0.2em] text-primary/80">
          Why teams choose Meyoo
        </p>
        <h2 className="relative z-20 py-5 text-center font-sans text-4xl font-semibold tracking-tight sm:text-5xl">
          Less guessing, more confident decisions
        </h2>
        <p className="text-md text-muted-foreground mx-auto max-w-2xl text-center lg:text-lg">
          We designed Meyoo for operators who want the real story on profits
          without chasing screenshots from different tools.
        </p>

        <div className="relative mx-auto mt-10 grid w-full max-w-7xl grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="group relative block h-full w-full p-2"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <AnimatePresence mode="wait" initial={false}>
                {hoveredIndex === idx && (
                  <motion.span
                    className="bg-muted-foreground/20 absolute inset-0 block h-full w-full rounded-2xl"
                    layoutId="hoverBackground"
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>

              <Card
                title={item.title}
                description={item.description}
                icon={item.icon}
                className="flex flex-col items-center justify-center"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export { Feature };

const Card = ({
  className,
  title,
  description,
  icon: Icon,
}: {
  className?: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) => {
  return (
    <div
      className={cn(
        "bg-muted relative z-20 flex h-full flex-col items-center justify-center gap-4 rounded-2xl p-5 text-center",
        className
      )}
    >
      <Icon className="text-muted-foreground mt-3 size-8 stroke-1" />
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
};
