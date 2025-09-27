import { NativeTabs, Icon } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="overview">
        <Icon sf="house.fill" drawable="house_fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agent">
        <Icon sf="sparkles" drawable="sparkles" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf="gear" drawable="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}