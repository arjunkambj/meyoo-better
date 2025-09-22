"use client";

import { useEffect } from "react";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { PlanUsageAlert } from "../../shared/billing/PlanUsageAlert";
import UserProfile from "../../shared/UserProfile";
import { useOnboarding, useCurrentUser } from "@/hooks";
import { agentSidebarOpenAtom } from "@/store/atoms";

import SidebarToggle from "./SidebarToggle";

export default function DashBoardHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { status: _status } = useOnboarding();
  const [isAgentOpen, setIsAgentOpen] = useAtom(agentSidebarOpenAtom);

  // Fast redirect for non-onboarded users
  const isOnboardingRoute = pathname?.startsWith("/onboarding");
  const shouldRedirectToOnboarding = Boolean(
    user && user.isOnboarded === false && !isOnboardingRoute
  );

  useEffect(() => {
    if (shouldRedirectToOnboarding) {
      router.replace("/onboarding/shopify");
    }
  }, [router, shouldRedirectToOnboarding]);

  if (shouldRedirectToOnboarding) {
    return null;
  }

  // Map pathnames to page titles
  const getPageTitle = () => {
    if (!pathname) return "Dashboard";

    const pathnameWithoutQuery = pathname.split("?")[0] ?? "";
    const [, firstSegment] = pathnameWithoutQuery.split("/");
    const basePath = firstSegment ? `/${firstSegment}` : "/overview";

    const titles: Record<string, string> = {
      "/overview": "Overview",
      "/pnl": "P&L Insights",
      "/orders": "Orders",
      "/orders-insights": "Order Insights",
      "/customer-insights": "Customer Insights",
      "/customers": "Customers",
      "/inventory": "Product & Inventory",
      "/cost-management": "Cost & Expenses",
      "/integrations": "Integrations",
      "/settings": "Settings",
      "/reports": "Reports",
    };

    return titles[basePath] ?? "Dashboard";
  };

  const pageTitle = getPageTitle();

  return (
    <header
      className={`flex bg-content2/90 dark:bg-content1 px-6 py-4 rounded-2xl justify-between items-center w-full h-[68px] ${className || ""}`}
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

        {/* AI Agent Toggle */}
        <Tooltip content={isAgentOpen ? "Close AI Assistant" : "Open AI Assistant"} placement="bottom">
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={() => setIsAgentOpen(!isAgentOpen)}
            className="text-default-600 hover:text-primary"
          >
            <Icon icon="solar:magic-stick-3-bold" width={20} />
          </Button>
        </Tooltip>

        {/* Divider */}
        <div aria-hidden className="h-8 mx-3 w-px bg-divider" />

        {/* User Profile */}
        <UserProfile />
      </div>
    </header>
  );
}
