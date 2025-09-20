"use client";

import { Card, CardBody, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";

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
    <div className="min-h-screen bg-background pt-28">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Icon
              className="text-primary"
              icon="solar:buildings-bold"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              About
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Real Profit Intelligence</h1>
          <p className="text-xl text-default-600">
            Helping e-commerce brands track what really matters.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Our Story */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Our Story</h2>
            <Card className="bg-content1 border border-divider rounded-2xl">
              <CardBody className="p-8">
                <div className="space-y-4 text-default-700">
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

          <Divider className="my-12" />

          {/* Our Values */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {values.map((value) => (
                <Card
                  key={value.title}
                  className="bg-content1 border border-divider rounded-2xl"
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
                    <p className="text-sm text-default-600">
                      {value.description}
                    </p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <Divider className="my-12" />

          {/* Timeline */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Timeline</h2>
            <div className="space-y-4">
              {milestones.map((milestone) => (
                <div
                  key={`${milestone.year}-${milestone.event}`}
                  className="flex items-center gap-4 p-4 bg-content1 border border-divider rounded-xl"
                >
                  <div className="w-16 text-primary font-bold">
                    {milestone.year}
                  </div>
                  <Divider className="h-6" orientation="vertical" />
                  <p className="text-default-700">{milestone.event}</p>
                </div>
              ))}
            </div>
          </div>

          <Divider className="my-12" />

          {/* Company Info */}
          <div className="mb-12">
            <Card className="bg-content1 border border-divider rounded-2xl">
              <CardBody className="p-8">
                <h3 className="font-semibold text-foreground mb-4">Company</h3>
                <p className="text-default-600 text-sm">
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
            <div className="bg-content1 border border-divider rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-3">
                Ready to track real profit?
              </h3>
              <p className="text-default-600 mb-6">
                Join 500+ stores using Meyoo.
              </p>
              <CTAButton endIcon="solar:arrow-right-bold" href="/auth">
                Get Started
              </CTAButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
