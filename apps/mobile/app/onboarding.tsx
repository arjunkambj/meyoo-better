import { Button, Chip } from 'heroui-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View } from 'react-native';

const PLACEHOLDER_FEATURES = [
  {
    title: 'Guided checklists',
    description:
      'Track progress for Shopify, marketing, and finance tasks without leaving the mobile dashboard.',
  },
  {
    title: 'Status at a glance',
    description:
      'See which integrations are connected and what still needs your attention from any device.',
  },
  {
    title: 'Finish on desktop',
    description:
      'Complete detailed setup on the web today and pick up the same flow here once it ships.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-8 px-6 py-12">
          <View className="gap-4 rounded-3xl border border-primary/20 bg-primary-500/10 p-6">
            <Chip
              className="self-start rounded-full border border-primary/30 bg-primary-500/10 text-primary"
              color="accent"
              size="sm"
            >
              Mobile preview
            </Chip>
            <View className="gap-2">
              <Text className="text-3xl font-bold text-foreground leading-tight">
                Onboarding is landing on mobile soon
              </Text>
              <Text className="text-base leading-6 text-default-500">
                We’re polishing the guided setup for phones. For now, keep using the web experience to connect Shopify, billing, and marketing tools.
              </Text>
            </View>
          </View>

          <View className="gap-4">
            {PLACEHOLDER_FEATURES.map((feature) => (
              <View
                key={feature.title}
                className="gap-2 rounded-2xl border border-default-100/70 bg-default-100/40 p-5"
              >
                <Text className="text-lg font-semibold text-foreground">
                  {feature.title}
                </Text>
                <Text className="text-sm leading-6 text-default-500">
                  {feature.description}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-auto gap-4">
            <Button
              className="h-12"
              variant="primary"
              onPress={() => router.replace('/(tabs)/overview')}
            >
              Jump to the dashboard
            </Button>
            <Button
              className="h-12"
              variant="secondary"
              onPress={() => router.push('/auth')}
            >
              Switch account or sign in later
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
