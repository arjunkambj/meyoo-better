"use client";

import {
  Avatar,
  Button,
  Input,
  Select,
  SelectItem,
  addToast,
  useDisclosure,
} from "@heroui/react";
import type { Selection } from "@react-types/shared";
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

type Option = { label: string; value: string };

const CURRENCY_OPTIONS: Option[] = [
  { label: "US Dollar (USD)", value: "USD" },
  { label: "Euro (EUR)", value: "EUR" },
  { label: "British Pound (GBP)", value: "GBP" },
  { label: "Japanese Yen (JPY)", value: "JPY" },
  { label: "Chinese Yuan (CNY)", value: "CNY" },
  { label: "Australian Dollar (AUD)", value: "AUD" },
  { label: "Canadian Dollar (CAD)", value: "CAD" },
  { label: "Swiss Franc (CHF)", value: "CHF" },
  { label: "Hong Kong Dollar (HKD)", value: "HKD" },
  { label: "Singapore Dollar (SGD)", value: "SGD" },
  { label: "Swedish Krona (SEK)", value: "SEK" },
  { label: "Norwegian Krone (NOK)", value: "NOK" },
  { label: "New Zealand Dollar (NZD)", value: "NZD" },
  { label: "South Korean Won (KRW)", value: "KRW" },
  { label: "Mexican Peso (MXN)", value: "MXN" },
  { label: "Indian Rupee (INR)", value: "INR" },
  { label: "Brazilian Real (BRL)", value: "BRL" },
  { label: "South African Rand (ZAR)", value: "ZAR" },
  { label: "Turkish Lira (TRY)", value: "TRY" },
  { label: "UAE Dirham (AED)", value: "AED" },
  { label: "Saudi Riyal (SAR)", value: "SAR" },
  { label: "Polish Złoty (PLN)", value: "PLN" },
  { label: "Thai Baht (THB)", value: "THB" },
  { label: "Danish Krone (DKK)", value: "DKK" },
];

