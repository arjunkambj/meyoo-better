"use client";

import Image from "next/image";

import { designSystem } from "@/libs/design-system";

type FeatureCard = {
  id: number;
  img: string;
  title: string;
  description: string;
  badge: string;
};

const featureData: FeatureCard[] = [
  {
    id: 1,
    img: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=1200",
    title: "Profit Pulse dashboard",
    description:
      "See covers, spend, and net margin in one snapshot so you can coach the shift before it ends.",
    badge: "Live Ops",
  },
  {
    id: 2,
    img: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=1200",
    title: "Menu intel, no spreadsheets",
    description:
      "Meyoo surfaces top sellers, low performers, and real food cost so your menu decisions are quick and data backed.",
    badge: "Menu Science",
  },
  {
    id: 3,
    img: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=1200",
    title: "Team pacing alerts",
    description:
      "Notifications keep FOH and BOH aligned on ticket times, so service feels effortless even when slammed.",
    badge: "Guest Flow",
  },
  {
    id: 4,
    img: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&q=80&w=1200",
    title: "Shift recap, auto-delivered",
    description:
      "Every morning you get a digest with labor, sales, and comps so you can make the call before the next service.",
    badge: "Daily Digest",
  },
  {
    id: 5,
    img: "https://images.unsplash.com/photo-1481833761820-0509d3217039?auto=format&fit=crop&q=80&w=1200",
    title: "Inventory that updates itself",
    description:
      "Connect vendors once and Meyoo keeps pars, price changes, and reorder points synced for you.",
    badge: "Smart Stock",
  },
  {
    id: 6,
    img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200",
    title: "Service standards, standardized",
    description:
      "Roll out updated playbooks to every location and watch adoption in real time with task tracking.",
    badge: "Playbooks",
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
          What Makes Meyoo Special
        </h2>
        <p className={designSystem.typography.sectionSubtitle}>
          From setup to scale in three simple steps: connect your tools, unlock insights, and make better decisions to grow your brand.
        </p>

        <div className="mx-auto mt-12 grid w-full max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {featureData.map((item, index) => (
            <article
              key={item.id}
              className={`${designSystem.card.base} group relative flex h-full flex-col rounded-2xl p-4`}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Image
                  src={item.img}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="pointer-events-none object-cover transform transition-transform duration-300 ease-out group-hover:scale-[1.035]"
                  priority={index === 0}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
              </div>
              <div className="mt-4 w-full space-y-3 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  {item.badge}
                </p>
                <h3 className="text-lg font-semibold tracking-tight">
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
