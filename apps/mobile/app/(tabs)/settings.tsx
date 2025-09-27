import { Button, Card, Chip, FormField, Skeleton, Switch } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View } from 'react-native';
import { useMemo, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';

import { useUserDetails } from '@/hooks/useUserDetails';

export default function SettingsTab() {
  const { billing, isLoading } = useUserDetails();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const plan = billing?.plan ?? 'free';
  const billingCopy = useMemo(() => {
    if (!billing) {
      return 'You are on the default free plan.';
    }

    const cycle = billing.billingCycle ? `${billing.billingCycle} billing` : null;
    const status = billing.status ? `Status: ${billing.status}` : null;
    return [cycle, status].filter(Boolean).join(' · ');
  }, [billing]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/auth');
  }, [signOut, router]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6 px-4 py-6">
          <View className="gap-2 px-2">
            <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Settings
            </Text>
            <Text className="text-2xl font-bold text-foreground">
              Account & Preferences
            </Text>
            <Text className="text-sm text-default-500">
              Manage your account settings and app preferences
            </Text>
          </View>

          {isLoading ? (
            <View className="gap-4">
              <Skeleton className="h-32 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-40 rounded-3xl" />
            </View>
          ) : (
            <View className="gap-4">
              {/* Subscription Card */}
              <Card surfaceVariant="2">
                <Card.Header>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="card-outline" size={20} color="#666" />
                    <Text className="text-sm font-semibold uppercase text-default-600">
                      Subscription
                    </Text>
                  </View>
                </Card.Header>
                <Card.Body>
                  <View className="gap-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Chip
                          size="md"
                          color={plan === 'free' ? 'default' : 'accent'}
                          className="rounded-full"
                        >
                          <Text className="text-xs font-bold uppercase tracking-wider">
                            {plan === 'free' ? 'Free Plan' : plan}
                          </Text>
                        </Chip>
                        {plan !== 'free' && (
                          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                        )}
                      </View>
                    </View>

                    {plan === 'free' ? (
                      <View className="gap-2">
                        <Text className="text-sm font-medium text-foreground">
                          You&apos;re on the free plan
                        </Text>
                        <Text className="text-xs text-default-500">
                          Upgrade to unlock advanced features and analytics
                        </Text>
                      </View>
                    ) : (
                      <View className="gap-2">
                        <Text className="text-sm font-medium text-foreground">
                          {billingCopy}
                        </Text>
                      </View>
                    )}
                  </View>
                </Card.Body>
                <Card.Footer className="gap-2">
                  {plan === 'free' ? (
                    <Button variant="primary" size="sm" className="flex-1">
                      <Button.StartContent>
                        <Ionicons name="rocket-outline" size={16} color="white" />
                      </Button.StartContent>
                      <Button.LabelContent>Upgrade Plan</Button.LabelContent>
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" className="flex-1">
                      <Button.StartContent>
                        <Ionicons name="settings-outline" size={16} />
                      </Button.StartContent>
                      <Button.LabelContent>Manage Subscription</Button.LabelContent>
                    </Button>
                  )}
                </Card.Footer>
              </Card>

              {/* Preferences Card */}
              <Card surfaceVariant="1">
                <Card.Header>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="settings-outline" size={20} color="#666" />
                    <Text className="text-sm font-semibold uppercase text-default-600">
                      Preferences
                    </Text>
                  </View>
                </Card.Header>
                <Card.Body>
                  <FormField isSelected={darkModeEnabled} onSelectedChange={setDarkModeEnabled}>
                    <FormField.Content>
                      <FormField.Title>Dark Mode</FormField.Title>
                      <FormField.Description>
                        Use dark theme (follows system setting)
                      </FormField.Description>
                    </FormField.Content>
                    <FormField.Indicator>
                      <Switch isSelected={darkModeEnabled} onSelectedChange={setDarkModeEnabled}>
                        <Switch.Thumb />
                      </Switch>
                    </FormField.Indicator>
                  </FormField>
                </Card.Body>
              </Card>

              {/* Sign Out Button */}
              <View className="mt-6 mb-4">
                <Button variant="danger" size="lg" onPress={handleSignOut} className="h-12">
                  <Button.StartContent>
                    <Ionicons name="log-out-outline" size={20} color="white" />
                  </Button.StartContent>
                  <Button.LabelContent>Sign Out</Button.LabelContent>
                </Button>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}