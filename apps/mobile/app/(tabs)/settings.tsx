import {
  Button,
  Card,
  Chip,
  Divider,
  Skeleton,
  useTheme,
} from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Alert, Pressable, Platform } from 'react-native';
import { useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { useUserDetails } from '@/hooks/useUserDetails';

export default function SettingsTab() {
  const { billing, billingUsage, isLoading, user } = useUserDetails();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { colors, theme, toggleTheme } = useTheme();

  const plan = billingUsage?.plan ?? billing?.plan ?? 'free';

  const planLabel = useMemo(() => {
    if (!plan) return 'Free Plan';
    const normalized = plan.charAt(0).toUpperCase() + plan.slice(1);
    return normalized.replace(/-/g, ' ');
  }, [plan]);

  const typedUser = user as
    | {
        name?: string | null;
        email?: string | null;
        storeName?: string | null;
      }
    | null;

  const displayName = useMemo(() => {
    if (!typedUser) return 'Meyoo Merchant';
    if (typedUser.name && typedUser.name.trim().length > 0) {
      return typedUser.name;
    }
    return typedUser.email ?? 'Meyoo Merchant';
  }, [typedUser]);

  const handleSignOut = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  }, [signOut, router]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint={theme === 'dark' ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-semibold text-foreground">
              Settings
            </Text>
            <Text className="text-xs text-default-500">
              Manage your account and preferences
            </Text>
          </View>
          <Pressable onPress={toggleTheme} className="px-2">
            {theme === 'light' ? (
              <Animated.View key="moon" entering={ZoomIn} exiting={FadeOut}>
                <Ionicons name="moon" color={colors.foreground} size={24} />
              </Animated.View>
            ) : (
              <Animated.View key="sun" entering={ZoomIn} exiting={FadeOut}>
                <Ionicons name="sunny" color={colors.foreground} size={24} />
              </Animated.View>
            )}
          </Pressable>
        </View>
      </BlurView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-6 pt-24">

          {isLoading ? (
            <View className="gap-4">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-40 rounded-3xl" />
              <Skeleton className="h-52 rounded-3xl" />
            </View>
          ) : (
            <View className="gap-4 pb-10">
              {/* User Profile Card */}
              <Card surfaceVariant="2" className="rounded-3xl border border-border/40">
                <Card.Body className="p-4">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                      <Ionicons
                        name="person"
                        size={22}
                        color={colors.accent}
                      />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-lg font-semibold text-foreground">
                        {displayName}
                      </Text>
                      <Text className="text-sm text-default-500">
                        {typedUser?.email ?? 'No email'}
                      </Text>
                      {typedUser?.storeName ? (
                        <Text className="text-xs text-default-400">
                          {typedUser.storeName}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Card.Body>
              </Card>

              {/* Plan Card */}
              <Card surfaceVariant="2" className="rounded-3xl border border-border/40">
                <Card.Body className="gap-4 p-4">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                      <Ionicons
                        name="star"
                        size={20}
                        color={colors.accent}
                      />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-xs font-semibold uppercase tracking-wider text-default-500">
                        Current Plan
                      </Text>
                      <Text className="text-xl font-semibold text-foreground">
                        {planLabel}
                      </Text>
                    </View>
                    <Chip
                      size="sm"
                      color={plan === 'free' ? 'default' : 'accent'}
                      className="rounded-full"
                    >
                      <Text className="text-xs font-semibold uppercase">
                        {plan === 'free' ? 'Free' : 'Pro'}
                      </Text>
                    </Chip>
                  </View>

                  {billingUsage && (
                    <>
                      <Divider className="bg-divider/60" />
                      <View className="gap-2">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs text-default-500">
                            Monthly usage
                          </Text>
                          <Text className="text-sm font-medium text-foreground">
                            {billingUsage.currentUsage?.toLocaleString() ?? 0} / {billingUsage.limit?.toLocaleString() ?? 0}
                          </Text>
                        </View>
                        <View className="h-2 overflow-hidden rounded-full bg-surface-3">
                          <View
                            className="h-full rounded-full bg-accent"
                            style={{
                              width: `${Math.min(100, billingUsage.percentage ?? 0)}%`,
                            }}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </Card.Body>
              </Card>

              {/* Sign Out Button */}
              <Button
                variant="danger"
                size="lg"
                onPress={handleSignOut}
                className="h-14 rounded-2xl"
              >
                <Button.StartContent>
                  <Ionicons name="log-out" size={22} color={colors.dangerForeground} />
                </Button.StartContent>
                <Button.LabelContent classNames={{ text: 'font-semibold' }}>
                  Sign Out
                </Button.LabelContent>
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}