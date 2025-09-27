import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { usePathname, useRouter } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const isAgentScreen = pathname?.includes('/agent');

  // If on agent screen, show custom header with back button
  if (isAgentScreen) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-row items-center px-4 py-3 border-b border-default-100">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/overview')}
            className="p-2 -ml-2"
          >
            <Ionicons name="arrow-back" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <NativeTabs
          style={{ flex: 1 }}
          tabBarHidden={true}
        >
          <NativeTabs.Trigger name="overview">
            <Label>Overview</Label>
            <Icon sf="chart.bar.fill" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="agent">
            <Label>Agent</Label>
            <Icon sf="sparkles" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings">
            <Label>Settings</Label>
            <Icon sf="gearshape.fill" />
          </NativeTabs.Trigger>
        </NativeTabs>
      </SafeAreaView>
    );
  }

  // Normal tab bar display
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="overview">
        <Label>Overview</Label>
        <Icon sf="chart.bar.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agent">
        <Label>Agent</Label>
        <Icon sf="sparkles" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon sf="gearshape.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
