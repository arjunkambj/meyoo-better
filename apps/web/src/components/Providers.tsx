"use client";

import { HeroUIProvider } from "@heroui/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProvider } from "next-themes";
import React from "react";

import { FeatureAccessProvider } from "@/hooks/mainapp/useFeatureAccess";
import { OnboardingProvider } from "@/hooks/onboarding/useOnboarding";
import { ConvexClientProvider } from "./ConvexClientProvider";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ConvexClientProvider>
      <JotaiProvider>
        <HeroUIProvider>
          <ThemeProvider attribute="class" defaultTheme="light">
            <ConvexQueryCacheProvider>
              <OnboardingProvider>
                <FeatureAccessProvider>{children}</FeatureAccessProvider>
              </OnboardingProvider>
            </ConvexQueryCacheProvider>
          </ThemeProvider>
        </HeroUIProvider>
      </JotaiProvider>
    </ConvexClientProvider>
  );
}
