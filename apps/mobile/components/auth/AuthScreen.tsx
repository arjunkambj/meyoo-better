import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AuthScreen({ title, subtitle, children }: AuthScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4 py-8 gap-8">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[0.35em] text-default-500">
            Meyoo
          </Text>
          <Text className="text-3xl font-semibold text-foreground leading-tight">
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-sm leading-6 text-default-500 mt-1">{subtitle}</Text>
          ) : null}
        </View>

        <View className="flex-1 gap-6">{children as any}</View>
      </View>
    </SafeAreaView>
  );
}
