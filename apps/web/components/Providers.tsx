"use client";

import { HeroUIProvider } from "@heroui/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache/provider";
import { Provider as JotaiProvider } from "jotai";
import { ThemeProviderProps } from "next-themes";
import React from "react";

import { FeatureAccessProvider } from "@/hooks/mainapp/useFeatureAccess";
import { OnboardingProvider } from "@/hooks/onboarding/useOnboarding";
import { ConvexClientProvider } from "./ConvexClientProvider";

interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

export function Providers({ children, themeProps }: ProvidersProps) {
  return (
    <ConvexClientProvider>
      <JotaiProvider>
        <HeroUIProvider>
          <NextThemesProvider
            hemeProps={{ attribute: "class", defaultTheme: "light" }}
          >
            <ConvexQueryCacheProvider>
              <OnboardingProvider>
                <FeatureAccessProvider>{children}</FeatureAccessProvider>
              </OnboardingProvider>
            </ConvexQueryCacheProvider>
          </NextThemesProvider>
        </HeroUIProvider>
      </JotaiProvider>
    </ConvexClientProvider>
  );
}
