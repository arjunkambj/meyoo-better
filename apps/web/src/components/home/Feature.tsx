"use client";

import { Icon } from "@iconify/react";
import { designSystem } from "@/libs/design-system";

type FeatureCard = {
  id: number;
  icon: string;
  title: string;
  description: string;
  badge: string;
};

const featureData: FeatureCard[] = [
  {
    id: 1,
    icon: "solar:chart-bold-duotone",
    title: "Real Profit Dashboard",
    description:
      "See your actual profit after all expenses in one place. Track revenue, costs, margins, and ROI—no more guessing if you're profitable.",
    badge: "Live Insights",
  },
  {
    id: 2,
    icon: "solar:graph-new-bold-duotone",
    title: "100+ Analytics Metrics",
    description:
      "Track customer behavior, inventory levels, marketing performance, and more. Everything updates automatically from your connected platforms.",
    badge: "Deep Analytics",
  },
  {
    id: 3,
    icon: "solar:chat-round-line-bold-duotone",
    title: "Meyoo AI Copilot",
    description:
      "Chat with an AI that knows your business inside out. Ask questions, get insights, and make data-driven decisions faster than ever.",
    badge: "AI Powered",
  },
  {
    id: 4,
    icon: "solar:box-bold-duotone",
    title: "Track Inventory & Orders",
    description:
      "Monitor stock levels and order fulfillment in real-time. Get alerts when products are running low and track order status from purchase to delivery.",
    badge: "Smart Stock",
  },
  {
    id: 5,
    icon: "solar:link-circle-bold-duotone",
    title: "MCP Integration",
    description:
      "Connect your data to Claude, ChatGPT, and other AI tools via MCP (Model Context Protocol). Your business intelligence follows you everywhere.",
    badge: "AI Tools",
  },
  {
    id: 6,
    icon: "solar:phone-bold-duotone",
    title: "Mobile App",
    description:
      "Access your dashboard anywhere. Check profits, monitor orders, and get real-time alerts on the go. Your entire business in your pocket.",
    badge: "On The Go",
  },
];

const Feature = () => {
  return (
    <section
      className={`relative flex w-full items-center justify-center overflow-hidden ${designSystem.spacing.section} ${designSystem.background.gradient}`}
    >
      <div
        className={`${designSystem.spacing.container} flex w-full flex-col items-center justify-center`}
      >
        <div className={designSystem.typography.sectionChip}>
          <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
            Features
          </span>
        </div>
        <h2 className={`relative z-20 ${designSystem.typography.sectionTitle}`}>
          Everything You Need to Grow
        </h2>
        <p className={`${designSystem.typography.sectionSubtitle} max-w-2xl mx-auto`}>
          Powerful features designed specifically for D2C brands. Track every metric that matters and make data-driven decisions with confidence.
        </p>

        <div className="mx-auto mt-16 grid w-full max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {featureData.map((item) => (
            <article
              key={item.id}
              className={`${designSystem.card.base} group relative flex h-full flex-col rounded-3xl p-1.5 transition-all duration-300 hover:scale-[1.02]`}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center">
                <Icon
                  icon={item.icon}
                  className="text-primary/40 group-hover:text-primary/60 transition-colors duration-300"
                  width={120}
                  height={120}
                />
              </div>
              <div className="mt-5 w-full space-y-3 p-4">
                <div className="inline-block rounded-full bg-primary/10 px-3 py-1">
                  <p className="text-xs uppercase tracking-[0.15em] text-primary font-semibold">
                    {item.badge}
                  </p>
                </div>
                <h3 className="text-xl font-semibold tracking-tight leading-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export { Feature };
