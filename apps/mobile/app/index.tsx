import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "heroui-native";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center bg-background px-6">
        <View className="w-full max-w-sm gap-4">
          <Button
            className="h-12"
            variant="primary"
            onPress={() => router.push("/(tabs)/overview")}
          >
            Go to Dashboard
          </Button>
          <Button
            className="h-12"
            variant="secondary"
            onPress={() => router.push("/auth")}
          >
            Go to Auth
          </Button>
          <Button
            className="h-12"
            variant="secondary"
            onPress={() => router.push("/onboarding")}
          >
            Go to Onboarding
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
