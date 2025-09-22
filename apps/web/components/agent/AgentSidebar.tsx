"use client";

import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { agentSidebarOpenAtom } from "@/store/atoms";
import { cn } from "@heroui/theme";
import { ChatSidebar } from "@/components/agent/ai-elements";

export default function AgentSidebar({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useAtom(agentSidebarOpenAtom);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <aside
      className={cn(
        "h-full bg-background border-l border-default-100",
        "flex flex-col transition-all duration-300 ease-in-out",
        isMobile ? "w-full absolute inset-0 z-50" : "w-[32rem]"
      )}
    >
      {isMobile && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setIsOpen(false)}
          >
            <Icon icon="solar:close-circle-line-duotone" width={20} />
          </Button>
        </div>
      )}
      <ChatSidebar className="h-full" />
      {children}
    </aside>
  );
}
