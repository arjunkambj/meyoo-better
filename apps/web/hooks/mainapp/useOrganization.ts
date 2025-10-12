import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

import { useUser } from "./useUser";

/**
 * Organization Management Hook
 * Provides organization data and methods for the current user
 */
export function useOrganization() {
  const { user, membershipRole } = useUser();
  const organization = useQuery(api.core.organizations.getCurrentOrganization);
  const updateOrganizationNameMutation = useMutation(
    api.core.users.updateOrganizationName,
  );
  const updateOrganizationMutation = useMutation(
    api.core.organizations.updateOrganization,
  );

  const loading = organization === undefined || user === undefined;
  const error =
    organization === null && !loading ? "Organization not found" : null;

  // Update organization name
  const updateOrganizationName = async (name: string) => {
    return await updateOrganizationNameMutation({ organizationName: name });
  };

  // Update organization details
  const updateOrganization = async (data: {
    name?: string;
    currency?: string;
    fiscalYearStart?: string;
    timezone?: string;
  }) => {
    return await updateOrganizationMutation(data);
  };

  return {
    organizationId: user?.organizationId || null,
    organizationName: organization?.name || "Default Organization",
    userRole: membershipRole,
    organization,
    loading,
    error,
    updateOrganizationName,
    updateOrganization,
  };
}
