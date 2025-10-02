import { Avatar, Button, Card, Chip, Skeleton, useTheme } from "heroui-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert, Pressable, Text, View } from "react-native";
import { useCallback, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";

import { useUserDetails } from "@/hooks/useUserDetails";
import type { BillingUsage } from "@/hooks/useUserDetails";

type CurrentUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  storeName?: string | null;
  organizationName?: string | null;
} | null;

export default function SettingsTab() {
  const {
    billing,
    billingUsage: rawBillingUsage,
    isLoading,
    user,
  } = useUserDetails();
  const billingUsage = rawBillingUsage as BillingUsage | null;
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { colors, theme, setTheme } = useTheme();

  const plan = billingUsage?.plan ?? billing?.plan ?? "free";

  const planLabel = useMemo(() => {
    if (!plan) return "Free Plan";
    const normalized = plan.charAt(0).toUpperCase() + plan.slice(1);
    return normalized.replace(/-/g, " ");
  }, [plan]);

  const typedUser = user as CurrentUser;

  const displayName = useMemo(() => {
    if (!typedUser) return "Meyoo Merchant";
    if (typedUser.name && typedUser.name.trim().length > 0) {
      return typedUser.name;
    }
    return typedUser.email ?? "Meyoo Merchant";
  }, [typedUser]);

  const avatarSource = useMemo(() => {
    if (!typedUser?.image) return undefined;
    const image = typedUser.image.trim();
    return image.length > 0 ? { uri: image } : undefined;
  }, [typedUser?.image]);

  const avatarInitials = useMemo(() => {
    if (!displayName) return "MM";
    const parts = displayName.split(" ").filter(Boolean);
    if (parts.length === 0) {
      return "MM";
    }
    return (
      parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "MM"
    );
  }, [displayName]);

  const organizationLabel = useMemo(() => {
    return typedUser?.storeName ?? typedUser?.organizationName ?? null;
  }, [typedUser?.organizationName, typedUser?.storeName]);

  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  }, [signOut, router]);

  const usageProgress = useMemo(() => {
    if (!billingUsage) return 0;
    const normalized = Number.isFinite(billingUsage.percentage)
      ? Math.max(0, Math.min(100, billingUsage.percentage))
      : 0;
    return Math.round(normalized);
  }, [billingUsage]);

  const usageSummary = useMemo(() => {
    if (!billingUsage) {
      return "Usage syncs automatically from your Meyoo workspace.";
    }

    if (billingUsage.limit > 0) {
      return `${billingUsage.currentUsage.toLocaleString()} of ${billingUsage.limit.toLocaleString()} actions used`;
    }

    return `${billingUsage.currentUsage.toLocaleString()} actions used this cycle`;
  }, [billingUsage]);

  const usageHelperText = useMemo(() => {
    if (!billingUsage) {
      return "We'll keep your usage up to date here.";
    }

    if (billingUsage.requiresUpgrade) {
      return "You are approaching your plan limit. Contact support to explore upgrades.";
    }

    if (billingUsage.month) {
      return `Tracking usage for ${billingUsage.month}.`;
    }

    return "Usage resets at the start of each billing cycle.";
  }, [billingUsage]);

  const billingStatusLabel = useMemo(() => {
    if (billingUsage?.isOnTrial) {
      if (billingUsage.daysLeftInTrial > 1) {
        return `${billingUsage.daysLeftInTrial} days left in trial`;
      }
      if (billingUsage.daysLeftInTrial === 1) {
        return "Trial ends tomorrow";
      }
      return "Trial ends today";
    }

    switch (billing?.status) {
      case "active":
        return "Plan active";
      case "trial":
        return "Trial active";
      case "cancelled":
        return "Plan cancelled";
      case "suspended":
        return "Plan suspended";
      default:
        return billing?.isPremium ? "Premium plan active" : "Free plan";
    }
  }, [billing, billingUsage]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 gap-6 px-6 py-6">
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-foreground">
                Settings
              </Text>
              <Text className="text-sm text-foreground/70 mt-1">
                Manage your account and preferences
              </Text>
            </View>
          </View>
        </View>

        <View className="gap-4">
          {isLoading ? (
            <View className="gap-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </View>
          ) : (
            <View className="gap-4 pb-8">
              <Card
                surfaceVariant="2"
                className="rounded-2xl border border-border/50"
              >
                <Card.Body className="gap-4">
                  <View className="flex-row items-center gap-4">
                    <Avatar
                      size="lg"
                      color="accent"
                      alt={displayName ?? "User avatar"}
                    >
                      {avatarSource ? (
                        <Avatar.Image source={avatarSource} />
                      ) : null}
                      <Avatar.Fallback entering={undefined}>
                        {avatarInitials}
                      </Avatar.Fallback>
                    </Avatar>

                    <View className="flex-1 gap-1">
                      <Text className="text-lg font-bold text-foreground">
                        {displayName}
                      </Text>
                      {typedUser?.email ? (
                        <Text className="text-sm text-foreground/50">
                          {typedUser.email}
                        </Text>
                      ) : null}
                      {organizationLabel ? (
                        <Text className="text-xs text-foreground/50">
                          {organizationLabel}
                        </Text>
                      ) : null}
                    </View>

                    <Chip
                      size="sm"
                      color={billing?.isPremium ? "accent" : "default"}
                    >
                      <Chip.LabelContent className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                        {planLabel}
                      </Chip.LabelContent>
                    </Chip>
                  </View>
                </Card.Body>
              </Card>

              <Card
                surfaceVariant="2"
                className="rounded-2xl border border-border/50"
              >
                <Card.Body className="gap-4">
                  <View className="flex-row items-center justify-between">
                    <View className="gap-1">
                      <Text className="text-base font-semibold text-foreground">
                        Plan & usage
                      </Text>
                      <Text className="text-xs text-foreground/50">
                        {billingStatusLabel}
                      </Text>
                    </View>
                    <Ionicons
                      name="card-outline"
                      size={22}
                      color={colors.foreground}
                    />
                  </View>

                  <View className="gap-2">
                    <View className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                      <View
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${usageProgress}%` }}
                      />
                    </View>
                    <Text className="text-sm text-foreground">
                      {usageSummary}
                    </Text>
                    <Text
                      className={`text-xs ${billingUsage?.requiresUpgrade ? "text-danger" : "text-foreground/50"}`}
                    >
                      {usageHelperText}
                    </Text>
                  </View>
                </Card.Body>
              </Card>

              <Card
                surfaceVariant="2"
                className="rounded-2xl border border-border/50"
              >
                <Card.Body className="gap-3">
                  <View className="gap-1">
                    <Text className="text-base font-semibold text-foreground">
                      Theme
                    </Text>
                    <Text className="text-xs text-foreground/50">
                      Choose your preferred appearance
                    </Text>
                  </View>

                  <View className="gap-2">
                    <Pressable
                      onPress={() => setTheme("light")}
                      className="flex-row items-center justify-between py-3 px-2 rounded-xl"
                    >
                      <View className="flex-row items-center gap-3">
                        <Ionicons
                          name="sunny-outline"
                          size={20}
                          color={colors.foreground}
                        />
                        <Text className="text-base text-foreground">Light</Text>
                      </View>
                      <View
                        className="w-5 h-5 rounded-full border-2 items-center justify-center"
                        style={{
                          borderColor:
                            theme === "light" ? colors.accent : colors.foreground + "40",
                        }}
                      >
                        {theme === "light" && (
                          <View
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors.accent }}
                          />
                        )}
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => setTheme("dark")}
                      className="flex-row items-center justify-between py-3 px-2 rounded-xl"
                    >
                      <View className="flex-row items-center gap-3">
                        <Ionicons
                          name="moon-outline"
                          size={20}
                          color={colors.foreground}
                        />
                        <Text className="text-base text-foreground">Dark</Text>
                      </View>
                      <View
                        className="w-5 h-5 rounded-full border-2 items-center justify-center"
                        style={{
                          borderColor:
                            theme === "dark" ? colors.accent : colors.foreground + "40",
                        }}
                      >
                        {theme === "dark" && (
                          <View
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors.accent }}
                          />
                        )}
                      </View>
                    </Pressable>
                  </View>
                </Card.Body>
              </Card>

              <Card
                surfaceVariant="2"
                className="rounded-2xl border border-border/50"
              >
                <Card.Body className="gap-3">
                  <View className="gap-1">
                    <Text className="text-base font-semibold text-foreground">
                      Need a hand?
                    </Text>
                    <Text className="text-xs text-foreground/50">
                      {"Drop a line and we'll follow up quickly."}
                    </Text>
                  </View>

                  <Text className="text-lg text-foreground mt-2">
                    Email: Hello@meyoo.io
                  </Text>
                </Card.Body>
              </Card>

              <Button
                variant="danger"
                size="lg"
                onPress={handleSignOut}
                className="h-12 rounded-2xl"
              >
                <Button.StartContent>
                  <Ionicons name="log-out" size={22} color="#ffffff" />
                </Button.StartContent>
                <Button.LabelContent
                  classNames={{ text: "font-semibold text-white" }}
                >
                  Sign Out
                </Button.LabelContent>
              </Button>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
