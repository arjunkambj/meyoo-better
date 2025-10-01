import { useCallback } from 'react';
import { AgentChatScreen } from '@/components/agent/screens/AgentChatScreen';
import { useTabBar } from '@/contexts/TabBarContext';
import { useFocusEffect } from 'expo-router';

export default function AgentScreen() {
  const { hideTabBar, showTabBar } = useTabBar();

  useFocusEffect(
    useCallback(() => {
      hideTabBar();
      return () => {
        showTabBar();
      };
    }, [hideTabBar, showTabBar]),
  );

  return <AgentChatScreen />;
}
