import { Avatar, Button, Card, Chip, Skeleton, useTheme } from 'heroui-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { useUserDetails } from '@/hooks/useUserDetails';

type CurrentUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  storeName?: string | null;
  organizationName?: string | null;
} | null;

export default function SettingsTab() {
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

  const typedUser = user as CurrentUser;

  const displayName = useMemo(() => {
    if (!typedUser) return 'Meyoo Merchant';
    if (typedUser.name && typedUser.name.trim().length > 0) {
      return typedUser.name;
    }
    return typedUser.email ?? 'Meyoo Merchant';
  }, [typedUser]);

  const avatarSource = useMemo(() => {
    if (!typedUser?.image) return undefined;
    const image = typedUser.image.trim();
    return image.length > 0 ? { uri: image } : undefined;
  }, [typedUser?.image]);

  const avatarInitials = useMemo(() => {
    if (!displayName) return 'MM';
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length === 0) {
      return 'MM';
    }
    return (
      parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'MM'
    );
  }, [displayName]);

  const organizationLabel = useMemo(() => {
    return typedUser?.storeName ?? typedUser?.organizationName ?? null;
  }, [typedUser?.organizationName, typedUser?.storeName]);

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

  const usageProgress = useMemo(() => {
    if (!billingUsage) return 0;
    const normalized = Number.isFinite(billingUsage.percentage)
      ? Math.max(0, Math.min(100, billingUsage.percentage))
      : 0;
    return Math.round(normalized);
  }, [billingUsage]);

  const usageSummary = useMemo(() => {
    if (!billingUsage) {
      return 'Usage syncs automatically from your Meyoo workspace.';
    }

    if (billingUsage.limit > 0) {
      return `${billingUsage.currentUsage.toLocaleString()} of ${billingUsage.limit.toLocaleString()} actions used`;
    }

    return `${billingUsage.currentUsage.toLocaleString()} actions used this cycle`;
  }, [billingUsage]);

  const usageHelperText = useMemo(() => {
    if (!billingUsage) {
      return 'We\'ll keep your usage up to date here.';
    }

    if (billingUsage.requiresUpgrade) {
      return 'You are approaching your plan limit. Contact support to explore upgrades.';
    }

    if (billingUsage.month) {
      return `Tracking usage for ${billingUsage.month}.`;
    }

    return 'Usage resets at the start of each billing cycle.';
  }, [billingUsage]);

  const billingStatusLabel = useMemo(() => {
    if (billingUsage?.isOnTrial) {
      if (billingUsage.daysLeftInTrial > 1) {
        return `${billingUsage.daysLeftInTrial} days left in trial`;
      }
      if (billingUsage.daysLeftInTrial === 1) {
        return 'Trial ends tomorrow';
      }
      return 'Trial ends today';
    }

    switch (billing?.status) {
      case 'active':
        return 'Plan active';
      case 'trial':
        return 'Trial active';
      case 'cancelled':
        return 'Plan cancelled';
      case 'suspended':
        return 'Plan suspended';
      default:
        return billing?.isPremium ? 'Premium plan active' : 'Free plan';
    }
  }, [billing, billingUsage]);

  const supportEmail = 'support@meyoo.ai';

  const handleEmailSupport = useCallback(async () => {
    const mailTo = `mailto:${supportEmail}`;

    try {
      const canOpen = await Linking.canOpenURL(mailTo);
      if (canOpen) {
        await Linking.openURL(mailTo);
        return;
      }
    } catch (error) {
      console.error('Failed to open mail client', error);
    }

    Alert.alert('Contact support', `Email ${supportEmail} and we\'ll jump in.`);
  }, [supportEmail]);

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
          paddingTop: headerHeight + insets.top + 12,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4 px-5">
          {isLoading ? (
            <View className="gap-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </View>
          ) : (
            <View className="gap-4 pb-8">
              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="gap-4 px-5 py-5">
                  <View className="flex-row items-center gap-4">
                    <Avatar size="lg" color="accent" alt={displayName ?? 'User avatar'}>
                      {avatarSource ? <Avatar.Image source={avatarSource} /> : null}
                      <Avatar.Fallback entering={undefined}>{avatarInitials}</Avatar.Fallback>
                    </Avatar>

                    <View className="flex-1 gap-1">
                      <Text className="text-lg font-bold text-foreground">
                        {displayName}
                      </Text>
                      {typedUser?.email ? (
                        <Text className="text-sm text-default-400">
                          {typedUser.email}
                        </Text>
                      ) : null}
                      {organizationLabel ? (
                        <Text className="text-xs text-default-400">
                          {organizationLabel}
                        </Text>
                      ) : null}
                    </View>

                    <Chip size="sm" color={billing?.isPremium ? 'accent' : 'default'}>
                      <Chip.LabelContent className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                        {planLabel}
                      </Chip.LabelContent>
                    </Chip>
                  </View>
                </Card.Body>
              </Card>

              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="gap-4 px-5 py-5">
                  <View className="flex-row items-center justify-between">
                    <View className="gap-1">
                      <Text className="text-base font-semibold text-foreground">
                        Plan & usage
                      </Text>
                      <Text className="text-xs text-default-400">
                        {billingStatusLabel}
                      </Text>
                    </View>
                    <Ionicons name="card-outline" size={22} color={colors.foreground} />
                  </View>

                  <View className="gap-2">
                    <View className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                      <View
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${usageProgress}%` }}
                      />
                    </View>
                    <Text className="text-sm text-foreground">{usageSummary}</Text>
                    <Text
                      className={`text-xs ${billingUsage?.requiresUpgrade ? 'text-danger' : 'text-default-400'}`}
                    >
                      {usageHelperText}
                    </Text>
                  </View>

                </Card.Body>
              </Card>

              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="gap-3 px-5 py-5">
                  <View className="gap-1">
                    <Text className="text-base font-semibold text-foreground">
                      Need a hand?
                    </Text>
                    <Text className="text-xs text-default-400">
                      {'Drop a line and we\'ll follow up quickly.'}
                    </Text>
                  </View>

                  <Button
                    variant="ghost"
                    size="lg"
                    className="h-12 rounded-2xl border border-border/40"
                    onPress={handleEmailSupport}
                  >
                    <Button.StartContent>
                      <Ionicons name="mail-outline" size={20} color={colors.foreground} />
                    </Button.StartContent>
                    <Button.LabelContent classNames={{ text: 'font-semibold text-foreground' }}>
                      Email {supportEmail}
                    </Button.LabelContent>
                  </Button>
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
                <Button.LabelContent classNames={{ text: 'font-semibold text-white' }}>
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
