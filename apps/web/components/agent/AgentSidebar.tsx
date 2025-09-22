"use client";

import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { agentSidebarOpenAtom } from "@/store/atoms";
import { cn } from "@heroui/theme";

export default function AgentSidebar() {
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
        "h-full bg-content1 border-l border-default-100",
        "flex flex-col transition-all duration-300 ease-in-out",
        isMobile ? "w-full absolute inset-0 z-50" : "w-[28rem]"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-default-100">
        <span className="font-semibold">What are you working on?</span>
        {/* Only show close button on mobile */}
        {isMobile && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => setIsOpen(false)}
          >
            <Icon icon="solar:close-circle-line-duotone" width={20} />
          </Button>
        )}
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center justify-center h-full text-default-500">
          <p>AI features coming soon...</p>
        </div>
      </div>
    </aside>
  );
}