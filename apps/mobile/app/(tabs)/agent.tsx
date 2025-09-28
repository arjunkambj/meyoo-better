import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentPanel } from '@/components/agent';

export default function AgentTabScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <AgentPanel />
    </SafeAreaView>
  );
}

