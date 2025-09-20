"use client";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";

interface PasswordChangeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  hasPassword: boolean;
  onPasswordChange: (
    currentPassword?: string,
    newPassword?: string
  ) => Promise<{ success: boolean; message: string }>;
}

export default function PasswordChangeModal({
  isOpen,
  onOpenChange,
  hasPassword,
  onPasswordChange,
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});
  const setPending = useSetAtom(setSettingsPendingAtom);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (hasPassword && !currentPassword) {
      newErrors.current = "Current password is required";
    }

    if (!newPassword) {
      newErrors.new = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.new = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      newErrors.confirm = "Please confirm your password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm = "Passwords do not match";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setPending(true);
    try {
      await onPasswordChange(
        hasPassword ? currentPassword : undefined,
        newPassword
      );

      addToast({
        title: hasPassword ? "Password updated" : "Password set",
        description: hasPassword
          ? "Your password has been updated successfully"
          : "Your password has been set successfully",
        color: "success",
        timeout: 4000,
      });

      onOpenChange(false);
      resetForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update password";

      if (errorMessage.includes("Current password")) {
        setErrors({ current: errorMessage });
      } else {
        addToast({
          title: "Password update failed",
          description: errorMessage,
          color: "danger",
          timeout: 5000,
        });
      }
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
          resetForm();
        }
        onOpenChange(open);
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              {hasPassword ? "Change Password" : "Set Password"}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-10">
                {hasPassword ? (
                  <>
                    <p className="text-sm text-default-500">
                      Enter your current password and choose a new password.
                    </p>
                    <Input
                      endContent={
                        <button
                          className="focus:outline-none"
                          type="button"
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                        >
                          {showCurrentPassword ? (
                            <Icon
                              className="text-default-400"
                              icon="solar:eye-closed-linear"
                              width={20}
                            />
                          ) : (
                            <Icon
                              className="text-default-400"
                              icon="solar:eye-linear"
                              width={20}
                            />
                          )}
                        </button>
                      }
                      errorMessage={errors.current}
                      isDisabled={isLoading}
                      isInvalid={!!errors.current}
                      label="Current Password"
                      labelPlacement="outside"
                      placeholder="Enter current password"
                      startContent={
                        <Icon
                          className="text-default-400"
                          icon="solar:lock-keyhole-bold"
                          width={20}
                        />
                      }
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (errors.current) {
                          setErrors({ ...errors, current: undefined });
                        }
                      }}
                    />
                  </>
                ) : (
                  <p className="text-sm text-default-500">
                    You&apos;re currently signed in with Google. Set a password
                    to enable password-based sign in as well.
                  </p>
                )}

                <Input
                  description="Minimum 8 characters"
                  endContent={
                    <button
                      className="focus:outline-none"
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <Icon
                          className="text-default-400"
                          icon="solar:eye-closed-linear"
                          width={20}
                        />
                      ) : (
                        <Icon
                          className="text-default-400"
                          icon="solar:eye-linear"
                          width={20}
                        />
                      )}
                    </button>
                  }
                  errorMessage={errors.new}
                  isDisabled={isLoading}
                  isInvalid={!!errors.new}
                  label="New Password"
                  labelPlacement="outside"
                  placeholder="Enter new password"
                  startContent={
                    <Icon
                      className="text-default-400"
                      icon="solar:lock-keyhole-bold"
                      width={20}
                    />
                  }
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errors.new) {
                      setErrors({ ...errors, new: undefined });
                    }
                  }}
                />

                <Input
                  endContent={
                    <button
                      className="focus:outline-none"
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <Icon
                          className="text-default-400"
                          icon="solar:eye-closed-linear"
                          width={20}
                        />
                      ) : (
                        <Icon
                          className="text-default-400"
                          icon="solar:eye-linear"
                          width={20}
                        />
                      )}
                    </button>
                  }
                  errorMessage={errors.confirm}
                  isDisabled={isLoading}
                  isInvalid={!!errors.confirm}
                  label="Confirm New Password"
                  labelPlacement="outside"
                  placeholder="Confirm new password"
                  startContent={
                    <Icon
                      className="text-default-400"
                      icon="solar:lock-keyhole-bold"
                      width={20}
                    />
                  }
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirm) {
                      setErrors({ ...errors, confirm: undefined });
                    }
                  }}
                />
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
                isDisabled={
                  !newPassword ||
                  !confirmPassword ||
                  (hasPassword && !currentPassword)
                }
                isLoading={isLoading}
                onPress={handleSubmit}
              >
                {hasPassword ? "Update Password" : "Set Password"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
