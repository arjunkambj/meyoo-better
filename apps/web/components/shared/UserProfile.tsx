"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo } from "react";
import { useCurrentUser } from "@/hooks";

const UserProfile = React.memo(() => {
  const { user } = useCurrentUser();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = useCallback(async () => {
    await signOut();
    window.location.href = "/signin";
  }, [signOut]);

  // Memoize user data extraction
  const userData = useMemo(
    () => ({
      name: user?.name || "User",
      email: user?.email || "",
      image: user?.image,
    }),
    [user]
  );

  // Redirect not-onboarded users to onboarding when they hit protected views
  useEffect(() => {
    if (!pathname) return;

    const isOnboardingRoute = pathname.startsWith("/onboarding");
    if (isOnboardingRoute) return;

    if (user && user.isOnboarded === false) {
      router.replace("/onboarding/shopify");
    }
  }, [pathname, router, user]);

  // Memoize navigation items for better performance
  const navigationItems = useMemo(
    () => [
      {
        key: "settings",
        href: "/settings/general",
        icon: "solar:settings-linear",
        label: "Settings",
      },
      {
        key: "billing",
        href: "/settings/billing-invoices",
        icon: "solar:card-linear",
        label: "Billing",
      },
      {
        key: "help",
        href: "/settings/help",
        icon: "solar:question-circle-linear",
        label: "Help & Support",
      },
    ],
    []
  );

  // Memoize dropdown menu items
  const dropdownContent = useMemo(
    () => (
      <DropdownMenu aria-label="Profile Actions" variant="flat">
        <DropdownSection showDivider>
          <DropdownItem
            key="profile"
            className="h-14 gap-2"
            textValue="Profile"
          >
            <p className="font-semibold">{userData.name}</p>
            <p className="text-xs text-default-500">{userData.email}</p>
          </DropdownItem>
        </DropdownSection>
        <DropdownSection showDivider>
          {navigationItems.map((item) => (
            <DropdownItem
              key={item.key}
              as={Link}
              className="data-[hover=true]:bg-default-200"
              href={item.href}
              startContent={<Icon icon={item.icon} width={18} />}
            >
              {item.label}
            </DropdownItem>
          ))}
        </DropdownSection>
        <DropdownSection>
          <DropdownItem
            key="logout"
            className="text-danger-500 data-[hover=true]:bg-danger-500 data-[hover=true]:text-default-100"
            startContent={<Icon icon="solar:logout-2-linear" width={18} />}
            onPress={handleLogout}
          >
            Log Out
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    ),
    [userData, navigationItems, handleLogout]
  );

  return (
    <Dropdown placement="bottom-end" className="border border-default-200">
      <DropdownTrigger>
        <Avatar
          isBordered
          as="button"
          className="transition-transform"
          color="primary"
          name={userData.name}
          size="sm"
          src={userData.image || undefined}
        />
      </DropdownTrigger>
      {dropdownContent}
    </Dropdown>
  );
});

UserProfile.displayName = "UserProfile";

export default UserProfile;
