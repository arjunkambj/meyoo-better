"use client";

import { cn } from "@heroui/react";
import { usePathname } from "next/navigation";
import { PlanUsageAlert } from "../../shared/billing/PlanUsageAlert";
import UserProfile from "../../shared/UserProfile";
import { useOnboarding } from "@/hooks";

import SidebarToggle from "./SidebarToggle";

export default function DashBoardHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const { status: _status } = useOnboarding();

  // Map pathnames to page titles
  const getPageTitle = () => {
    switch (pathname) {
      case "/pnl":
        return "P&L Insights";
      case "/customer":
        return "Customer Insights";
      case "/inventory":
        return "Product & Inventory";
      case "/orders":
        return "Orders";
      case "/cost-management":
        return "Cost & Expenses";
      case "/integrations":
        return "Integrations";
      case "/reports":
        return "Reports";
      case "/overview":
        return "Overview";
      default:
        return "Dashboard";
    }
  };

  const pageTitle = getPageTitle();

  return (
    <header
      className={cn(
        "flex bg-content2 dark:bg-content1 px-6 py-4 rounded-2xl justify-between items-center w-full h-[68px] ",
        className
      )}
    >
      {/* Left side - Sidebar toggle and page title */}
      <div className="flex items-center gap-4 min-w-0">
        <SidebarToggle />
        <div aria-hidden className="h-8 w-px bg-divider" />
        <h1 className="text-xl font-semibold text-default-900">{pageTitle}</h1>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1 min-w-0">
        {/* Plan Usage Indicator (minimal) */}
        <div className="mr-2">
          <PlanUsageAlert variant="minimal" />
        </div>

        {/* Divider */}
        <div aria-hidden className="h-8 mr-3 w-px bg-divider" />

        {/* User Profile */}
        <UserProfile />
      </div>
    </header>
  );
}
