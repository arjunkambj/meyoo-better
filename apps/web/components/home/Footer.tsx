"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { footerNavigation } from "@/constants/navigation/footerNavigation";

import { Logo } from "@/components/shared/Logo";

const navigationSections = [
  {
    title: "Product",
    links: footerNavigation.product.slice(0, 4),
  },
  {
    title: "Resources",
    links: footerNavigation.resources.slice(0, 4),
  },
  {
    title: "Company",
    links: footerNavigation.company.slice(0, 4),
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
    <section className="bg-background pt-16 md:pt-24 pb-12">
      <div className="container mx-auto">
        <footer>
          {/* CTA Section */}
          <div className="mb-24 rounded-2xl max-w-7xl mx-auto bg-default-100 p-8 md:p-12 lg:p-16">
            <div className="flex flex-col items-center text-center">
              <h2 className="max-w-[800px] text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl lg:text-5xl text-default-900 ">
                Revolutionize Decision Making for your D2C{" "}
                <span className="text-primary relative inline-block">
                  Brand with Meyoo.
                  <span className="bg-primary/20 absolute bottom-1 left-0 h-1 w-full rounded-full"></span>
                </span>
              </h2>
              <p className="mt-4 max-w-[600px] text-lg text-default-600">
                Connect every channel and get real-time clarity on true profit.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button
                  as="a"
                  href="/get-started"
                  size="lg"
                  className="group"
                  variant="solid"
                  color="primary"
                >
                  <span className="flex items-center gap-2">
                    Start 14-day free trial
                    <Icon
                      icon="solar:arrow-right-linear"
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="border-divider grid grid-cols-1 gap-y-10 border-b border-t py-10 lg:grid-cols-[0.4fr_0.6fr] lg:gap-x-16 lg:py-16">
            <div className="max-w-sm">
              <Logo size="md" />
              <p className="mt-4  text-default-600">
                Meyoo centralizes your eCommerce insights so you can act on
                accurate, real-time profitability.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 sm:gap-x-12 lg:gap-x-14">
              {navigationSections.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-5 text-lg font-semibold text-default-900">
                    {section.title}
                  </h3>
                  <ul className="space-y-4">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <a
                          href={link.href}
                          className="inline-block text-default-600 transition-colors duration-200 hover:text-default-900"
                        >
                          {link.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="mx-auto mt-4 py-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <p className="font-medium text-default-600">
                © 2025 Meyoo Inc. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                {socialLinks.map((link) => (
                  <a
                    aria-label={link.label}
                    key={link.href}
                    href={link.href}
                    className="text-default-600 transition-colors hover:text-default-900"
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
