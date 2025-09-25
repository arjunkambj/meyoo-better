import React from "react";
import { Text, View } from "react-native";
import type { ViewProps } from "react-native";

type SectionCardProps = {
  title?: string;
  description?: string;
  spacing?: "default" | "tight";
  children?: ViewProps["children"];
};

export function SectionCard({ title, description, children, spacing = "default" }: SectionCardProps) {
  const gap = spacing === "tight" ? "gap-2" : "gap-3";

  return (
    <View className={`rounded-3xl bg-background/70 p-4 ${gap}`}>
      {title ? <Text className="text-sm font-medium text-foreground">{title}</Text> : null}
      {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
      <View className="gap-3">{children}</View>
    </View>
  );
}
