"use client";

import { Card, CardBody, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { designSystem } from "@/libs/design-system";
import CTAButton from "@/components/home/components/CTAButton";

const values = [
  {
    icon: "solar:shield-check-bold",
    title: "Privacy First",
    description: "Bank-level encryption. Your data stays yours.",
  },
  {
    icon: "solar:rocket-2-bold",
    title: "Real-Time",
    description: "Instant profit tracking. No delays.",
  },
  {
    icon: "solar:heart-bold",
    title: "Customer Focus",
    description: "Built from real merchant feedback.",
  },
];

const milestones = [
  { year: "2023", event: "Founded" },
  { year: "2024", event: "50+ beta users" },
  { year: "2024", event: "Seed funding" },
  { year: "2025", event: "500+ stores" },
];

export default function AboutPage() {
  return (
    <div className={`min-h-screen ${designSystem.background.gradient} pt-28`}>
      {/* Hero Section */}
      <section className={`relative ${designSystem.spacing.section} px-4`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className={designSystem.typography.sectionChip}>
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              About
            </span>
          </div>
          <h1 className={`${designSystem.typography.sectionTitle} mb-6`}>
            Real Profit Intelligence
          </h1>
          <p className={designSystem.typography.sectionSubtitle}>
            Helping e-commerce brands track what really matters.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Our Story */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-foreground">Our Story</h2>
            <Card className={`${designSystem.card.base} rounded-3xl p-1.5`}>
              <CardBody className="p-8">
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    We spent years in spreadsheets trying to calculate real
                    profits after ad spend, shipping, and fees.
                  </p>
                  <p>
                    Revenue dashboards were everywhere. Profit intelligence was
                    nowhere.
                  </p>
                  <p>
                    So we built Meyoo - the profit tracking platform we wished
                    we had.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          <Divider className="my-12 bg-default-100" />

          {/* Our Values */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-foreground">Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {values.map((value) => (
                <Card
                  key={value.title}
                  className={`${designSystem.card.base} rounded-3xl p-1.5 transition-all duration-300 hover:scale-[1.02]`}
                >
                  <CardBody className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon
                        className="text-primary"
                        icon={value.icon}
                        width={24}
                      />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {value.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {value.description}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <Divider className="my-12 bg-default-100" />

          {/* Timeline */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-foreground">Timeline</h2>
            <div className="space-y-4">
              {milestones.map((milestone) => (
                <div
                  key={`${milestone.year}-${milestone.event}`}
                  className={`${designSystem.card.base} flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 hover:scale-[1.01]`}
                >
                  <div className="w-16 text-primary font-bold">
                    {milestone.year}
                  </div>
                  <Divider className="h-6 bg-default-100" orientation="vertical" />
                  <p className="text-muted-foreground">{milestone.event}</p>
                </div>
              ))}
            </div>
          </div>

          <Divider className="my-12 bg-default-100" />

          {/* Company Info */}
          <div className="mb-12">
            <Card className={`${designSystem.card.base} rounded-3xl p-1.5`}>
              <CardBody className="p-8">
                <h3 className="font-semibold text-foreground mb-4">Company</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Pyro Labs Private Limited
                  <br />
                  Operating as Meyoo
                  <br />
                  Noida, India
                </p>
              </CardBody>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Card className={`${designSystem.card.base} rounded-3xl p-1.5`}>
              <CardBody className="p-8">
                <h3 className="text-2xl font-bold mb-3 text-foreground">
                  Ready to track real profit?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Join 500+ stores using Meyoo.
                </p>
                <CTAButton endIcon="solar:arrow-right-bold" href="/auth">
                  Get Started
                </CTAButton>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
