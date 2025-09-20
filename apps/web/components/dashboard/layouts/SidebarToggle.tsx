"use client";

import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";

import { sidebarOpenAtom } from "@/store/atoms";

export default function SidebarToggle() {
  const isOpen = useAtomValue(sidebarOpenAtom);
  const setIsOpen = useSetAtom(sidebarOpenAtom);

  const handleToggle = useCallback(() => {
    setIsOpen((prev: boolean) => !prev);
  }, [setIsOpen]);

  const tooltipContent = useMemo(
    () => (isOpen ? "Close sidebar" : "Open sidebar"),
    [isOpen]
  );

  const iconContent = useMemo(
    () => (
      <Icon
        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}
        icon="solar:hamburger-menu-linear"
        width={24}
      />
    ),
    [isOpen]
  );

  return (
    <Tooltip closeDelay={0} content={tooltipContent} placement="bottom">
      <Button
        isIconOnly
        aria-label="Toggle sidebar"
        className="text-default-600"
        size="sm"
        variant="light"
        onPress={handleToggle}
      >
        {iconContent}
      </Button>
    </Tooltip>
  );
}
