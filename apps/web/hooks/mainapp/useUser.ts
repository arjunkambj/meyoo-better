import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import { isIanaTimeZone } from "@repo/time";
import type { GenericId as Id } from "convex/values";

/**
 * User and Organization Management Hooks
 */

// ============ USER HOOKS ============

/**
 * Get current authenticated user
 */
export function useUser() {
  const user = useQuery(api.core.users.getCurrentUser);
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
    businessType?: string;
    businessCategory?: string;
    industry?: string;
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
    role: user?.role,
    organizationId: user?.organizationId,
    hasShopifyConnection: onboarding?.connections?.shopify || false,
    hasMetaConnection: onboarding?.connections?.meta || false,
    primaryCurrency: user?.primaryCurrency || "USD",
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
 * Get user ID
 */
export function useUserId() {
  const { user } = useUser();

  return user?._id;
}

/**
 * Get user by ID
 */
export function useUserById(userId: Id<"users"> | undefined) {
  const user = useQuery(api.core.users.getUser, userId ? { userId } : "skip");

  return {
    user,
    loading: user === undefined,
    error: user === null ? "User not found" : null,
  };
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
 * Get organization ID for current user
 */
export function useOrganizationId() {
  const { user } = useUser();

  return user?.organizationId;
}

/**
 * Get current user's organization
 */
export function useCurrentUserOrganization() {
  const organization = useQuery(api.core.organizations.getCurrentOrganization);

  return {
    organization,
    loading: organization === undefined,
    error:
      organization === null && organization !== undefined
        ? "Organization not found"
        : null,
  };
}

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

/**
 * Get organization by ID
 */
export function useOrganizationById(organizationId?: Id<"organizations">) {
  const organization = useQuery(
    api.core.organizations.getOrganization,
    organizationId ? { organizationId } : "skip",
  );

  return {
    organization,
    loading: organization === undefined,
    error:
      organization === null && organization !== undefined
        ? "Organization not found"
        : null,
  };
}

/**
 * Get organization members
 */
export function useOrganizationMembers(organizationId?: Id<"organizations">) {
  const members = useQuery(
    api.core.organizations.getOrganization,
    organizationId ? { organizationId } : "skip",
  );

  return {
    members: members || [],
    loading: members === undefined,
    error: null,
  };
}

// ============ MUTATION HOOKS ============

/**
 * Update user profile
 */
export function useUpdateUserProfile() {
  const mutation = useMutation(api.core.users.updateProfile);

  return async (data: {
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
    try {
      const result = await mutation(data);

      return { success: true, data: result };
    } catch (error) {
      // Failed to update profile

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update profile",
      };
    }
  };
}

/**
 * Update organization details
 */
export function useUpdateOrganization() {
  const mutation = useMutation(api.core.organizations.updateOrganization);

  return async (data: {
    name?: string;
    businessType?: string;
    businessCategory?: string;
    industry?: string;
    timezone?: string;
    primaryCurrency?: string;
  }) => {
    try {
      const result = await mutation(data);

      return { success: true, data: result };
    } catch (error) {
      // Failed to update organization

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update organization",
      };
    }
  };
}

/**
 * Invite team member
 */
export function useInviteTeamMember() {
  const mutation = useMutation(api.core.users.inviteTeamMember);

  return async (data: {
    email: string;
    role: "StoreTeam";
  }) => {
    try {
      const result = await mutation(data);

      return { success: result.success, message: result.message };
    } catch (error) {
      // Failed to invite team member

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to invite team member",
      };
    }
  };
}

// ============ HELPER HOOKS ============

/**
 * Check if user has specific permission
 */
export function useHasPermission(action: "view" | "edit" | "delete" | "admin") {
  const { user } = useUser();

  if (!user) return false;

  switch (user.role) {
    case "StoreOwner":
      return true; // Full access

    case "StoreTeam":
      return action === "view" || action === "edit";

    default:
      return false;
  }
}

/**
 * Check if user is onboarded
 */
export function useIsOnboarded() {
  const { user } = useUser();

  return user?.isOnboarded || false;
}

/**
 * Get user's billing information
 */
export function useUserBilling() {
  const billing = useQuery(api.core.users.getUserBilling);

  return {
    billing,
    loading: billing === undefined,
    plan: billing?.plan || "free",
    isPremium: billing?.isPremium || false,
    status: billing?.status || "active",
    billingCycle: billing?.billingCycle || "monthly",
  };
}

/**
 * Get user's current plan
 */
export function useUserPlan() {
  const { billing } = useUserBilling();

  const plan = billing?.plan || "free";

  return {
    plan,
    isFreePlan: plan === "free",
    isPaidPlan: plan !== "free",
  };
}

/**
 * Get user's integration status
 */
export function useIntegrationStatus() {
  const onboarding = useQuery(api.core.onboarding.getOnboardingStatus);

  return {
    hasShopify: onboarding?.connections?.shopify || false,
    hasMeta: onboarding?.connections?.meta || false,
    isInitialSyncComplete: false, // This will be moved to sync status check
    hasAnyIntegration: !!(
      onboarding?.connections?.shopify ||
      onboarding?.connections?.meta
    ),
  };
}
