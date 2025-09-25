import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import "../styles/global.css";

import { useAuthStatus } from "@/hooks/useAuthStatus";

export default function Index() {
  const { isLoading, isAuthenticated } = useAuthStatus();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <View className="items-center gap-2">
          <ActivityIndicator />
          <Text className="text-sm text-muted-foreground">
            Loading your workspace…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(app)/overview" />;
}
