import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { useTheme } from "heroui-native";

type OAuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
};

export function OAuthButton({ label, onPress, loading }: OAuthButtonProps) {
  const { isDark } = useTheme();
  const backgroundClass = isDark ? "bg-white" : "bg-neutral-900";
  const textClass = isDark ? "text-black" : "text-white";
  const spinnerColor = isDark ? "#000000" : "#ffffff";

  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      className={`flex-row items-center justify-center rounded-full px-6 py-3 ${backgroundClass} ${
        loading ? "opacity-70" : ""
      }`}
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text className={`text-base font-medium ${textClass}`}>{label}</Text>
      )}
    </Pressable>
  );
}
