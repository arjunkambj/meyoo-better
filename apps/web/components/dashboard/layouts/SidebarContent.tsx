"use client";

import { Button } from "@heroui/button";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { cn } from "@heroui/theme";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useCallback, useMemo } from "react";

import { Logo } from "@/components/shared/Logo";
import { DASHBOARD_SIDEBAR_ITEMS } from "@/constants/navigation/dashboard-sidebar";
import { sidebarOpenAtom } from "@/store/atoms";
import { FooterItems } from "./FooterItems";
import SidebarMenu from "./SidebarMenu";

interface SidebarContentProps {
  onClose: () => void;
}

const SidebarContent = React.memo(({ onClose }: SidebarContentProps) => {
  const [isOpen] = useAtom(sidebarOpenAtom);
  const pathname = usePathname();

  const containerClasses = useMemo(
    () =>
      `relative flex h-full max-w-66 flex-1 flex-col bg-content2/95 dark:bg-content1 rounded-3xl  transition-all duration-300 ease-in-out ${
        isOpen
          ? "w-66 px-5 py-6 opacity-100 overflow-visible ml-6"
          : "w-0 p-0 opacity-0 overflow-hidden"
      }`,
    [isOpen]
  );

  const scrollShadowClasses = useMemo(
    () =>
      `h-full max-h-full transition-all duration-300 ${
        isOpen ? "-mx-4 px-4 opacity-100" : "opacity-0"
      }`,
    [isOpen]
  );

  const handleCloseClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const logoSection = useMemo(
    () => (
      <div className="flex items-center justify-between px-3 py-2">
        <Logo />
        {/* Close button - only visible on mobile */}
        <Button
          isIconOnly
          aria-label="Close sidebar"
          className="sm:hidden absolute right-2 top-2"
          size="sm"
          variant="light"
          onPress={handleCloseClick}
        >
          <Icon icon="solar:close-circle-bold" width={20} />
        </Button>
      </div>
    ),
    [handleCloseClick]
  );

  const overviewItem = useMemo(
    () => (
      <Link
        aria-current={pathname === "/overview" ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-4 rounded-xl transition-all duration-200 min-h-10",
          "no-underline w-full mb-2",
          pathname === "/overview"
            ? "bg-primary/20 text-primary font-medium"
            : "text-default-800 hover:text-default-900 hover:bg-default-200"
        )}
        href="/overview"
        prefetch={true}
      >
        <Icon
          aria-hidden
          className={cn(
            "shrink-0 transition-colors w-5 h-5",
            pathname === "/overview" && "text-primary"
          )}
          icon="solar:home-2-linear"
        />
        <span className="text-sm font-medium truncate">Overview</span>
      </Link>
    ),
    [pathname]
  );

  const sidebarMenuContent = useMemo(
    () => (
      <SidebarMenu
        items={DASHBOARD_SIDEBAR_ITEMS.map((section) => ({
          key: section.label.toLowerCase().replace(/\s+/g, "-"),
          title: section.label,
          items: section.items.map((item) => ({
            key: item.key,
            title: item.label,
            icon: item.icon,
            href: item.href,
          })),
        }))}
      />
    ),
    []
  );

  const footerItemsContent = useMemo(() => <FooterItems />, []);

  return (
    <div className={containerClasses}>
      {/* Logo and Close Button */}
      <div className="mb-4">{logoSection}</div>

      {/* Overview Item */}
      <div className="mb-2 px-1">{overviewItem}</div>

      {/* Main Navigation */}
      <div className="flex-1 min-h-0">
        <ScrollShadow className={scrollShadowClasses}>
          {sidebarMenuContent}
        </ScrollShadow>
      </div>

      {/* Footer Items */}
      <div className="mt-auto pt-4 px-1">{footerItemsContent}</div>
    </div>
  );
});

SidebarContent.displayName = "SidebarContent";

export default SidebarContent;
