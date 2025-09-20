"use client";

// Thin wrapper around Vercel Web Analytics to keep calls consistent
// and safe in SSR. Use for onboarding step/view/action events.
import { track as vercelTrack } from "@vercel/analytics";

type AllowedValue = string | number | boolean | null;
type Props = Record<string, AllowedValue> | undefined;

export function trackEvent(name: string, props?: Props) {
  try {
    // Only attempt tracking in the browser
    if (typeof window === "undefined") return;
    vercelTrack(name, props);
  } catch {
    // Avoid throwing if analytics is unavailable
  }
}

// Specific helpers for onboarding
export function trackOnboardingView(step: string, props?: Props) {
  trackEvent(`onboarding_${step}_view`, props);
}

export function trackOnboardingAction(step: string, action: string, props?: Props) {
  trackEvent(`onboarding_${step}_${action}`, props);
}

