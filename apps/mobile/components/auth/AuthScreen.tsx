import React, { useEffect } from "react";
import { Image, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useConvexAuth } from "convex/react";

import { OAuthButton } from "./OAuthButton";
import { useOAuthSignIn } from "@/hooks/useOAuthSignIn";

export function AuthScreen() {
  const router = useRouter();
  const auth = useConvexAuth();
  const { signInWithGoogle, signInWithApple, loadingProvider, error } =
    useOAuthSignIn();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.replace("/(app)/overview");
    }
  }, [auth.isAuthenticated, auth.isLoading, router]);

  if (auth.isAuthenticated) {
    return <Redirect href="/(app)/overview" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      <View className="flex-1 items-center justify-center gap-6">
        <View className="items-center gap-2">
          <Text className="text-2xl font-semibold text-foreground">
            Welcome back to Meyoo
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            Sign in to track profitability across web and mobile.
          </Text>
        </View>

        <View className="w-full gap-4">
          <OAuthButton
            label="Continue with Google"
            onPress={signInWithGoogle}
            loading={loadingProvider === "google"}
          />
          <OAuthButton
            label="Continue with Apple"
            onPress={signInWithApple}
            loading={loadingProvider === "apple"}
          />
        </View>

        {error ? (
          <Text className="text-center text-sm text-rose-500">{error}</Text>
        ) : null}

        <Text className="text-center text-xs text-muted-foreground">
          By continuing you agree to our terms and privacy policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
