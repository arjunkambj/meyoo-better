"use client";

import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { agentSidebarOpenAtom } from "@/store/atoms";

export default function AgentToggle() {
  const [isOpen, setIsOpen] = useAtom(agentSidebarOpenAtom);

  if (isOpen) return null; // Hide toggle when sidebar is open

  return (
    <Tooltip content="AI Assistant" placement="left" delay={300}>
      <Button
        isIconOnly
        className="fixed right-4 bottom-20 z-40 bg-gradient-to-br from-primary to-primary-600 text-primary-foreground hover:shadow-lg hover:shadow-primary/30 transition-all hover:scale-110 active:scale-95"
        radius="full"
        size="lg"
        onPress={() => setIsOpen(true)}
      >
        <Icon icon="solar:chat-round-dots-bold-duotone" width={26} />
      </Button>
    </Tooltip>
  );
}
