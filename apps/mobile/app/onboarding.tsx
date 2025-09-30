import { Button, Card, useTheme } from "heroui-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Alert } from "react-native";
import Animated, { FadeInDown, FadeIn, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";

const FEATURES = [
  { icon: "flash-outline", label: "Fast insights" },
  { icon: "sync-outline", label: "Real-time sync" },
  { icon: "phone-portrait-outline", label: "Mobile optimized" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signOut } = useAuthActions();

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

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

      <View className="flex-1 px-6 py-12 justify-between">
        <Animated.View
          entering={FadeIn.duration(600)}
          className="gap-8 flex-1 justify-center"
        >
          {/* Main Card */}
          <Animated.View entering={FadeInDown.duration(500).delay(200)}>
            <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
              <View className="gap-6 items-center px-6 py-6">
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

        </Animated.View>

        {/* Logout Button at Bottom */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(800)}
        >
          <Button
            className="h-12"
            variant="ghost"
            onPress={handleLogout}
          >
            <Button.StartContent>
              <Ionicons name="log-out-outline" size={18} color={colors.foreground} />
            </Button.StartContent>
            <Button.LabelContent>Log Out</Button.LabelContent>
          </Button>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
