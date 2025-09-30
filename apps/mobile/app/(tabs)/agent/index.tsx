import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentChatScreen } from '@/components/agent/screens/AgentChatScreen';

export default function AgentScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <AgentChatScreen />
    </SafeAreaView>
  );
}

