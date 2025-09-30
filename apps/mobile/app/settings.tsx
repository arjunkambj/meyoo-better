import {
  Button,
  Card,
  Divider,
  Skeleton,
  Spinner,
  useTheme,
} from 'heroui-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Text, View, Alert, Pressable, Platform, TouchableOpacity } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { useUserDetails } from '@/hooks/useUserDetails';
import { CustomBottomNav } from '@/components/navigation/CustomBottomNav';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function SettingsTab() {
  // Auth guard - ensure user is authenticated before loading data
  const { isLoading: isAuthLoading } = useAuthGuard();

  const { billing, billingUsage, isLoading, user } = useUserDetails();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { colors, theme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(96);

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

  // Show loading spinner while authentication is being checked
  if (isAuthLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <Spinner size="lg" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['left', 'right']}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 100}
        tint={theme === 'dark' ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top + 8,
          paddingBottom: 16,
        }}
      >
        <View
          className="flex-row items-center justify-between px-6 pb-4 pt-2"
          onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height)}
        >
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
        contentContainerStyle={{
          paddingTop: headerHeight + insets.top + 16,
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-6 px-6">

          {isLoading ? (
            <View className="gap-6">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-52 rounded-2xl" />
            </View>
          ) : (
            <View className="gap-6 pb-10">
              {/* User Profile Card */}
              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="px-6 py-6">
                  <View className="flex-row items-center gap-4">
                    <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                      <Ionicons
                        name="person"
                        size={24}
                        color={colors.accent}
                      />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-lg font-bold text-foreground">
                        {displayName}
                      </Text>
                      <Text className="text-sm text-default-400">
                        {typedUser?.email ?? 'No email'}
                      </Text>
                      {typedUser?.storeName ? (
                        <Text className="text-xs text-default-400">
                          {typedUser.storeName}
                        </Text>
                      ) : null}
                    </View>
                    <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-3">
                      <Ionicons name="qr-code-outline" size={20} color={colors.foreground} />
                    </View>
                  </View>

                  <Divider className="my-4 bg-divider/60" />

                  <TouchableOpacity className="flex-row items-center justify-between py-2">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="person-outline" size={22} color={colors.foreground} />
                      <Text className="text-base text-foreground">Avatar</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                </Card.Body>
              </Card>

              {/* Settings List Card */}
              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="gap-0 px-0 py-0">
                  <TouchableOpacity className="flex-row items-center justify-between px-5 py-4 border-b border-border/20">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="key-outline" size={22} color={colors.foreground} />
                      <Text className="text-base text-foreground">Account</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>

                  <TouchableOpacity className="flex-row items-center justify-between px-5 py-4 border-b border-border/20">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="lock-closed-outline" size={22} color={colors.foreground} />
                      <Text className="text-base text-foreground">Privacy</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>

                  <TouchableOpacity className="flex-row items-center justify-between px-5 py-4 border-b border-border/20">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="chatbubble-outline" size={22} color={colors.foreground} />
                      <Text className="text-base text-foreground">Chats</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>

                  <TouchableOpacity className="flex-row items-center justify-between px-5 py-4 border-b border-border/20">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
                      <Text className="text-base text-foreground">Notifications</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>

                  <TouchableOpacity className="flex-row items-center justify-between px-5 py-4 border-b border-border/20">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="card-outline" size={22} color={colors.foreground} />
                      <View className="flex-1">
                        <Text className="text-base text-foreground">Plan & Billing</Text>
                        <Text className="text-xs text-default-400 mt-0.5">{planLabel}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>

                  <TouchableOpacity className="flex-row items-center justify-between px-5 py-4">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="server-outline" size={22} color={colors.foreground} />
                      <Text className="text-base text-foreground">Storage and data</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                </Card.Body>
              </Card>

              {/* Help Card */}
              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="px-0 py-0">
                  <TouchableOpacity className="flex-row items-center justify-between px-5 py-4">
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="help-circle-outline" size={22} color={colors.foreground} />
                      <Text className="text-base text-foreground">Help and feedback</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
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
              <Button.LabelContent
                classNames={{ text: 'font-semibold text-white' }}
              >
                Sign Out
              </Button.LabelContent>
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
      <CustomBottomNav />
    </SafeAreaView>
  );
}
