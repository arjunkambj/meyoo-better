"use client";

import {
  Avatar,
  Button,
  Chip,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";
import { api } from "@/libs/convexApi";
import type { GenericId as Id } from "convex/values";
import { useTeamMembersWithManagement, useUser } from "@/hooks";
import { formatDate } from "@/libs/utils/format";

// Use inferred return type from Convex API; no local TeamMember type

export default function TeamMembersList() {
  const { role: currentUserRole } = useUser();
  const { teamMembers, canManageTeam, isLoading } =
    useTeamMembersWithManagement();
  const [removingUserId, setRemovingUserId] = useState<Id<"users"> | null>(
    null,
  );
  const setPending = useSetAtom(setSettingsPendingAtom);

  const removeTeamMember = useMutation(api.core.teams.removeTeamMember);

  const tableClassNames = useMemo(
    () => ({
      wrapper: "shadow-none border-0",
    }),
    [],
  );

  const handleRemoveMember = useCallback(
    async (userId: Id<"users">) => {
      setRemovingUserId(userId);
      setPending(true);
      try {
        const result = await removeTeamMember({ memberId: userId });

        if (result.success) {
          addToast({ title: result.message, color: "default" });
        } else {
          addToast({ title: result.message, color: "danger" });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to remove team member";
        addToast({ title: message, color: "danger" });
      } finally {
        setRemovingUserId(null);
        setPending(false);
      }
    },
    [removeTeamMember, setPending],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (teamMembers && teamMembers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex justify-center mb-4">
            <Icon
              className="text-primary"
              icon="solar:users-group-two-rounded-bold-duotone"
              width={48}
            />
          </div>
          <p className="text-lg font-medium text-foreground">
            No team members yet
          </p>
          <p className="text-sm text-default-500">
            Invite team members to collaborate on your store. They will have
            access to all features except billing and team management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table aria-label="Team members table" classNames={tableClassNames}>
      <TableHeader>
        <TableColumn>MEMBER</TableColumn>
        <TableColumn>ROLE</TableColumn>
        <TableColumn>STATUS</TableColumn>
        <TableColumn>JOINED</TableColumn>
        <TableColumn>{canManageTeam ? "ACTIONS" : ""}</TableColumn>
      </TableHeader>
      <TableBody>
        {(teamMembers || []).map((member) => (
          <TableRow key={member._id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar
                  name={member.name || member.email}
                  size="sm"
                  src={member.image}
                />
                <div>
                  <p className="text-sm font-medium">
                    {member.name || "Unnamed"}
                  </p>
                  <p className="text-xs text-default-500">{member.email}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Chip
                color={member.role === "StoreOwner" ? "primary" : "default"}
                size="sm"
                variant="flat"
              >
                {member.role === "StoreOwner" ? "Owner" : "Team"}
              </Chip>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <Chip
                  color={member.status === "active" ? "success" : "warning"}
                  size="sm"
                  variant="dot"
                >
                  {member.status === "active" ? "Active" : "Invited"}
                </Chip>
                {/* Additional invite details removed to align with server types */}
              </div>
            </TableCell>
            <TableCell>
              <p className="text-sm text-default-500">
                {member.createdAt
                  ? formatDate(member.createdAt)
                  : "—"}
              </p>
            </TableCell>
            <TableCell>
              {canManageTeam &&
              member.role !== "StoreOwner" &&
              currentUserRole === "StoreOwner" ? (
                <Button
                  color="danger"
                  isLoading={removingUserId === member._id}
                  size="sm"
                  startContent={
                    !removingUserId && (
                      <Icon icon="solar:trash-bin-2-linear" width={16} />
                    )
                  }
                  variant="light"
                  onPress={() => handleRemoveMember(member._id)}
                >
                  Remove
                </Button>
              ) : (
                <span className="text-xs text-default-400">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
