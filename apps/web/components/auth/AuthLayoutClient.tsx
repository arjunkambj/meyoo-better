"use client";

import Link from "next/link";
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
    <div className={`relative flex h-full min-h-dvh w-full overflow-hidden`}>
      {/* Enhanced background decoration */}

      {/* Logo */}
      <div className="absolute left-4 sm:left-6 top-4 sm:top-6 z-50">
        <Link href="/">
          <Logo size="lg" />
        </Link>
      </div>

      {/* Theme Switch */}
      <div className="absolute right-4 sm:right-6 top-4 sm:top-6 z-50">
        <ThemeSwitch />
      </div>

      {/* Auth Form */}
      <div className="relative z-10 flex w-full items-center justify-center py-4 sm:p-6 lg:w-1/2">
        <div className="w-full max-w-lg">{children}</div>
      </div>

      {/* Right side - Welcome Preview */}
      <div className="hidden w-1/2 p-8 lg:flex">
        <div className="relative flex flex-col justify-end rounded-3xl p-12 w-full border border-default-100 bg-gradient-to-br from-muted/90 to-muted/70 backdrop-blur-md overflow-hidden">
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 pointer-events-none" />

          {/* Customer Feedback Card - Bottom Right */}
          <div className="absolute bottom-10 right-10 max-w-md z-10">
            <div className="bg-background/95 backdrop-blur-xl rounded-3xl px-8 py-7 ring-1 ring-default-100 transition-all duration-300 hover:scale-[1.02] hover:ring-primary/20">
              {/* Quote icon */}
              <Icon
                className="text-primary/40 mb-5"
                icon="ri:double-quotes-l"
                width={32}
              />

              {/* Testimonial content */}
              <blockquote className="text-base text-foreground leading-relaxed mb-5 font-medium">
                &ldquo;Meyoo helped us identify unprofitable SKUs we never
                noticed. Cut our ad spend by 40% while maintaining the same
                revenue.&rdquo;
              </blockquote>

              {/* Star rating */}
              <div className="flex items-center gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Icon
                    key={`rating-star-${i + 1}`}
                    className="text-primary"
                    icon="solar:star-bold"
                    width={16}
                  />
                ))}
              </div>

              {/* Author section */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                    <Image
                      alt="Sarah Chen"
                      className="w-full h-full rounded-full object-cover"
                      height={56}
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=60"
                      width={56}
                    />
                  </div>
                  <Icon
                    className="absolute -bottom-1 -right-1 text-success bg-background rounded-full border-2 border-background"
                    icon="solar:verified-check-bold"
                    width={18}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-base">
                    Sarah Chen
                  </p>
                  <p className="text-sm text-muted-foreground">
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
