import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTheme } from "heroui-native";

import { useTabBar } from "@/contexts/TabBarContext";

export default function TabsLayout() {
  const { colors } = useTheme();
  const palette = colors as Record<string, string>;
  const { isTabBarVisible } = useTabBar();

  const backgroundColor = palette.background ?? "#ffffff";
  const accentColor = palette.primary ?? palette.accent;
  const activeColor = accentColor ?? "#2563EB";
  const inactiveColor = "#6b7280";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "Inter_500Medium",
        },
        tabBarStyle: {
          backgroundColor,
          borderTopWidth: 0,
          elevation: 0,
          paddingVertical: 6,
          display: isTabBarVisible ? "flex" : "none",
        },
      }}
    >
      <Tabs.Screen
        name="overview"
        options={{
          title: "Overview",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      {/* Agent tab removed */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
