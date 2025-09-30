import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@/libs/convexApi';

/**
 * Hook to guard routes based on authentication and onboarding status
 * Redirects:
 * - Not authenticated -> /overview (or home)
 * - Authenticated but not onboarded -> /onboarding
 * - Authenticated and onboarded -> stays on current route
 */
export function useAuthGuard() {
  const router = useRouter();
  const user = useQuery(api.core.users.getCurrentUser);
  const onboardingStatus = useQuery(api.core.onboarding.getOnboardingStatus);

  const isLoading = user === undefined || onboardingStatus === undefined;
  const isAuthenticated = Boolean(user);
  const isOnboarded = user?.isOnboarded ?? false;
  const onboardingCompleted = onboardingStatus?.completed ?? false;

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated -> redirect to login
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    // Authenticated but not onboarded -> redirect to onboarding
    if (isAuthenticated && (!isOnboarded || !onboardingCompleted)) {
      router.replace('/onboarding');
      return;
    }

    // Authenticated and onboarded -> stay on current route
  }, [isLoading, isAuthenticated, isOnboarded, onboardingCompleted, router]);

  return {
    isLoading,
    isAuthenticated,
    isOnboarded: isOnboarded && onboardingCompleted,
    user,
    onboardingStatus,
  };
}