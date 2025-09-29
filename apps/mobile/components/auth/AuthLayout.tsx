import { Children, type ReactNode, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Surface, useTheme } from 'heroui-native';

type CompatibleReactNode = Exclude<ReactNode, Promise<ReactNode>>;

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  footer?: CompatibleReactNode;
  children?: CompatibleReactNode;
}

export function AuthLayout({ title, subtitle, footer, children = null }: AuthLayoutProps) {
  const { colors, isDark } = useTheme();
  const content = <>{Children.toArray(children ?? null)}</>;
  const footerContent = footer
    ? (() => {
        const nodes = Children.toArray(footer);
        return nodes.length > 0 ? <>{nodes}</> : null;
      })()
    : null;

  const accentBackground = useMemo(
    () => colors.accentSoft ?? colors.accent ?? '#6366f1',
    [colors],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <View className="absolute inset-0">
          <View
            className="h-56 rounded-b-[40px]"
            style={{
              backgroundColor: accentBackground,
              opacity: isDark ? 0.55 : 0.95,
            }}
          />
        </View>

        <ScrollView
          bounces={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pb-10 pt-12">
            <View className="gap-2 mb-1">
              <Text className="text-xs font-semibold uppercase tracking-[0.35em] text-default-500">
                Meyoo
              </Text>
              <Text className="text-3xl font-semibold text-foreground leading-tight">{title}</Text>
              {subtitle ? (
                <Text className="text-sm leading-6 text-default-500 mt-1">{subtitle}</Text>
              ) : null}
            </View>

            <Surface
              variant="1"
              className="mt-8 gap-8 rounded-3xl border border-divider/30 bg-background/90 p-6"
            >
              {content}
            </Surface>

            {footerContent ? (
              <View className="mt-8 gap-3">{footerContent}</View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
