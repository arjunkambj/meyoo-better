import React from "react";
import { Text, View } from "react-native";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  spacing?: "default" | "compact";
};

export function SectionHeader({ title, subtitle, spacing = "default" }: SectionHeaderProps) {
  const gapClass = spacing === "compact" ? "gap-1" : "gap-2";

  return (
    <View className={`w-full ${gapClass}`}>
      <Text className="text-3xl font-semibold text-foreground">{title}</Text>
      {subtitle ? <Text className="text-base text-muted-foreground">{subtitle}</Text> : null}
    </View>
  );
}
