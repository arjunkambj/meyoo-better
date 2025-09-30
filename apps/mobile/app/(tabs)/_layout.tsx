import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from 'heroui-native';

import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  const { colors } = useTheme();

  const backgroundColor = colors.background ?? '#ffffff';
  const inactiveColor = colors.default ?? colors.foreground ?? '#6b7280';
  const resolvedAccent = 'accent' in colors ? colors.accent : undefined;
  const activeColor = resolvedAccent ?? colors.foreground ?? '#2563EB';

  return (
    <NativeTabs
      backgroundColor={backgroundColor}
      iconColor={inactiveColor}
      tintColor={activeColor}
      labelStyle={{
        fontSize: 12,
        fontFamily: 'Inter_500Medium',
        color: inactiveColor,
      }}
    >
      <NativeTabs.Trigger name="overview">
        <Icon
          selectedColor={activeColor}
          src={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <Label selectedStyle={{ color: activeColor }}>Overview</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agent">
        <Icon
          selectedColor={activeColor}
          src={{
            default: <VectorIcon family={Ionicons} name="sparkles-outline" />,
            selected: <VectorIcon family={Ionicons} name="sparkles" />,
          }}
        />
        <Label selectedStyle={{ color: activeColor }}>Agent</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon
          selectedColor={activeColor}
          src={{
            default: <VectorIcon family={Ionicons} name="settings-outline" />,
            selected: <VectorIcon family={Ionicons} name="settings" />,
          }}
        />
        <Label selectedStyle={{ color: activeColor }}>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
