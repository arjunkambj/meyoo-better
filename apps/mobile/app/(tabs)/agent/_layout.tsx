import { Stack } from 'expo-router';
import { useTheme } from 'heroui-native';

export default function AgentLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        fullScreenGestureEnabled: true,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
    </Stack>
  );
}