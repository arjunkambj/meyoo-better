"use client";

import { Avatar, Button, Input, addToast, useDisclosure } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";
import { FormSkeleton } from "@/components/shared/skeletons";
import { api } from "@/libs/convexApi";
import { useUser, useOrganization } from "@/hooks";
import { usePassword } from "@/hooks/usePassword";
import EmailChangeModal from "./EmailChangeModal";
import PasswordChangeModal from "./PasswordChangeModal";
export default function ProfileSection() {
  const { user, updateProfile } = useUser();
  const { organizationId, organizationName, updateOrganizationName } =
    useOrganization();
  const { hasPassword, changePassword } = usePassword();
  const changeEmailAction = useAction(api.core.users.changeEmail);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isEmailOpen,
    onOpen: onEmailOpen,
    onOpenChange: onEmailOpenChange,
  } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const setPending = useSetAtom(setSettingsPendingAtom);

  // Separate first and last name from Clerk user
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationId: "",
    organizationName: "",
  });

  // Update form data when Clerk user or Convex user loads
  useEffect(() => {
    if (user) {
      const [firstName = "", lastName = ""] = (user?.name || "").split(" ", 2);

      setFormData({
        firstName,
        lastName,
        email: user?.email || "",
        phone: user?.phone || "",
        organizationId: organizationId || "",
        organizationName: organizationName || "",
      });
    }
  }, [user, organizationId, organizationName]);

  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
    setPending(true);
    try {
      // Update user profile
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const [currentFirst = "", currentLast = ""] = (user?.name || "").split(
        " ",
        2
      );

      const nameChanged =
        formData.firstName !== currentFirst ||
        formData.lastName !== currentLast;
      const phoneChanged = formData.phone !== (user?.phone || "");
      const nextEmail = formData.email.trim().toLowerCase();
      const currentEmail = (user?.email || "").trim().toLowerCase();
      const emailChanged = nextEmail !== currentEmail;
      const orgNameChanged = formData.organizationName !== organizationName;

      if (nameChanged || phoneChanged || emailChanged) {
        const updates: {
          name?: string;
          email?: string;
          phone?: string;
        } = {};

        if (nameChanged) updates.name = fullName;
        if (phoneChanged) updates.phone = formData.phone;

        if (emailChanged) {
          updates.email = nextEmail;
        }

        await updateProfile(updates);
      }

      // Update organization name if changed
      if (orgNameChanged) {
        await updateOrganizationName(formData.organizationName);
      }

      addToast({
        title: "Profile updated",
        description: "Your changes have been saved",
        color: "default",
      });
    } catch (_error) {
      addToast({
        title: "Update failed",
        description: "Please try again later",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
      setPending(false);
    }
  }, [
    formData,
    user,
    updateProfile,
    setPending,
    organizationName,
    updateOrganizationName,
  ]);

  const hasChanges = useMemo(() => {
    const [firstName = "", lastName = ""] = (user?.name || "").split(" ", 2);

    return (
      formData.firstName !== firstName ||
      formData.lastName !== lastName ||
      formData.email.trim().toLowerCase() !==
        (user?.email || "").trim().toLowerCase() ||
      formData.phone !== (user?.phone || "") ||
      formData.organizationName !== organizationName
    );
  }, [formData, user, organizationName]);

  // Get full name for avatar
  const fullName = useMemo(
    () =>
      user?.name || `${formData.firstName} ${formData.lastName}`.trim() || "",
    [user, formData]
  );

  // Form field change handlers
  const handleFirstNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, firstName: e.target.value })),
    []
  );

  const handleLastNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, lastName: e.target.value })),
    []
  );

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, phone: e.target.value })),
    []
  );

  const handleOrganizationNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, organizationName: e.target.value })),
    []
  );

  // Show skeleton while loading initial data
  if (!user) {
    return <FormSkeleton fields={4} showAvatar={true} />;
  }

  return (
    <>
      {/* Avatar Section */}
      <div className="flex px-1 items-center gap-6">
        <div className="relative">
          <Avatar
            isBordered
            className="h-20 w-20"
            color="primary"
            name={fullName || formData.email}
            src={user?.image || ""}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-default-500">
            Profile picture synced from your authentication provider
          </p>
          <p className="text-xs text-default-400">
            Sign in with Google to use your Google profile picture
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Input
          classNames={{
            label: "text-sm font-medium text-foreground",
          }}
          isDisabled={isLoading}
          label="First Name"
          labelPlacement="outside"
          placeholder="Enter your first name"
          value={formData.firstName}
          onChange={handleFirstNameChange}
        />
        <Input
          classNames={{
            label: "text-sm font-medium text-foreground",
          }}
          isDisabled={isLoading}
          label="Last Name"
          labelPlacement="outside"
          placeholder="Enter your last name"
          value={formData.lastName}
          onChange={handleLastNameChange}
        />
        <Input
          classNames={{
            label: "text-sm font-medium text-foreground",
          }}
          description="Your unique organization identifier"
          endContent={
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => {
                navigator.clipboard.writeText(formData.organizationId);
                addToast({
                  title: "Copied",
                  description: "Organization ID copied to clipboard",
                  color: "default",
                  timeout: 2000,
                });
              }}
            >
              <Icon icon="solar:copy-bold-duotone" width={18} />
            </Button>
          }
          isReadOnly
          label="Organization ID"
          labelPlacement="outside"
          placeholder="Organization ID"
          value={formData.organizationId}
        />
        <Input
          classNames={{
            label: "text-sm font-medium text-foreground",
          }}
          description="The name of your organization"
          isDisabled={isLoading}
          label="Organization Name"
          labelPlacement="outside"
          placeholder="Enter organization name"
          value={formData.organizationName}
          onChange={handleOrganizationNameChange}
        />
        <div className="flex flex-col gap-2">
          <Input
            classNames={{
              label: "text-sm font-medium text-foreground",
            }}
            description="Email is your login identifier"
            endContent={
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => {
                  navigator.clipboard.writeText(formData.email);
                  addToast({
                    title: "Copied",
                    description: "Email copied to clipboard",
                    color: "default",
                    timeout: 2000,
                  });
                }}
              >
                <Icon icon="solar:copy-bold-duotone" width={18} />
              </Button>
            }
            isReadOnly
            label="Email Address"
            labelPlacement="outside"
            placeholder="your@email.com"
            type="email"
            value={formData.email}
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              className="w-full sm:w-auto"
              color="default"
              size="sm"
              startContent={<Icon icon="solar:letter-bold-duotone" width={16} />}
              variant="flat"
              onPress={onEmailOpen}
            >
              Change Email
            </Button>
            <Button
              className="w-full sm:w-auto"
              color="default"
              size="sm"
              startContent={<Icon icon="solar:lock-keyhole-bold-duotone" width={16} />}
              variant="flat"
              onPress={onOpen}
            >
              {hasPassword ? "Change Password" : "Set Password"}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Input
            classNames={{
              label: "text-sm font-medium text-foreground",
            }}
            isDisabled={isLoading}
            label="Phone Number"
            labelPlacement="outside"
            placeholder="+1 (555) 123-4567"
            type="tel"
            value={formData.phone}
            onChange={handlePhoneChange}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end flex-wrap gap-3 pt-4">
        <Button
          color="primary"
          isDisabled={!hasChanges}
          isLoading={isLoading}
          onPress={handleSubmit}
        >
          Save Changes
        </Button>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        hasPassword={hasPassword}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onPasswordChange={async (currentPassword, newPassword) => {
          const result = await changePassword(currentPassword, newPassword);
          return result;
        }}
      />
      <EmailChangeModal
        currentEmail={user?.email || ""}
        hasPassword={hasPassword}
        isOpen={isEmailOpen}
        onOpenChange={onEmailOpenChange}
        onChangeEmail={async (newEmail: string, currentPassword?: string) => {
          await changeEmailAction({ newEmail, currentPassword });
          setFormData((prev) => ({ ...prev, email: newEmail }));
        }}
      />
    </>
  );
}
