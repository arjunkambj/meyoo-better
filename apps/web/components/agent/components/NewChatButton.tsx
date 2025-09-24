"use client";

import {Button, Tooltip} from "@heroui/react";
import {Icon} from "@iconify/react";

export default function NewChatButton({ onNew }: { onNew: () => void }) {
  return (
    <Tooltip content="New chat">
      <Button
        size="sm"
        variant="flat"
        color="primary"
        startContent={<Icon icon="solar:chat-square-like-bold" width={16} />}
        onPress={onNew}
      >
        New
      </Button>
    </Tooltip>
  );
}

