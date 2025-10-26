"use client";

import { Card, CardBody } from "@heroui/card";
import { Icon } from "@iconify/react";
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
    <div className={`min-h-screen ${designSystem.background.gradient} pb-20`}>
      {/* Hero Section */}
      <section className={`relative ${designSystem.spacing.section} px-4 pb-8`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className={`${designSystem.typography.sectionChip} mb-6`}>
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              Contact Us
            </span>
          </div>
          <h1 className={`${designSystem.typography.sectionTitle} mb-8`}>
            Contact
          </h1>
          <p className={`${designSystem.typography.sectionSubtitle} max-w-2xl mx-auto`}>
            Questions about profit tracking? Let us know.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {contactInfo.map((item) => (
              <Card
                key={item.title}
                className={`${designSystem.card.base} rounded-3xl p-1.5 transition-all duration-300 hover:scale-[1.02]`}
              >
                <CardBody className="p-8">
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon
                        className="text-primary"
                        icon={item.icon}
                        width={28}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2 text-foreground">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-base mb-4 leading-relaxed">
                        {item.description}
                      </p>
                      {item.link && (
                        <a
                          className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1.5"
                          href={item.link}
                        >
                          Contact via {item.title}
                          <Icon
                            className="w-4 h-4"
                            icon="solar:arrow-right-up-linear"
                          />
                        </a>
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
