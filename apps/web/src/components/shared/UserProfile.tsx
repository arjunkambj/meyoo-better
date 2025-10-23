"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Avatar } from "@heroui/avatar";
import { Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from "@heroui/dropdown";
import { Switch } from "@heroui/switch";
import { Icon } from "@iconify/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useUserContext } from "@/contexts/UserContext";

type UserProfileProps = {
  showNavigationLinks?: boolean;
};

const UserProfile = React.memo(
  ({ showNavigationLinks = true }: UserProfileProps) => {
    const { user } = useUserContext();
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

    const handleThemeChange = useCallback(
      (isSelected: boolean) => {
        setTheme(isSelected ? "dark" : "light");
      },
      [setTheme]
    );

    // Memoize user data extraction
    type UserProfileData = {
      name: string;
      email: string;
      image?: string;
    };

    const userData = useMemo<UserProfileData>(() => {
      const name =
        typeof user?.name === "string" && user.name.trim().length > 0
          ? user.name
          : "User";

      const email =
        typeof user?.email === "string" && user.email.trim().length > 0
          ? user.email
          : "";

      const image = typeof user?.image === "string" ? user.image : undefined;

      return {
        name,
        email,
        image,
      };
    }, [user]);

    // Memoize navigation items for better performance
    const navigationItems = useMemo(
      () => [
        {
          key: "settings",
          href: "/settings",
          icon: "solar:settings-bold-duotone",
          label: "Settings",
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
                  icon={
                    theme === "dark"
                      ? "solar:moon-stars-bold-duotone"
                      : "solar:sun-bold-duotone"
                  }
                  width={20}
                  className="text-default-500"
                />
              }
              endContent={
                mounted ? (
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
                        <Icon icon="solar:moon-bold-duotone" width={12} />
                      ) : (
                        <Icon icon="solar:sun-bold-duotone" width={12} />
                      )
                    }
                  />
                ) : undefined
              }
              isReadOnly
            >
              <span className="text-small font-medium">Appearance</span>
            </DropdownItem>
          </DropdownSection>
          {showNavigationLinks ? (
            <DropdownSection showDivider>
              {navigationItems.map((item) => (
                <DropdownItem
                  key={item.key}
                  as={Link}
                  className="py-2"
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
          ) : null}
          <DropdownSection>
            <DropdownItem
              key="logout"
              className="text-danger data-[hover=true]:bg-danger-50 data-[hover=true]:text-danger py-2"
              startContent={<Icon icon="solar:logout-2-bold-duotone" width={20} />}
              onPress={handleLogout}
            >
              <span className="text-small font-semibold">Log Out</span>
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      ),
      [
        userData,
        navigationItems,
        handleLogout,
        theme,
        mounted,
        handleThemeChange,
        showNavigationLinks,
      ]
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
  }
);

UserProfile.displayName = "UserProfile";

export default UserProfile;
