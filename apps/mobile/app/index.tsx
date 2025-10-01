import { Spinner } from "heroui-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/auth/AuthForm";
import { useOnboardingRedirect } from "@/hooks/useOnboardingRedirect";

export default function Index() {

  const { isLoading, isAuthenticated } = useOnboardingRedirect();

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
    <SafeAreaView className="flex-1 bg-background">
      <AuthLayout
        title="Welcome to Meyoo"
        subtitle="Manage your store, marketing, and insights from one clean workspace."
      >
        <AuthForm />
      </AuthLayout>
    </SafeAreaView>
  );
}
