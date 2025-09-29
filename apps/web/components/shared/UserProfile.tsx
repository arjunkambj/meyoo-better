"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Switch,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks";

const UserProfile = React.memo(() => {
  const { user } = useCurrentUser();
  const { signOut } = useAuthActions();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    window.location.href = "/signin";
  }, [signOut]);

  const handleThemeChange = useCallback((isSelected: boolean) => {
    setTheme(isSelected ? "dark" : "light");
  }, [setTheme]);

  // Memoize user data extraction
  const userData = useMemo(
    () => ({
      name: user?.name || "User",
      email: user?.email || "",
      image: user?.image,
    }),
    [user]
  );

  // Memoize navigation items for better performance
  const navigationItems = useMemo(
    () => [
      {
        key: "settings",
        href: "/settings",
        icon: "solar:settings-linear",
        label: "Settings",
      },
      {
        key: "billing",
        href: "/settings?tab=billing",
        icon: "solar:card-linear",
        label: "Billing",
      },
      {
        key: "team",
        href: "/settings?tab=team",
        icon: "solar:users-group-rounded-linear",
        label: "Team",
      },
      {
        key: "help",
        href: "/settings?tab=support",
        icon: "solar:question-circle-linear",
        label: "Help & Support",
      },
    ],
    []
  );

  // Memoize dropdown menu items
  const dropdownContent = useMemo(
    () => (
      <DropdownMenu
        aria-label="Profile Actions"
        variant="flat"
        classNames={{
          base: "p-1",
        }}
      >
        <DropdownSection showDivider>
          <DropdownItem
            key="profile"
            className="h-16 gap-2 cursor-default hover:bg-transparent"
            textValue="Profile"
            isReadOnly
          >
            <div className="flex items-center gap-3">
              <Avatar
                size="sm"
                name={userData.name}
                src={userData.image || undefined}
                className="flex-shrink-0"
              />
              <div className="flex flex-col">
                <p className="font-semibold text-small">{userData.name}</p>
                <p className="text-tiny text-default-400">{userData.email}</p>
              </div>
            </div>
          </DropdownItem>
        </DropdownSection>
        <DropdownSection showDivider>
          <DropdownItem
            key="theme"
            className="gap-2 py-2"
            startContent={
              <Icon
                icon={theme === "dark" ? "solar:moon-stars-bold" : "solar:sun-bold"}
                width={20}
                className="text-default-500"
              />
            }
            endContent={
              mounted && (
                <Switch
                  size="sm"
                  isSelected={theme === "dark"}
                  onValueChange={handleThemeChange}
                  aria-label="Toggle theme"
                  classNames={{
                    wrapper: "group-data-[selected=true]:bg-primary",
                  }}
                  thumbIcon={({ isSelected }) =>
                    isSelected ? (
                      <Icon icon="solar:moon-bold" width={12} />
                    ) : (
                      <Icon icon="solar:sun-bold" width={12} />
                    )
                  }
                />
              )
            }
            isReadOnly
          >
            <span className="text-small font-medium">Appearance</span>
          </DropdownItem>
        </DropdownSection>
        <DropdownSection showDivider>
          {navigationItems.map((item) => (
            <DropdownItem
              key={item.key}
              as={Link}
              className="data-[hover=true]:bg-default-100 py-2"
              href={item.href}
              startContent={
                <Icon
                  icon={item.icon}
                  width={20}
                  className="text-default-500"
                />
              }
            >
              <span className="text-small font-medium">{item.label}</span>
            </DropdownItem>
          ))}
        </DropdownSection>
        <DropdownSection>
          <DropdownItem
            key="logout"
            className="text-danger data-[hover=true]:bg-danger-50 data-[hover=true]:text-danger py-2"
            startContent={
              <Icon
                icon="solar:logout-2-bold"
                width={20}
              />
            }
            onPress={handleLogout}
          >
            <span className="text-small font-semibold">Log Out</span>
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    ),
    [userData, navigationItems, handleLogout, theme, mounted, handleThemeChange]
  );

  return (
    <Dropdown
      placement="bottom-end"
      classNames={{
        content: "min-w-[260px]",
      }}
    >
      <DropdownTrigger>
        <Avatar
          isBordered
          as="button"
          className="transition-transform hover:scale-105"
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
