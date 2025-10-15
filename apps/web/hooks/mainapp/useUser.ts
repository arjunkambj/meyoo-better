import { useMutation } from "convex/react";

import { useUserContext } from "@/contexts/UserContext";
import { api } from "@/libs/convexApi";
import { useOnboarding } from "@/hooks/onboarding/useOnboarding";

/**
 * Get current authenticated user
 */
export type UserProfile = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  organizationId?: string;
  isOnboarded?: boolean;
  hasMetaConnection?: boolean;
  [key: string]: unknown;
};

export function useUser() {
  const {
    user,
    loading,
    error,
    membershipRole,
    organizationId,
    primaryCurrency,
  } = useUserContext();
  const updateBusinessProfileMutation = useMutation(
    api.core.users.updateBusinessProfile
  );
  const updateProfileMutation = useMutation(api.core.users.updateProfile);

  // Update profile function - for basic user info
  const updateProfile = async (data: {
    name?: string;
    email?: string;
    phone?: string;
    timezone?: string;
    notificationPreferences?: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  }) => {
    return await updateProfileMutation(data);
  };

  // Update business profile function - for business-specific info
  const updateBusinessProfile = async (data: { mobileNumber?: string }) => {
    return await updateBusinessProfileMutation(data);
  };

  const typedUser = user ? (user as UserProfile) : null;
  const { status: onboardingStatus } = useOnboarding();

  return {
    user: typedUser,
    loading,
    error,
    isAuthenticated: !!typedUser,
    role: membershipRole ?? null,
    membershipRole,
    organizationId,
    hasShopifyConnection: onboardingStatus?.connections?.shopify || false,
    hasMetaConnection: onboardingStatus?.connections?.meta || false,
    primaryCurrency,
    isLoading: loading,
    updateProfile,
    updateBusinessProfile,
  };
}

export function useIsOnboarded() {
  const { user } = useUser();

  return user?.isOnboarded || false;
}

export function useIntegrationStatus() {
  const { status: onboardingStatus } = useOnboarding();

  return {
    hasShopify: onboardingStatus?.connections?.shopify || false,
    hasMeta: onboardingStatus?.connections?.meta || false,
    isInitialSyncComplete: onboardingStatus?.isInitialSyncComplete || false,
    hasAnyIntegration: !!(
      onboardingStatus?.connections?.shopify ||
      onboardingStatus?.connections?.meta
    ),
  };
}
