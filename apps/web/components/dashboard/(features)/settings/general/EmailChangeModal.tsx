"use client";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";

interface EmailChangeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail?: string;
  hasPassword?: boolean;
  onChangeEmail: (newEmail: string, currentPassword?: string) => Promise<void>;
}

export default function EmailChangeModal({
  isOpen,
  onOpenChange,
  currentEmail,
  hasPassword = false,
  onChangeEmail,
}: EmailChangeModalProps) {
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    confirm?: string;
    password?: string;
  }>({});
  const setPending = useSetAtom(setSettingsPendingAtom);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const normalizedConfirm = useMemo(
    () => confirmEmail.trim().toLowerCase(),
    [confirmEmail]
  );

  const reset = () => {
    setEmail("");
    setConfirmEmail("");
    setErrors({});
  };

  const validate = () => {
    const next: { email?: string; confirm?: string; password?: string } = {};
    if (!normalizedEmail) {
      next.email = "New email is required";
    }
    // Basic format check
    if (
      normalizedEmail &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)
    ) {
      next.email = "Enter a valid email address";
    }
    if (!normalizedConfirm) {
      next.confirm = "Please confirm your email";
    } else if (normalizedEmail !== normalizedConfirm) {
      next.confirm = "Emails do not match";
    }
    if (
      normalizedEmail &&
      currentEmail &&
      normalizedEmail === currentEmail.trim().toLowerCase()
    ) {
      next.email = "New email must be different";
    }
    if (hasPassword && !currentPassword) {
      next.password = "Current password is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setPending(true);
    try {
      await onChangeEmail(
        normalizedEmail,
        hasPassword ? currentPassword : undefined
      );
      addToast({
        title: "Email updated",
        description: "Your login email has been changed",
        color: "default",
        timeout: 4000,
      });
      onOpenChange(false);
      reset();
    } catch (e) {
      addToast({
        title: "Email update failed",
        description: e instanceof Error ? e.message : "Please try again",
        color: "danger",
        timeout: 5000,
      });
    } finally {
      setIsLoading(false);
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      className="bg-default-50"
      placement="center"
      size="md"
      onOpenChange={(open) => {
        if (!open) {
          reset();
        }
        onOpenChange(open);
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <Icon icon="solar:letter-bold-duotone" width={20} />
              <span>Change Email</span>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-10">
                {currentEmail ? (
                  <p className="text-xs text-default-500">
                    Current email:{" "}
                    <span className="font-medium">{currentEmail}</span>
                  </p>
                ) : null}
                <Input
                  isDisabled={isLoading}
                  label="New Email"
                  labelPlacement="outside"
                  placeholder="Enter new email"
                  type="email"
                  value={email}
                  errorMessage={errors.email}
                  isInvalid={!!errors.email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email)
                      setErrors({ ...errors, email: undefined });
                  }}
                />
                <Input
                  isDisabled={isLoading}
                  label="Confirm Email"
                  labelPlacement="outside"
                  placeholder="Re-enter new email"
                  type="email"
                  value={confirmEmail}
                  errorMessage={errors.confirm}
                  isInvalid={!!errors.confirm}
                  onChange={(e) => {
                    setConfirmEmail(e.target.value);
                    if (errors.confirm)
                      setErrors({ ...errors, confirm: undefined });
                  }}
                />
                {hasPassword && (
                  <Input
                    isDisabled={isLoading}
                    label="Current Password"
                    labelPlacement="outside"
                    placeholder="Enter current password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    errorMessage={errors.password}
                    isInvalid={!!errors.password}
                    startContent={
                      <Icon
                        className="text-default-400"
                        icon="solar:lock-keyhole-bold-duotone"
                        width={20}
                      />
                    }
                    endContent={
                      <button
                        className="focus:outline-none"
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                      >
                        <Icon
                          className="text-default-400"
                          icon={
                            showCurrentPassword
                              ? "solar:eye-closed-bold-duotone"
                              : "solar:eye-bold-duotone"
                          }
                          width={20}
                        />
                      </button>
                    }
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (errors.password)
                        setErrors({ ...errors, password: undefined });
                    }}
                  />
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="default"
                isDisabled={isLoading}
                variant="flat"
                onPress={onClose}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                isDisabled={!email || !confirmEmail}
                isLoading={isLoading}
                onPress={handleSubmit}
              >
                Update Email
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
