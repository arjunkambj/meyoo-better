import React from "react";
import { Text, View } from "react-native";

import { getUserDisplayName, getUserInitials, getUserRoleLabel } from "@/libs/user";

import type { BasicUser } from "@/libs/user";

type UserProfileCardProps = {
  user?: BasicUser | null;
  email?: string | null;
};

export function UserProfileCard({ user, email }: UserProfileCardProps) {
  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const role = getUserRoleLabel(user);
  const resolvedEmail = email ?? user?.email ?? null;

  return (
    <View className="flex-row items-center gap-4 rounded-3xl bg-background/70 p-4">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Text className="text-lg font-semibold text-primary">{initials}</Text>
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-base font-medium text-foreground">{displayName}</Text>
        {resolvedEmail ? (
          <Text className="text-sm text-muted-foreground">{resolvedEmail}</Text>
        ) : null}
        {role ? <Text className="text-xs text-muted-foreground">{role}</Text> : null}
      </View>
    </View>
  );
}
