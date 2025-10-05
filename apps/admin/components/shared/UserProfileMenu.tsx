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
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface UserProfileMenuProps {
  user?: {
    name?: string;
    email?: string;
    image?: string;
    role?: string;
  };
}

// Mock user data - replace with actual Convex auth
const mockUser = {
  name: "Admin User",
  email: "admin@meyoo.com",
  role: "StoreOwner",
  image: undefined,
};

export default function UserProfileMenu({
  user = mockUser,
}: UserProfileMenuProps) {
  const { signOut } = useAuthActions();
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [signOut, router]);

  const handleSettings = useCallback(() => {
    router.push("/dashboard/settings");
  }, [router]);

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Avatar
          as="button"
          className="transition-transform hover:scale-105"
          color="primary"
          name={user?.name || "Admin"}
          size="sm"
          src={user?.image}
        />
      </DropdownTrigger>
      <DropdownMenu aria-label="Profile Actions" variant="flat">
        <DropdownSection showDivider>
          <DropdownItem
            key="profile"
            className="h-14 gap-2"
            textValue="Profile"
          >
            <p className="font-semibold">{user?.name || "Admin User"}</p>
            <p className="text-xs text-default-500">{user?.email}</p>
          </DropdownItem>
        </DropdownSection>

        <DropdownSection showDivider>
          <DropdownItem
            key="settings"
            startContent={<Icon icon="solar:settings-linear" width={18} />}
            onPress={handleSettings}
          >
            Settings
          </DropdownItem>
          <DropdownItem
            key="help"
            startContent={
              <Icon icon="solar:question-circle-linear" width={18} />
            }
          >
            Help & Support
          </DropdownItem>
        </DropdownSection>

        <DropdownSection>
          <DropdownItem
            key="logout"
            color="danger"
            startContent={<Icon icon="solar:logout-2-linear" width={18} />}
            onPress={handleLogout}
          >
            Sign Out
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
}
