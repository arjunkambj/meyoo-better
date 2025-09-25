import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStatus } from "@/hooks/useAuthStatus";

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View className="absolute bottom-6 left-0 right-0 items-center">
      <View className="flex-row rounded-full bg-background/95 px-4 py-2">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const labelOption =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const tintColor = focused ? "#ffffff" : "#8b8b8b";
          const icon = options.tabBarIcon
            ? options.tabBarIcon({ focused, color: tintColor, size: 18 })
            : null;

          const labelText =
            typeof labelOption === "function"
              ? labelOption({
                  focused,
                  color: tintColor,
                  position: "below-icon",
                  children: route.name,
                })
              : labelOption;
          const renderedLabel =
            typeof labelText === "string" || typeof labelText === "number"
              ? labelText
              : route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              className={`mx-2 flex-row items-center rounded-full px-3 py-2 ${
                focused ? "bg-primary" : "bg-transparent"
              }`}
            >
              {icon}
              <Text
                className={`ml-2 text-sm font-medium ${
                  focused ? "text-white" : "text-muted-foreground"
                }`}
              >
                {renderedLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStatus();

  const tabIcons = useMemo(
    () => ({
      overview: (focused: boolean) => (
        <Ionicons
          name={focused ? "speedometer" : "speedometer-outline"}
          size={18}
          color={focused ? "#ffffff" : "#8b8b8b"}
        />
      ),
      ads: (focused: boolean) => (
        <Ionicons
          name={focused ? "trending-up" : "trending-up-outline"}
          size={18}
          color={focused ? "#ffffff" : "#8b8b8b"}
        />
      ),
      settings: (focused: boolean) => (
        <Ionicons
          name={focused ? "settings" : "settings-outline"}
          size={18}
          color={focused ? "#ffffff" : "#8b8b8b"}
        />
      ),
    }),
    [],
  );

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen
        name="overview"
        options={{
          title: "Overview",
          tabBarIcon: ({ focused }) => tabIcons.overview(focused),
        }}
      />
      <Tabs.Screen
        name="ads"
        options={{
          title: "Ads",
          tabBarIcon: ({ focused }) => tabIcons.ads(focused),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => tabIcons.settings(focused),
        }}
      />
    </Tabs>
  );
}
