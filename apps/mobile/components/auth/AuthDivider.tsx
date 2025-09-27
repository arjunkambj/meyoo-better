import { View, Text } from 'react-native';

export function AuthDivider() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 h-px bg-default-200" />
      <Text className="text-sm text-default-400">or</Text>
      <View className="flex-1 h-px bg-default-200" />
    </View>
  );
}