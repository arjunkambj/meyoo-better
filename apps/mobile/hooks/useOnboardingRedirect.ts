import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "expo-router";
import { useQuery } from "convex/react";

import { api } from "@/libs/convexApi";

interface UseOnboardingRedirectOptions {
  /** Route for the onboarding flow. Defaults to `/onboarding`. */
  onboardingRoute?: string;
  /** Route for the post-onboarding experience. Defaults to `/(tabs)/overview`. */
  overviewRoute?: string;
  /** Route for unauthenticated users. Defaults to `/`. */
  unauthenticatedRoute?: string;
}

export function useOnboardingRedirect(
  options: UseOnboardingRedirectOptions = {},
) {
  const {
    onboardingRoute = "/onboarding",
    overviewRoute = "/(tabs)/overview",
    unauthenticatedRoute = "/",
  } = options;

  const router = useRouter();
  const pathname = usePathname();

  const user = useQuery(api.core.users.getCurrentUser);
  const onboardingStatus = useQuery(api.core.onboarding.getOnboardingStatus);

  const { isLoading, isAuthenticated, isOnboardingComplete } = useMemo(() => {
    const loading = user === undefined || onboardingStatus === undefined;
    const authenticated = Boolean(user);
    const completed = Boolean(
      onboardingStatus?.completed ?? user?.isOnboarded ?? false,
    );

    return {
      isLoading: loading,
      isAuthenticated: authenticated,
      isOnboardingComplete: completed,
    };
  }, [user, onboardingStatus]);

  useEffect(() => {
    if (isLoading || !pathname) {
      return;
    }

    if (!isAuthenticated) {
      if (pathname !== unauthenticatedRoute) {
        router.replace(unauthenticatedRoute);
      }
      return;
    }

    if (!isOnboardingComplete) {
      if (pathname !== onboardingRoute) {
        router.replace(onboardingRoute);
      }
      return;
    }

    if (
      (pathname === onboardingRoute || pathname === unauthenticatedRoute) &&
      pathname !== overviewRoute
    ) {
      router.replace(overviewRoute);
    }
  }, [
    isLoading,
    isAuthenticated,
    isOnboardingComplete,
    pathname,
    router,
    onboardingRoute,
    overviewRoute,
    unauthenticatedRoute,
  ]);

  return {
    user,
    onboardingStatus,
    isLoading,
    isAuthenticated,
    isOnboardingComplete,
  };
}
