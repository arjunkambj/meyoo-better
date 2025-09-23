"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BrushCleaning,
  Clock,
  CodeXml,
  Plug2,
  Snowflake,
  Zap,
} from "lucide-react";
import React, { useState } from "react";

import { cn } from "@/libs/utils";

const Feature = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const items = [
    {
      title: "Plug & Play",
      description:
        "Ready to use components that work out of the box with no configuration ",
      icon: Plug2,
    },
    {
      title: "Customizable",
      description:
        "Fully customizable components with clean, maintainable code structure",
      icon: CodeXml,
    },
    {
      title: "Design Control",
      description:
        "Complete control over styling and animations with modern  patterns",
      icon: Snowflake,
    },
    {
      title: "Regular Updates",
      description:
        "Continuously updated with new features, improvements and fixes",
      icon: Clock,
    },
    {
      title: "Clean Code",
      description:
        "Well-structured, readable code following industry best practices",
      icon: BrushCleaning,
    },
    {
      title: "Performance",
      description:
        "Optimized for speed and efficiency without compromising functionality",
      icon: Zap,
    },
    {
      title: "Performance",
      description:
        "Optimized for speed and efficiency without compromising functionality",
      icon: Zap,
    },
    {
      title: "Performance",
      description:
        "Optimized for speed and efficiency without compromising functionality",
      icon: Zap,
    },
  ];

  return (
    <section className="flex w-full items-center justify-center overflow-hidden py-16 sm:py-24 lg:py-32">
      <div className="container mx-auto flex w-full flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <p className="px-4 text-xs uppercase text-primary">
          Meyoo's Benefits
        </p>
        <h2 className="relative z-20 py-5 text-center font-sans text-5xl font-semibold tracking-tighter  lg:text-6xl">
          The Ultimate Block Toolkit
        </h2>
        <p className="text-md text-muted-foreground mx-auto max-w-xl text-center lg:text-lg">
          Perfectly balanced between performance and customization.
        </p>

        <div className="relative mx-auto mt-12 grid w-full max-w-7xl grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-4">
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
