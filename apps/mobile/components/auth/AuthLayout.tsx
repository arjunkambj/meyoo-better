import { Children, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CompatibleReactNode = Exclude<ReactNode, Promise<ReactNode>>;

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  footer?: CompatibleReactNode;
  children?: CompatibleReactNode;
}

export function AuthLayout({ title, subtitle, footer, children = null }: AuthLayoutProps) {
  const content = <>{Children.toArray(children ?? null)}</>;
  const footerContent = footer
    ? (() => {
        const nodes = Children.toArray(footer);
        return nodes.length > 0 ? <>{nodes}</> : null;
      })()
    : null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 py-10 gap-12">
          <View className="gap-2">
            <Text className="text-3xl font-black text-foreground">meyoo</Text>
            <Text className="text-lg font-semibold text-foreground">{title}</Text>
            {subtitle ? (
              <Text className="text-sm text-default-500">{subtitle}</Text>
            ) : null}
          </View>

          <View className="gap-8">{content}</View>

          {footerContent ? <View className="mt-auto gap-3">{footerContent}</View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
