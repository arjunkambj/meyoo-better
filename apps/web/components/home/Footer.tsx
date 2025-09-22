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
    <section className="bg-background pt-12 sm:pt-16 md:pt-24 pb-10 sm:pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <footer>
          {/* CTA Section */}
          <div className="mb-16 sm:mb-24 rounded-2xl max-w-7xl mx-auto bg-default-100 p-6 sm:p-8 md:p-12 lg:p-16">
            <div className="flex flex-col items-center text-center gap-5">
              <h2 className="max-w-[800px] text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl md:text-4xl lg:text-5xl text-default-900 ">
                Revolutionize Decision Making for your D2C{" "}
                <span className="text-primary relative inline-block">
                  Brand with Meyoo.
                  <span className="bg-primary/20 absolute bottom-1 left-0 h-1 w-full rounded-full"></span>
                </span>
              </h2>
              <p className="mt-2 max-w-[600px] text-base text-default-600 sm:text-lg">
                Connect every channel and get real-time clarity on true profit.
              </p>
              <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                <Button
                  as="a"
                  href="/get-started"
                  size="lg"
                  className="group w-full sm:w-auto"
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
          <nav className="border-divider grid grid-cols-1 gap-y-8 border-b border-t py-10 sm:gap-y-10 lg:grid-cols-[0.4fr_0.6fr] lg:gap-x-16 lg:py-16">
            <div className="max-w-sm">
              <Logo size="md" />
              <p className="mt-4 text-sm sm:text-base text-default-600">
                Meyoo centralizes your eCommerce insights so you can act on
                accurate, real-time profitability.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3 sm:gap-x-12 lg:gap-x-14">
              {navigationSections.map((section) => (
                <div key={section.title}>
                  <h3 className="mb-3 sm:mb-5 text-base sm:text-lg font-semibold text-default-900">
                    {section.title}
                  </h3>
                  <ul className="space-y-2 sm:space-y-4">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <a
                          href={link.href}
                          className="inline-block text-sm sm:text-base text-default-600 transition-colors duration-200 hover:text-default-900"
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
            <div className="flex flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
              <p className="text-sm sm:text-base font-medium text-default-600">
                © 2025 Meyoo Inc. All rights reserved.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-5 sm:justify-end">
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
