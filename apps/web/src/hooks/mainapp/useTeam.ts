import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

export function useTeamStats() {
  const teamStats = useQuery(api.core.teams.getTeamStats);

  return {
    teamStats,
    isLoading: teamStats === undefined,
  };
}

export function useTeamMembersWithManagement() {
  const teamMembers = useQuery(api.core.teams.getTeamMembers);
  const canManageTeam = useQuery(api.core.teams.canManageTeam);

  return {
    teamMembers,
    canManageTeam,
    isLoading: teamMembers === undefined || canManageTeam === undefined,
  };
}
