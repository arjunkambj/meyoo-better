"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { designSystem } from "@/libs/design-system";

const contactInfo = [
  {
    icon: "solar:letter-bold-duotone",
    title: "Email",
    description: "hey@meyoo.io",
    link: "mailto:hey@meyoo.io",
  },
  {
    icon: "solar:phone-calling-bold-duotone",
    title: "Mobile",
    description: "Coming soon",
  },
];

export default function ContactPage() {
  return (
    <div className={`min-h-screen ${designSystem.background.gradient} pt-28`}>
      {/* Hero Section */}
      <section className={`relative ${designSystem.spacing.section} px-4`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className={designSystem.typography.sectionChip}>
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              Contact Us
            </span>
          </div>
          <h1 className={`${designSystem.typography.sectionTitle} mb-6`}>
            Contact
          </h1>
          <p className={designSystem.typography.sectionSubtitle}>
            Questions about profit tracking? Let us know.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {contactInfo.map((item) => (
              <Card
                key={item.title}
                className={`${designSystem.card.base} rounded-3xl p-1.5 transition-all duration-300 hover:scale-[1.02]`}
              >
                <CardBody className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon
                        className="text-primary"
                        icon={item.icon}
                        width={24}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1 text-foreground">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
                        {item.description}
                      </p>
                      {item.link && (
                        <Link
                          className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1"
                          href={item.link}
                        >
                          Contact via {item.title}
                          <Icon
                            className="w-4 h-4"
                            icon="solar:arrow-right-up-linear"
                          />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
