import { Button, Card, Chip, useTheme } from "heroui-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import Animated, { FadeInDown, FadeIn, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const FEATURES = [
  { icon: "flash-outline", label: "Fast insights" },
  { icon: "sync-outline", label: "Real-time sync" },
  { icon: "phone-portrait-outline", label: "Mobile optimized" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Gradient Background Effect */}
      <View className="absolute inset-0">
        <View
          className="h-80 rounded-b-[80px]"
          style={{
            backgroundColor: colors.accentSoft || colors.accent,
            opacity: 0.08
          }}
        />
      </View>

      <View className="flex-1 px-6 py-12 justify-center">
        <Animated.View
          entering={FadeIn.duration(600)}
          className="gap-8"
        >
          {/* Top Badge */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            className="items-center"
          >
            <Chip
              size="sm"
              className="bg-accent/10 border border-accent/20"
            >
              <Text className="text-xs font-semibold text-accent">Mobile Experience</Text>
            </Chip>
          </Animated.View>

          {/* Main Card */}
          <Animated.View entering={FadeInDown.duration(500).delay(200)}>
            <Card surfaceVariant="2" className="rounded-3xl border border-border/50">
              <View className="gap-6 items-center p-6">
                {/* Icon with Gradient Border */}
                <Animated.View
                  entering={ZoomIn.duration(600).delay(400)}
                  className="relative"
                >
                  <View className="absolute inset-0 rounded-full bg-accent/5 blur-xl" />
                  <View className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 items-center justify-center border-2 border-accent/30">
                    <Ionicons
                      name="desktop-outline"
                      size={40}
                      color={colors.accent}
                    />
                  </View>
                </Animated.View>

                {/* Text Content */}
                <Animated.View
                  entering={FadeInDown.duration(500).delay(500)}
                  className="gap-3 items-center"
                >
                  <Card.Title className="text-3xl text-center font-semibold">
                    Complete setup on web
                  </Card.Title>
                  <Card.Description className="text-base text-center max-w-xs leading-6">
                    Full onboarding experience available on desktop
                  </Card.Description>
                </Animated.View>
              </View>
            </Card>
          </Animated.View>

          {/* Feature Pills */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(600)}
            className="flex-row justify-center gap-3 flex-wrap"
          >
            {FEATURES.map((feature, index) => (
              <Animated.View
                key={feature.label}
                entering={FadeInDown.duration(400).delay(700 + index * 100)}
              >
                <View className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-surface-2 border border-border/30">
                  <Ionicons name={feature.icon as any} size={16} color={colors.accent} />
                  <Text className="text-xs font-medium text-default-500">{feature.label}</Text>
                </View>
              </Animated.View>
            ))}
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(800)}
            className="gap-3"
          >
            <Button
              className="h-12"
              variant="primary"
              onPress={() => router.replace("/(tabs)/overview")}
            >
              <Button.LabelContent>Jump to dashboard</Button.LabelContent>
              <Button.EndContent>
                <Ionicons name="arrow-forward" size={18} color={colors.accentForeground} />
              </Button.EndContent>
            </Button>
            <Button
              className="h-12"
              variant="ghost"
              onPress={() => router.push("/")}
            >
              Back to sign in
            </Button>
          </Animated.View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}