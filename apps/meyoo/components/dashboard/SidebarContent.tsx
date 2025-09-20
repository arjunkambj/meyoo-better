"use client";

import { ScrollShadow } from "@heroui/scroll-shadow";
import { cn } from "@heroui/theme";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";

import Logo from "@/components/shared/Logo";
import { ADMIN_SIDEBAR_ITEMS, ADMIN_FOOTER_ITEMS } from "@/constants/navigation";
import { LAYOUT_STYLES, TRANSITIONS } from "@/constants/styles";

interface NavItem {
  key: string;
  label: string;
  icon: string;
  activeIcon?: string;
  href: string;
  badge?: string | number | null;
}

interface SidebarContentProps {
  onClose?: () => void;
  isOpen?: boolean;
}

const SidebarContent = React.memo(({ isOpen = true }: SidebarContentProps) => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const containerClasses = useMemo(
    () =>
      cn(
        LAYOUT_STYLES.sidebar.content,
        TRANSITIONS.sidebar,
        isOpen ? LAYOUT_STYLES.sidebar.expanded : LAYOUT_STYLES.sidebar.collapsed
      ),
    [isOpen]
  );

  const scrollShadowClasses = useMemo(
    () =>
      cn(
        "h-full max-h-full",
        TRANSITIONS.sidebar,
        isOpen ? "-mr-6 pr-6 opacity-100" : "opacity-0"
      ),
    [isOpen]
  );

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const iconToUse = active && item.activeIcon ? item.activeIcon : item.icon;

    return (
      <Link
        key={item.key}
        aria-current={active ? "page" : undefined}
        className={cn(
          LAYOUT_STYLES.navItem.base,
          "no-underline w-full",
          active ? LAYOUT_STYLES.navItem.active : LAYOUT_STYLES.navItem.inactive
        )}
        href={item.href}
        prefetch={true}
      >
        <Icon
          aria-hidden
          className={cn(
            LAYOUT_STYLES.icon.className, 
            "w-5 h-5",
            active && "text-primary"
          )}
          icon={iconToUse}
        />
        <span className={cn(LAYOUT_STYLES.text.menuLabel, "flex-1")}>
          {item.label}
        </span>
        {item.badge !== null && item.badge !== undefined && (
          <span className={LAYOUT_STYLES.badge.default}>{item.badge}</span>
        )}
      </Link>
    );
  };

  return (
    <div className={containerClasses}>
      {/* Logo Header */}
      <div className="mb-8 px-4">
        <Logo variant={isOpen ? "full" : "icon"} size="md" />
      </div>

      {/* Main Navigation */}
      <div className="flex-1 min-h-0 px-2">
        <ScrollShadow className={scrollShadowClasses}>
          <nav className="flex flex-col gap-0.5">
            {ADMIN_SIDEBAR_ITEMS.map(item => renderNavItem(item))}
          </nav>
        </ScrollShadow>
      </div>

      {/* Footer Items */}
      <div className="px-2 pb-4 pt-4 border-t border-divider">
        <nav className="flex flex-col gap-0.5">
          {ADMIN_FOOTER_ITEMS.map(item => renderNavItem(item))}
        </nav>
      </div>
    </div>
  );
});

SidebarContent.displayName = "SidebarContent";

export default SidebarContent;