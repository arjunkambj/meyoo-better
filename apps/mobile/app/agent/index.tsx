import { View } from 'react-native';
import { AgentChatScreen } from '@/components/agent/screens/AgentChatScreen';

export default function AgentScreen() {
  return (
    <View className="flex-1 bg-background">
      <AgentChatScreen />
    </View>
  );
}

