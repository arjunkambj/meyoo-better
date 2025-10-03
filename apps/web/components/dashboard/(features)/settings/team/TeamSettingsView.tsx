"use client";

import { Card, CardBody, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useTeamStats, useUser } from "@/hooks";
import InviteTeamModal from "./InviteTeamModal";
import LeaveOrganizationButton from "./LeaveOrganizationButton";
import TeamMembersList from "./TeamMembersList";

export default function TeamSettingsView() {
  const { role } = useUser();
  const { teamStats, isLoading } = useTeamStats();
  const canManageTeam = role === "StoreOwner";

  // Loading state for stats
  const StatsLoader = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card
          key={i}
          className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1"
        >
          <CardBody className="px-5 py-5">
            <Skeleton className="rounded-lg">
              <div className="h-16 rounded-lg bg-default-200" />
            </Skeleton>
          </CardBody>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-default-800">
            Team Management
          </h2>
          <p className="text-sm text-default-500 mt-1">
            Manage your team members and their permissions
          </p>
        </div>
        {canManageTeam ? <InviteTeamModal /> : <LeaveOrganizationButton />}
      </div>

      {/* Team Stats - moved before Organization Section */}
      {isLoading ? (
        <StatsLoader />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
            <CardBody className="px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon
                    className="text-primary"
                    icon="solar:users-group-two-rounded-bold-duotone"
                    width={20}
                  />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-default-800">
                    {teamStats?.totalMembers ?? 0}
                  </p>
                  <p className="text-xs text-default-500">Total Members</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
            <CardBody className="px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Icon
                    className="text-success"
                    icon="solar:check-circle-bold-duotone"
                    width={20}
                  />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-default-800">
                    {teamStats?.activeMembers ?? 0}
                  </p>
                  <p className="text-xs text-default-500">Active Members</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
            <CardBody className="px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Icon
                    className="text-warning"
                    icon="solar:clock-circle-bold-duotone"
                    width={20}
                  />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-default-800">
                    {teamStats?.pendingInvites ?? 0}
                  </p>
                  <p className="text-xs text-default-500">Pending Invites</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Team Members List */}
      <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
        <CardBody className="p-0">
          <TeamMembersList />
        </CardBody>
      </Card>

      {/* Info for non-owners */}
      {!canManageTeam && (
        <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
          <CardBody className="px-5 py-5">
            <div className="flex items-start gap-3">
              <Icon
                className="text-default-500 mt-1"
                icon="solar:info-circle-bold-duotone"
                width={20}
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-default-800">
                  Team Member Access
                </p>
                <p className="text-sm text-default-500">
                  As a team member, you have access to all features except
                  billing and team management. Contact your store owner to make
                  changes to the team.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
