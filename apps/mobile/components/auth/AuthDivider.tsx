import { View, Text } from 'react-native';

export function AuthDivider() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 h-px bg-default-300" />
      <Text className="text-sm text-default-500">Or Continue With</Text>
      <View className="flex-1 h-px bg-default-300" />
    </View>
  );
}