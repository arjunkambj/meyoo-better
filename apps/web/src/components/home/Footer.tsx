"use client";

import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";

import { footerNavigation } from "@/constants/navigation/footerNavigation";

import { Logo } from "@/components/shared/Logo";
import { designSystem } from "@/libs/design-system";
import Link from "next/link";
import type { Route } from "next";

const navigationSections = [
  {
    title: "Product",
    links: footerNavigation.product.slice(0, 4),
  },
  {
    title: "Company",
    links: footerNavigation.company.slice(0, 4),
  },
  {
    title: "Legal",
    links: footerNavigation.legal.slice(0, 5),
  },
];

const socialLinks = [
  { icon: "ri:twitter-x-line", href: "https://x.com/meyoo", label: "X" },
  {
    icon: "mdi:linkedin",
    href: "https://linkedin.com/company/meyoo",
    label: "LinkedIn",
  },
  {
    icon: "ic:baseline-discord",
    href: "https://discord.gg/meyoo",
    label: "Discord",
  },
  { icon: "mdi:youtube", href: "https://youtube.com/@meyoo", label: "YouTube" },
];

const Footer = () => {
  return (
    <section
      className={`relative pt-20 pb-16 sm:pt-24`}
    >
      <div className={designSystem.spacing.container}>
        <footer>
          {/* CTA Section */}
          <div
            className={`mb-16 sm:mb-24 rounded-2xl max-w-7xl mx-auto p-8 sm:p-10 md:p-12 lg:p-16 transition-all duration-300 ${designSystem.card.base}`}
          >
            <div className="flex flex-col items-center text-center gap-5">
              <h2 className="max-w-[700px] text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl text-foreground">
                Revolutionize decision‑making for your D2C brand with Meyoo.
              </h2>
              <p className="max-w-[600px] text-base text-muted-foreground sm:text-lg">
                Know your profit. Move faster. Grow smarter.
              </p>
              <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                <Button
                  as={Link}
                  href="/signin"
                  size="lg"
                  className="group w-full sm:w-auto font-medium"
                  variant="solid"
                  color="primary"
                >
                  <span className="flex items-center gap-2">
                    Start 28-day trial
                    <Icon
                      icon="solar:arrow-right-linear"
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Button>
                <Button
                  as="a"
                  href="mailto:hey@meyoo.io"
                  size="lg"
                  className="w-full sm:w-auto font-medium"
                  variant="bordered"
                  color="default"
                >
                  Email hey@meyoo.io
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="border-default-200 grid grid-cols-1 gap-y-8 border-b border-t py-10 sm:gap-y-10 lg:grid-cols-[0.4fr_0.6fr] lg:gap-x-16 lg:py-16">
            <div className="max-w-sm">
              <Logo size="md" />
              <p className="mt-4 text-sm sm:text-base text-muted-foreground">
                Meyoo centralizes your eCommerce insights so you can act on
                accurate, real-time profitability.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3 sm:gap-x-12 lg:gap-x-14">
              {navigationSections.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-3 sm:mb-5 text-base sm:text-lg font-semibold text-foreground">
                    {section.title}
                  </h3>
                  <ul className="space-y-2 sm:space-y-4">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        {link.href?.startsWith("/") ? (
                          <Link
                            href={link.href as Route}
                            className="inline-block text-sm sm:text-base text-muted-foreground transition-colors duration-300 hover:text-primary"
                          >
                            {link.name}
                          </Link>
                        ) : (
                          <a
                            href={link.href || "#"}
                            className="inline-block text-sm sm:text-base text-muted-foreground transition-colors duration-300 hover:text-primary"
                          >
                            {link.name}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="mx-auto mt-4 pt-8">
            <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
              <p className="text-sm sm:text-base text-muted-foreground">
                © 2025 Meyoo Inc. All rights reserved.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-5 sm:justify-end">
                {socialLinks.map((link) => (
                  <a
                    aria-label={link.label}
                    key={link.href}
                    href={link.href}
                    className="text-muted-foreground transition-all duration-300 hover:text-primary hover:scale-110"
                  >
                    <Icon
                      icon={link.icon}
                      width={20}
                      className="transition-transform hover:scale-110"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
};

export { Footer };
