/**
 * Team Management Hooks
 * Hooks for managing team members, invites, and team-related operations
 */

import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

/**
 * Hook to get team statistics
 * Returns total members, active members, and pending invites count
 */
export function useTeamStats() {
  const teamStats = useQuery(api.core.teams.getTeamStats);

  return {
    teamStats,
    isLoading: teamStats === undefined,
  };
}

/**
 * Hook to get team members list with management permissions
 * Returns all team members with their details and management permissions
 */
export function useTeamMembersWithManagement() {
  const teamMembers = useQuery(api.core.teams.getTeamMembers);
  const canManageTeam = useQuery(api.core.teams.canManageTeam);

  return {
    teamMembers,
    canManageTeam,
    isLoading: teamMembers === undefined || canManageTeam === undefined,
  };
}

