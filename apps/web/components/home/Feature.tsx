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
import { designSystem } from "@/libs/design-system";
import { Icon } from "@iconify/react";

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
    <section
      className={`relative flex w-full items-center justify-center overflow-hidden ${designSystem.spacing.section} ${designSystem.background.gradient}`}
    >
      <div
        className={`${designSystem.spacing.container} flex w-full flex-col items-center justify-center`}
      >
        <div className={designSystem.typography.sectionChip}>
          <Icon icon="solar:star-bold" width={16} className="text-primary/70" />
          <span className="text-xs uppercase tracking-[0.15em] font-medium text-primary/70">
            Why Meyoo
          </span>
        </div>
        <h2 className={`relative z-20 ${designSystem.typography.sectionTitle}`}>
          Make confident decisions daily
        </h2>
        <p className={designSystem.typography.sectionSubtitle}>
          We designed Meyoo for operators who want the real story on profits
          without chasing screenshots from different tools.
        </p>

        <div
          className={`relative mx-auto mt-10 grid w-full max-w-7xl grid-cols-1 ${designSystem.spacing.gap.md} md:grid-cols-2 lg:grid-cols-3`}
        >
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
                    className="absolute inset-0 block h-full w-full rounded-2xl"
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
        `relative z-20 flex h-full ${designSystem.card.base} flex-col items-center justify-center gap-4 rounded-2xl p-6 sm:p-8 text-center backdrop-blur-sm transition-all duration-300`,
        className
      )}
    >
      <Icon className="text-primary/60 mt-3 size-8 stroke-1" />
      <h1 className={designSystem.typography.cardTitle}>{title}</h1>
      <p className={designSystem.typography.cardDescription}>{description}</p>
    </div>
  );
};
