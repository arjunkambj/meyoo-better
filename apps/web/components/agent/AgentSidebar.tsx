"use client";

import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { agentSidebarOpenAtom } from "@/store/atoms";
import { cn } from "@heroui/theme";
import ChatUI from "@/components/agent/ChatUI";

export default function AgentSidebar({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useAtom(agentSidebarOpenAtom);
  const [isMobile, setIsMobile] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else if (shouldRender) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  return (
    <>
      {isMobile && (
        <div
          className={cn(
            "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300",
            isAnimating ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        className={cn(
          "h-full bg-default-50 px-1 pb-2",
          "flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
          "border-l border-default-100",
          isMobile
            ? cn(
                "fixed right-0 top-0 bottom-0 w-full max-w-lg z-50 transform",
                isAnimating ? "translate-x-0" : "translate-x-full"
              )
            : cn(
                "relative",
                isAnimating ? "w-[32rem] opacity-100" : "w-0 opacity-0"
              )
        )}
      >
        {isMobile && (
          <div className="absolute top-3 right-3 z-10">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              radius="lg"
              onPress={() => setIsOpen(false)}
              className="hover:bg-default-200 transition-colors"
            >
              <Icon icon="solar:close-circle-bold-duotone" width={20} />
            </Button>
          </div>
        )}
        <div
          className={cn(
            "h-full flex flex-col",
            "transition-opacity duration-500 delay-100",
            isAnimating ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex-1 overflow-hidden">{children ?? <ChatUI />}</div>
        </div>
      </aside>
    </>
  );
}
