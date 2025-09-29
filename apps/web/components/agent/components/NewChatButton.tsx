"use client";

import { Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function NewChatButton({ onNew }: { onNew: () => void }) {
  return (
    <Tooltip content="Start new conversation" delay={500}>
      <Button
        size="sm"
        color="primary"
        variant="flat"
        startContent={
          <Icon icon="solar:pen-new-square-bold-duotone" width={18} />
        }
        onPress={onNew}
        radius="lg"
        className="hover:scale-105 transition-transform font-medium"
      >
        New chat
      </Button>
    </Tooltip>
  );
}
