"use client";

import { Link } from "@heroui/react";
import { Icon } from "@iconify/react";

import { Logo } from "@/components/shared/Logo";
import { footerNavigation } from "@/constants/navigation/footerNavigation";

const footerSections = [
  {
    title: "Quick Links",
    links: footerNavigation.main.filter(
      (item) => item.name !== "Features" && item.name !== "Integrations",
    ),
  },
  {
    title: "Legal",
    links: footerNavigation.legal,
  },
];

export default function Footer() {
  return (
    <footer className="relative bg-background border-t border-divider overflow-hidden">
      {/* Section background unify */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Thin 1px gradient line at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent dark:via-primary/25" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[360px] rounded-full bg-gradient-to-t from-primary/3 to-transparent dark:from-primary/5 opacity-50 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-8 lg:px-12 py-12">
        {/* Main footer content */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-8">
          {/* Logo and description */}
          <div className="md:col-span-2">
            <div className="flex items-center">
              <Logo size="lg" />
            </div>
            <p className="mt-4 text-sm leading-6 text-default-600 max-w-sm">
              Know your real profit. Connect Shopify + ad platforms and see
              margins in real time.
            </p>
            {/* Social links */}
            <div className="mt-6 flex space-x-4">
              {footerNavigation.social.map((item) => (
                <Link
                  key={item.name}
                  isExternal
                  className="text-default-500 hover:text-primary transition-colors"
                  href={item.href}
                >
                  <span className="sr-only">{item.name}</span>
                  <Icon className="h-6 w-6" icon={item.icon} />
                </Link>
              ))}
            </div>
          </div>

          {/* Navigation sections */}
          {footerSections.map((section) => (
            <div key={section.title} className="col-span-1 md:ml-4">
              <h3 className="text-sm font-semibold leading-6 text-foreground mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((item) => (
                  <li key={item.name}>
                    <Link
                      className="text-sm leading-6 text-default-600 hover:text-primary transition-colors"
                      href={item.href}
                      size="sm"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="mt-12 border-t border-divider pt-8">
          <div className="flex justify-center">
            {/* Copyright */}
            <p className="text-xs text-default-500">
              &copy; 2025 Meyoo Inc. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
