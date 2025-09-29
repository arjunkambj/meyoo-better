"use client";

import { Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function NewChatButton({ onNew }: { onNew: () => void }) {
  return (
    <Tooltip content="Start new chat">
      <Button
        size="sm"
        color="primary"
        startContent={
          <Icon icon="solar:pen-new-square-bold-duotone" width={18} />
        }
        onPress={onNew}
        className="hover:bg-primary/20 transition-colors"
      >
        New chat
      </Button>
    </Tooltip>
  );
}
