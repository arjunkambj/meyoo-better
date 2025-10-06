import { Skeleton } from "heroui-native";
import { View } from "react-native";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { AuthBottom } from "@/components/auth/AuthBottom";
import { useOnboardingRedirect } from "@/hooks/useOnboardingRedirect";

export default function Index() {
  const { isLoading, isAuthenticated } = useOnboardingRedirect();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-6">
        <View className="gap-3 mt-10">
          <Skeleton className="h-3 w-16 rounded-md" />
          <Skeleton className="h-8 w-3/5 rounded-xl" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
        </View>
        <View className="gap-3 mt-6">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </View>
      </View>
    );
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated) {
    return (
      <View className="flex-1 bg-background px-4 py-8 gap-6">
        <View className="gap-3 mt-10">
          <Skeleton className="h-3 w-16 rounded-md" />
          <Skeleton className="h-8 w-3/5 rounded-xl" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
        </View>
        <View className="gap-3 mt-6">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </View>
      </View>
    );
  }

  return (
    <AuthScreen
      title="Welcome to Meyoo"
      subtitle="Manage your store, marketing, and insights from one clean workspace."
    >
      <AuthBottom />
    </AuthScreen>
  );
}
