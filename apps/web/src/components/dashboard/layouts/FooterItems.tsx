"use client";

import { cn } from "@heroui/theme";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

import { DASHBOARD_FOOTER_ITEMS } from "@/constants/navigation/dashboard-sidebar";

export const FooterItems = () => {
  const pathname = usePathname();

  const isActive = useCallback((href: string) => pathname === href, [pathname]);

  const footerItemsContent = useMemo(() => {
    return DASHBOARD_FOOTER_ITEMS.map((item) => {
      const active = isActive(item.href);
      const iconName = active && item.activeIcon ? item.activeIcon : item.icon;

      return (
        <Link
          key={item.key}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 px-4 rounded-xl transition-all duration-200 min-h-10",
            "no-underline w-full",
            active
              ? "bg-primary/20 text-primary font-medium"
              : "text-default-800 hover:text-default-900 hover:bg-default-200"
          )}
          href={item.href}
          prefetch={true}
        >
          {iconName && (
            <Icon
              aria-hidden
              className={cn(
                "shrink-0 transition-colors w-5 h-5",
                active && "text-primary"
              )}
              icon={iconName}
            />
          )}
          <span className="text-sm font-medium">{item.label}</span>
        </Link>
      );
    });
  }, [isActive]);

  return (
    <div className="flex gap-1 flex-col">
      <div className="flex gap-1 flex-col">{footerItemsContent}</div>
    </div>
  );
};
