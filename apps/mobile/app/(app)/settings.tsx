import React from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthActions } from "@convex-dev/auth/react";
import { useTheme } from "heroui-native";

import { SectionCard } from "@/components/common/SectionCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import { UserProfileCard } from "@/components/common/UserProfileCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function SettingsScreen() {
  const { user } = useCurrentUser();
  const { isDark, toggleTheme } = useTheme();
  const { signOut } = useAuthActions();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 96 }}>
        <View className="mt-8 gap-6">
          <SectionHeader
            title="Settings"
            subtitle="Personalize your mobile workspace."
          />

          <UserProfileCard user={user ?? undefined} />

          <SectionCard title="Appearance" description="Choose a theme that fits the moment.">
            <View className="flex-row items-center justify-between">
              <Text className="text-base text-foreground">Dark mode</Text>
              <Switch value={isDark} onValueChange={toggleTheme} />
            </View>
          </SectionCard>

          <SectionCard title="Account" description="Control session preferences.">
            <Pressable
              onPress={() => void signOut()}
              className="rounded-full px-4 py-3"
            >
              <Text className="text-base font-medium text-danger">Log out</Text>
            </Pressable>
          </SectionCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
