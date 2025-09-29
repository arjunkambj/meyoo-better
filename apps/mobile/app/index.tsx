import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { View } from "react-native";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/auth/AuthForm";

export default function Index() {
  const router = useRouter();

  return (
    <AuthLayout
      title="Welcome to Meyoo"
      subtitle="Manage your store, marketing, and insights from one clean workspace."
      footer={
        <View className="gap-3">
          <Button
            className="h-12"
            variant="secondary"
            onPress={() => router.push("/onboarding")}
          >
            Go to onboarding
          </Button>
          <Button
            className="h-12"
            variant="secondary"
            onPress={() => router.push("/(tabs)/overview")}
          >
            Explore dashboard first
          </Button>
        </View>
      }
    >
      <AuthForm onSuccess={() => router.replace("/(tabs)/overview")} />
    </AuthLayout>
  );
}