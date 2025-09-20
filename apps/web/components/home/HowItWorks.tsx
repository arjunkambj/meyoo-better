"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import Link from "next/link";

type Step = {
  num: number;
  icon: string;
  title: string;
  description: string;
  highlight?: string;
  brands?: string[];
  items?: string[];
};

const steps: Step[] = [
  {
    num: 1,
    icon: "solar:link-round-angle-linear",
    title: "Connect",
    description: "Link your Shopify store and ad accounts",
    highlight: "2 min setup",
    brands: ["logos:shopify", "logos:meta", "logos:google-icon"],
  },
  {
    num: 2,
    icon: "solar:settings-linear",
    title: "Configure",
    description: "Add your product costs and fees once",
    highlight: "Set & forget",
    items: ["COGS", "Shipping", "Fees"],
  },
  {
    num: 3,
    icon: "solar:graph-linear",
    title: "Analyze",
    description: "See real profit margins instantly",
    highlight: "Live data",
    items: ["True ROAS", "Net profit", "LTV"],
  },
];

export default function HowItWorks({ className }: { className?: string }) {
  return (
    <section className={`relative w-full py-20 bg-background ${className}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12">
        {/* Header */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-6">
            <Icon
              className="text-primary"
              icon="solar:widget-2-bold"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Get Started in 3 Simple Steps
          </h2>
          <p className="text-default-600 max-w-xl mx-auto">
            From connection to insights in minutes
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {steps.map((step, index) => (
            <div
              key={`step-${step.title}-${index}`}
              className={`
                relative group
                ${index === 0 ? "md:col-span-2 md:row-span-1" : ""}
                ${index === 1 ? "md:col-span-1 md:row-span-2" : ""}
                ${index === 2 ? "md:col-span-2 md:row-span-1" : ""}
              `}
            >
              <div className="h-full rounded-2xl bg-content2/50 p-6 transition-all hover:bg-content2/70">
                {/* Step number */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold text-primary/20">
                      {step.num}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <Icon
                        className="text-success"
                        icon={step.icon}
                        width={20}
                      />
                    </div>
                  </div>
                  {step.highlight && (
                    <span className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-md">
                      {step.highlight}
                    </span>
                  )}
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-default-600 text-sm mb-4">
                  {step.description}
                </p>

                {/* Brands or Items */}
                {step.brands && (
                  <div className="flex items-center gap-3 pt-2">
                    {step.brands.map((brand) => (
                      <Icon
                        key={brand}
                        className="text-default-500"
                        icon={brand}
                        width={20}
                      />
                    ))}
                  </div>
                )}

                {step.items && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {step.items.map((item) => (
                      <span
                        key={item}
                        className="text-xs text-default-600 bg-default-100/50 px-2 py-1 rounded-md"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="text-center mt-14"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Button
            as={Link}
            color="primary"
            endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
            href="/signin"
            radius="lg"
            size="lg"
          >
            Get Started
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
