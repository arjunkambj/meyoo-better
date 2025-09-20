"use client";
import { useOnboarding } from "@/hooks/onboarding/useOnboarding";
import { usePresence } from "@/hooks/usePresence";

// Mounts presence heartbeat across the app when onboarding is completed.
// This ensures presence runs on all dashboard pages that use Providers.
export function GlobalPresenceActivator() {
  const { status } = useOnboarding();
  // Enable when user is onboarded; status can be undefined while loading
  const enabled = !!status && status.completed === true;
  usePresence("dashboard", enabled);
  return null;
}
