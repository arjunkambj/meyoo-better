import { useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentConversationsScreen } from '@/components/agent/screens/AgentConversationsScreen';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTabBar } from '@/contexts/TabBarContext';

export default function ChatHistoryScreen() {
  const router = useRouter();
  const { hideTabBar, showTabBar } = useTabBar();

  useFocusEffect(
    useCallback(() => {
      hideTabBar();
      return () => {
        showTabBar();
      };
    }, [hideTabBar, showTabBar]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-2"
        >
          <Ionicons name="chevron-back" size={24} color="#666" />
        </TouchableOpacity>
        <Text className="flex-1 mx-3 text-center text-lg font-semibold text-foreground">
          Chat History
        </Text>
        <View className="h-10 w-10" />
      </View>

      {/* Conversations List */}
      <AgentConversationsScreen />
    </SafeAreaView>
  );
}
