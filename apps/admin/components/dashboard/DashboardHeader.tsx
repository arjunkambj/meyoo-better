"use client";

import { Button } from "@heroui/button";
import { cn } from "@heroui/theme";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { usePathname } from "next/navigation";
import UserProfileMenu from "../shared/UserProfileMenu";
import { sidebarOpenAtom } from "@/store/atoms";

interface DashboardHeaderProps {
  className?: string;
}

export default function DashboardHeader({ className }: DashboardHeaderProps) {
  const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom);
  const pathname = usePathname();

  // Map pathnames to page titles
  const getPageTitle = () => {
    switch (pathname) {
      case "/dashboard":
        return "Dashboard";
      case "/dashboard/users":
        return "Users";
      case "/dashboard/teams":
        return "Teams";
      case "/dashboard/billing":
        return "Billing";
      case "/dashboard/subscriptions":
        return "Subscriptions";
      case "/dashboard/tickets":
        return "Support Tickets";
      case "/dashboard/notifications":
        return "Notifications";
      case "/dashboard/settings":
        return "Settings";
      default:
        return "Admin Dashboard";
    }
  };

  const pageTitle = getPageTitle();

  return (
    <header
      className={cn(
        "flex bg-content1 px-8 py-5 rounded-2xl justify-between items-center w-full h-[72px] border border-divider",
        className
      )}
    >
      {/* Left side - Sidebar toggle and page title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          isIconOnly
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          radius="lg"
          size="md"
          variant="flat"
          className="bg-transparent"
          onPress={() => setIsOpen(!isOpen)}
        >
          <Icon icon="solar:hamburger-menu-linear" width={24} />
        </Button>
        <div aria-hidden className="h-6 w-px bg-divider" />
        <h1 className="text-lg font-medium text-foreground">{pageTitle}</h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2 min-w-0">
        {/* User Profile */}
        <UserProfileMenu />
      </div>
    </header>
  );
}
