import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { View } from "react-native";
import { useQuery } from "convex/react";
import { useEffect } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { api } from "@/libs/convexApi";

export default function Index() {
  const router = useRouter();
  const user = useQuery(api.core.users.getCurrentUser);
  const isLoading = user === undefined;
  const isAuthenticated = Boolean(user);

  // If user is already authenticated, redirect to overview
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/overview");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner size="lg" />
      </View>
    );
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner size="lg" />
      </View>
    );
  }

  return (
    <AuthLayout
      title="Welcome to Meyoo"
      subtitle="Manage your store, marketing, and insights from one clean workspace."
    >
      <AuthForm onSuccess={() => {
        // Small delay to allow auth state to propagate
        setTimeout(() => {
          router.replace("/overview");
        }, 100);
      }} />
    </AuthLayout>
  );
}
