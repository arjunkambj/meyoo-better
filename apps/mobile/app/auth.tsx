import { useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "heroui-native";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/auth/AuthForm";

export default function AuthScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AuthLayout
        title="Welcome to Meyoo"
        subtitle="Sign in or create an account to continue"
      >
        <AuthForm onSuccess={() => router.replace("/(tabs)/overview")} />
        <View className="mt-4">
          <Button
            className="h-12"
            variant="secondary"
            onPress={() => router.push("/(tabs)/overview")}
          >
            Skip to Dashboard
          </Button>
        </View>
      </AuthLayout>
    </SafeAreaView>
  );
}
