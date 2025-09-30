import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NavItem {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  label: string;
}

const navItems: NavItem[] = [
  { name: 'overview', icon: 'home', route: '/overview', label: 'Home' },
  { name: 'settings', icon: 'settings', route: '/settings', label: 'Settings' },
];

export function CustomBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const isActive = (route: string) => pathname === route;

  const handleNavPress = (route: string) => {
    router.push(route as any);
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <View
        className="absolute left-0 right-0 bottom-0 bg-surface-2 border-t border-border/40"
        style={{ paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-center justify-around px-4 py-2">
          {/* Home Button */}
          <TouchableOpacity
            onPress={() => handleNavPress(navItems[0].route)}
            className="items-center justify-center py-2 px-4"
          >
            <View
              className={`h-12 w-12 rounded-2xl items-center justify-center ${
                isActive(navItems[0].route) ? 'bg-primary' : 'bg-transparent'
              }`}
            >
              <Ionicons
                name={navItems[0].icon}
                size={24}
                color={isActive(navItems[0].route) ? '#ffffff' : colors.foreground}
              />
            </View>
            <Text
              className={`text-xs font-semibold mt-1 ${
                isActive(navItems[0].route) ? 'text-primary' : 'text-default-500'
              }`}
            >
              {navItems[0].label}
            </Text>
          </TouchableOpacity>

          {/* Custom KPI Button 1 */}
          <TouchableOpacity
            onPress={() => router.push('/overview')}
            className="items-center justify-center py-2 px-2"
          >
            <View className="h-12 w-12 rounded-2xl bg-green-500/10 items-center justify-center border border-green-500/20">
              <Ionicons name="trending-up" size={22} color="#10b981" />
            </View>
            <Text className="text-xs font-semibold text-default-500 mt-1">
              Revenue
            </Text>
          </TouchableOpacity>

          {/* Floating Agent Button (Center) */}
          <View className="relative -top-6">
            <TouchableOpacity
              onPress={() => router.push('/agent')}
              className="h-16 w-16 rounded-full items-center justify-center"
              style={{
                backgroundColor: '#6366f1',
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Ionicons
                name="sparkles"
                size={28}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>

          {/* Custom KPI Button 2 */}
          <TouchableOpacity
            onPress={() => router.push('/overview')}
            className="items-center justify-center py-2 px-2"
          >
            <View className="h-12 w-12 rounded-2xl bg-blue-500/10 items-center justify-center border border-blue-500/20">
              <Ionicons name="cart" size={22} color="#3b82f6" />
            </View>
            <Text className="text-xs font-semibold text-default-500 mt-1">
              Orders
            </Text>
          </TouchableOpacity>

          {/* Settings Button */}
          <TouchableOpacity
            onPress={() => handleNavPress(navItems[1].route)}
            className="items-center justify-center py-2 px-4"
          >
            <View
              className={`h-12 w-12 rounded-2xl items-center justify-center ${
                isActive(navItems[1].route) ? 'bg-primary' : 'bg-transparent'
              }`}
            >
              <Ionicons
                name={navItems[1].icon}
                size={24}
                color={isActive(navItems[1].route) ? '#ffffff' : colors.foreground}
              />
            </View>
            <Text
              className={`text-xs font-semibold mt-1 ${
                isActive(navItems[1].route) ? 'text-primary' : 'text-default-500'
              }`}
            >
              {navItems[1].label}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}