const TIMEZONE_OPTIONS: Option[] = [
  { label: "(UTC+00:00) Coordinated Universal Time", value: "UTC" },
  {
    label: "(UTC-08:00) Pacific Time (US & Canada)",
    value: "America/Los_Angeles",
  },
  { label: "(UTC-07:00) Mountain Time (US & Canada)", value: "America/Denver" },
  { label: "(UTC-06:00) Central Time (US & Canada)", value: "America/Chicago" },
  {
    label: "(UTC-05:00) Eastern Time (US & Canada)",
    value: "America/New_York",
  },
  { label: "(UTC-03:00) São Paulo", value: "America/Sao_Paulo" },
  { label: "(UTC-06:00) Mexico City", value: "America/Mexico_City" },
  {
    label: "(UTC-03:00) Buenos Aires",
    value: "America/Argentina/Buenos_Aires",
  },
  { label: "(UTC+00:00) London", value: "Europe/London" },
  { label: "(UTC+01:00) Paris", value: "Europe/Paris" },
  { label: "(UTC+01:00) Berlin", value: "Europe/Berlin" },
  { label: "(UTC+01:00) Madrid", value: "Europe/Madrid" },
  { label: "(UTC+01:00) Rome", value: "Europe/Rome" },
  { label: "(UTC+02:00) Warsaw", value: "Europe/Warsaw" },
  { label: "(UTC+02:00) Johannesburg", value: "Africa/Johannesburg" },
  { label: "(UTC+03:00) Dubai", value: "Asia/Dubai" },
  { label: "(UTC+05:30) Mumbai", value: "Asia/Kolkata" },
  { label: "(UTC+07:00) Bangkok", value: "Asia/Bangkok" },
  { label: "(UTC+07:00) Jakarta", value: "Asia/Jakarta" },
  { label: "(UTC+08:00) Singapore", value: "Asia/Singapore" },
  { label: "(UTC+08:00) Hong Kong", value: "Asia/Hong_Kong" },
  { label: "(UTC+08:00) Shanghai", value: "Asia/Shanghai" },
  { label: "(UTC+09:00) Seoul", value: "Asia/Seoul" },
  { label: "(UTC+09:00) Tokyo", value: "Asia/Tokyo" },
  { label: "(UTC+10:00) Sydney", value: "Australia/Sydney" },
  { label: "(UTC+12:00) Auckland", value: "Pacific/Auckland" },
];
export default function ProfileSection() {
  const { user, updateProfile } = useUser();
  const {
    organizationId,
    organizationName,
    organization,
    updateOrganizationName,
    updateOrganization,
  } = useOrganization();
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
    currency: "",
    timezone: "",
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
        currency: organization?.primaryCurrency || "USD",
        timezone: organization?.timezone || "UTC",
      });
    }
  }, [user, organizationId, organizationName, organization]);

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
      const currentCurrency = organization?.primaryCurrency || "USD";
      const currencyChanged = formData.currency !== currentCurrency;
      const currentTimezone = organization?.timezone || "UTC";
      const timezoneChanged = formData.timezone !== currentTimezone;

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

      // Update organization metadata if changed
      if (orgNameChanged) {
        await updateOrganizationName(formData.organizationName);
      }

      if (currencyChanged || timezoneChanged) {
        const updates: { currency?: string; timezone?: string } = {};
        if (currencyChanged) updates.currency = formData.currency;
        if (timezoneChanged) updates.timezone = formData.timezone;
        await updateOrganization(updates);
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
    organization,
    updateOrganizationName,
    updateOrganization,
  ]);

  const hasChanges = useMemo(() => {
    const [firstName = "", lastName = ""] = (user?.name || "").split(" ", 2);

    const currentCurrency = organization?.primaryCurrency || "USD";
    const currentTimezone = organization?.timezone || "UTC";

    return (
      formData.firstName !== firstName ||
      formData.lastName !== lastName ||
      formData.email.trim().toLowerCase() !==
        (user?.email || "").trim().toLowerCase() ||
      formData.phone !== (user?.phone || "") ||
      formData.organizationName !== organizationName ||
      formData.currency !== currentCurrency ||
      formData.timezone !== currentTimezone
    );
  }, [formData, user, organizationName, organization]);

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

  const handleCurrencyChange = useCallback((keys: Selection) => {
    if (keys === "all") return;
    const [nextCurrency] = Array.from(keys) as string[];
    if (!nextCurrency) return;
    setFormData((prev) => ({ ...prev, currency: nextCurrency }));
  }, []);

  const handleTimezoneChange = useCallback((keys: Selection) => {
    if (keys === "all") return;
    const [nextTimezone] = Array.from(keys) as string[];
    if (!nextTimezone) return;
    setFormData((prev) => ({ ...prev, timezone: nextTimezone }));
  }, []);

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
        <Select
          classNames={{
            label: "text-sm font-medium text-foreground",
            listboxWrapper: "shadow-none before:hidden after:hidden",
          }}
          disallowEmptySelection
          isDisabled={isLoading}
          label="Primary Currency"
          labelPlacement="outside"
          placeholder="Select a currency"
          selectedKeys={formData.currency ? [formData.currency] : []}
          onSelectionChange={handleCurrencyChange}
        >
          {CURRENCY_OPTIONS.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>
        <Select
          classNames={{
            label: "text-sm font-medium text-foreground",
            listboxWrapper: "shadow-none before:hidden after:hidden",
          }}
          disallowEmptySelection
          isDisabled={isLoading}
          label="Timezone"
          labelPlacement="outside"
          placeholder="Select a timezone"
          selectedKeys={formData.timezone ? [formData.timezone] : []}
          onSelectionChange={handleTimezoneChange}
        >
          {TIMEZONE_OPTIONS.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>
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
              startContent={
                <Icon icon="solar:letter-bold-duotone" width={16} />
              }
              variant="flat"
              onPress={onEmailOpen}
            >
              Change Email
            </Button>
            <Button
              className="w-full sm:w-auto"
              color="default"
              size="sm"
              startContent={
                <Icon icon="solar:lock-keyhole-bold-duotone" width={16} />
              }
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
