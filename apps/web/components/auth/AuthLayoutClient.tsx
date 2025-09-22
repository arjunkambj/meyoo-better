"use client";

import { Link } from "@heroui/link";
import { Icon } from "@iconify/react";
import Image from "next/image";
import React from "react";
import { ThemeSwitch } from "@/components/home/ThemeSwitch";
import { Logo } from "@/components/shared/Logo";

const AuthLayoutClient = React.memo(function AuthLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full min-h-dvh w-full bg-background overflow-hidden">
      {/* Minimal background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-64 h-64 bg-gradient-to-br from-primary/3 to-transparent rounded-full blur-[100px] opacity-30" />
        <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-gradient-to-tr from-secondary/3 to-transparent rounded-full blur-[100px] opacity-30" />
      </div>

      {/* Logo */}
      <div className="absolute left-6 top-6 z-50">
        <Link href="/">
          <Logo size="lg" />
        </Link>
      </div>

      {/* Theme Switch */}
      <div className="absolute right-6 top-6 z-50">
        <ThemeSwitch />
      </div>

      {/* Auth Form */}
      <div className="relative z-10 flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-lg">{children}</div>
      </div>

      {/* Right side - Welcome Preview */}
      <div className="hidden w-1/2 p-6 lg:flex">
        <div className="relative flex flex-col justify-end rounded-2xl p-10 w-full bg-content2 dark:bg-content1 overflow-hidden">
          {/* Customer Feedback Card - Bottom Right */}
          <div className="absolute 0 bottom-8 right-8 max-w-sm">
            <div className="bg-background backdrop-blur-lg rounded-xl px-6 py-4 shadow-lg">
              {/* Quote icon */}
              <Icon
                className="text-primary/30 mb-4"
                icon="ri:double-quotes-l"
                width={28}
              />

              {/* Testimonial content */}
              <blockquote className="text-sm text-default-700 leading-relaxed mb-4">
                &ldquo;Meyoo helped us identify unprofitable SKUs we never
                noticed. Cut our ad spend by 40% while maintaining the same
                revenue.&rdquo;
              </blockquote>

              {/* Star rating */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Icon
                    key={`rating-star-${i + 1}`}
                    className="text-primary"
                    icon="solar:star-bold"
                    width={14}
                  />
                ))}
              </div>

              {/* Author section */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                    <Image
                      alt="Sarah Chen"
                      className="w-full h-full rounded-full object-cover"
                      height={48}
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=60"
                      width={48}
                    />
                  </div>
                  <Icon
                    className="absolute -bottom-1 -right-1 text-success bg-background rounded-full border border-background"
                    icon="solar:verified-check-bold"
                    width={16}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">
                    Sarah Chen
                  </p>
                  <p className="text-xs text-default-500">
                    CEO, Fashion Forward Co.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AuthLayoutClient;
