import { ScrollView, Text } from 'react-native';
import { Card, Chip } from 'heroui-native';

export type AgentTip = {
  title: string;
  description: string;
  badgeLabel?: string;
};

type AgentTipCarouselProps = {
  tips: AgentTip[];
  defaultBadgeLabel?: string;
};

export function AgentTipCarousel({
  tips,
  defaultBadgeLabel = 'Workflow tip',
}: AgentTipCarouselProps) {
  if (!tips || tips.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 4 }}
    >
      {tips.map((tip) => (
        <Card key={tip.title} className="w-[260px] gap-2 p-4">
          <Chip size="sm" color="accent" className="self-start rounded-full">
            {tip.badgeLabel ?? defaultBadgeLabel}
          </Chip>
          <Text className="text-sm font-semibold text-foreground">
            {tip.title}
          </Text>
          <Text className="text-xs leading-5 text-default-500">
            {tip.description}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}
