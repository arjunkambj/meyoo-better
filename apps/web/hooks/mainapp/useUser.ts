import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { isIanaTimeZone } from "@repo/time";

/**
 * User and Organization Management Hooks
 */

// ============ USER HOOKS ============

/**
 * Get current authenticated user
 */
export function useUser() {
  const user = useQuery(api.core.users.getCurrentUser);
  const membership = useQuery(api.core.memberships.getCurrentMembership);
  const organization = useQuery(api.core.organizations.getCurrentOrganization);
  const updateBusinessProfileMutation = useMutation(
    api.core.users.updateBusinessProfile,
  );
  const updateProfileMutation = useMutation(api.core.users.updateProfile);

  const loading = user === undefined;
  const error = user === null && !loading ? "User not found" : null;

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
  const updateBusinessProfile = async (data: {
    mobileNumber?: string;
  }) => {
    return await updateBusinessProfileMutation(data);
  };

  // Get onboarding data separately
  const onboarding = useQuery(
    api.core.onboarding.getOnboardingStatus,
    user ? {} : "skip",
  );

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    role: membership?.role ?? null,
    globalRole: user?.globalRole,
    membershipRole: membership?.role ?? null,
    organizationId: user?.organizationId,
    hasShopifyConnection: onboarding?.connections?.shopify || false,
    hasMetaConnection: onboarding?.connections?.meta || false,
    primaryCurrency: organization?.primaryCurrency ?? "USD",
    isLoading: loading,
    updateProfile,
    updateBusinessProfile,
  };
}

/**
 * Get current user (alias for useUser)
 */
export function useCurrentUser() {
  return useUser();
}

/**
 * Get team members for current organization
 */
export function useTeamMembers() {
  const members = useQuery(api.core.users.getTeamMembers);

  return {
    members: members || [],
    loading: members === undefined,
    error: null,
  };
}

// ============ ORGANIZATION HOOKS ============

/**
 * Get organization's configured timezone (single source of truth)
 */
export function useOrganizationTimeZone() {
  const organization = useQuery(api.core.organizations.getCurrentOrganization);
  const loading = organization === undefined;
  const timezoneRaw = organization?.timezone;
  const timezone = isIanaTimeZone(timezoneRaw) ? (timezoneRaw as string) : 'UTC';
  return { timezone, loading };
}

// ============ MUTATION HOOKS ============

export function useIsOnboarded() {
  const { user } = useUser();

  return user?.isOnboarded || false;
}

/**
 * Get user's integration status
 */
export function useIntegrationStatus() {
  const onboarding = useQuery(api.core.onboarding.getOnboardingStatus);

  return {
    hasShopify: onboarding?.connections?.shopify || false,
    hasMeta: onboarding?.connections?.meta || false,
    isInitialSyncComplete: onboarding?.isInitialSyncComplete || false,
    hasAnyIntegration: !!(
      onboarding?.connections?.shopify ||
      onboarding?.connections?.meta
    ),
  };
}
