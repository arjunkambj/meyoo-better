import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentConversationsScreen } from '@/components/agent/screens/AgentConversationsScreen';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChatHistoryScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-default-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#666" />
        </TouchableOpacity>
        <View className="flex-1 ml-3">
          <Text className="text-lg font-semibold text-foreground">
            Chat History
          </Text>
        </View>
      </View>

      {/* Conversations List */}
      <AgentConversationsScreen />
    </SafeAreaView>
  );
}