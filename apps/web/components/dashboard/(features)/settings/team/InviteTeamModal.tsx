"use client";

import {
  Button,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";
import { api } from "@/libs/convexApi";

export default function InviteTeamModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState("");
  const setPending = useSetAtom(setSettingsPendingAtom);

  const inviteTeamMember = useMutation(api.core.teams.inviteTeamMember);

  const handleInvite = async () => {
    if (!email) {
      addToast({
        title: "Please enter an email address",
        color: "danger",
        timeout: 3000,
      });

      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      addToast({
        title: "Please enter a valid email address",
        color: "danger",
        timeout: 3000,
      });

      return;
    }

    setIsLoading(true);
    setPending(true);

    try {
      const result = await inviteTeamMember({
        email: email.toLowerCase().trim(),
        role: "StoreTeam" as const,
      });

      if (result.success) {
        setInvitedEmail(email);
        setShowSuccess(true);
        setEmail("");
        addToast({
          title: "Team member added successfully!",
          color: "default",
          timeout: 3000,
        });
      } else {
        addToast({
          title: result.message,
          color: "danger",
          timeout: 3000,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send invitation";
      addToast({ title: message, color: "danger", timeout: 3000 });
    } finally {
      setIsLoading(false);
      setPending(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setShowSuccess(false);
    setInvitedEmail("");
    setIsOpen(false);
  };

  return (
    <>
      <Button
        color="primary"
        startContent={<Icon icon="solar:add-circle-linear" width={18} />}
        onPress={() => setIsOpen(true)}
      >
        Invite Members
      </Button>

      <Modal
        isOpen={isOpen}
        className="bg-default-50"
        placement="center"
        size="lg"
        onClose={handleClose}
        onOpenChange={(open) => {
          if (!open) handleClose();
          else setIsOpen(open);
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              {!showSuccess ? (
                // Invitation Form
                <>
                  <ModalHeader className="flex flex-col gap-1 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon
                          className="text-primary"
                          icon="solar:users-group-two-rounded-bold-duotone"
                          width={20}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">
                          Add Team Member
                        </h3>
                        <p className="text-sm text-default-500">
                          Grant access to your dashboard
                        </p>
                      </div>
                    </div>
                  </ModalHeader>
                  <Divider />
                  <ModalBody className="gap-5 py-5">
                    <Input
                      autoFocus
                      isRequired
                      description="Enter the email address of the person you want to invite"
                      label="Email Address"
                      labelPlacement="outside"
                      placeholder="colleague@company.com"
                      startContent={
                        <Icon
                          className="text-default-400"
                          icon="solar:letter-linear"
                          width={18}
                        />
                      }
                      type="email"
                      value={email}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isLoading) {
                          handleInvite();
                        }
                      }}
                      onValueChange={setEmail}
                    />

                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning/10 rounded-lg">
                          <Icon
                            className="text-warning"
                            icon="solar:lock-keyhole-bold"
                            width={18}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            Team Permissions
                          </p>
                          <p className="text-xs text-default-500">
                            Full dashboard access, except billing & team
                            management
                          </p>
                        </div>
                      </div>
                    </div>

                  </ModalBody>
                  <Divider />
                  <ModalFooter className="pt-4">
                    <Button variant="flat" onPress={onClose}>
                      Cancel
                    </Button>
                    <Button
                      color="primary"
                      isLoading={isLoading}
                      startContent={
                        !isLoading && (
                          <Icon
                            icon="solar:user-plus-rounded-bold"
                            width={18}
                          />
                        )
                      }
                      onPress={handleInvite}
                    >
                      Add Team Member
                    </Button>
                  </ModalFooter>
                </>
              ) : (
                // Success State
                <>
                  <ModalHeader className="sr-only">Success</ModalHeader>
                  <ModalBody className="flex flex-col items-center justify-center py-8 gap-4">
                    <div className="p-3 bg-success/10 rounded-full">
                      <Icon
                        className="text-success"
                        icon="solar:check-circle-bold"
                        width={48}
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">
                        Team Member Added!
                      </h3>
                      <p className="text-sm text-default-500 max-w-sm">
                        <span className="font-medium">{invitedEmail}</span> has
                        been added to your team and can now sign in with Google.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 w-full max-w-sm p-4 bg-default-50 dark:bg-default-100/50 rounded-lg">
                      <p className="text-xs font-medium text-default-600">
                        Next Steps:
                      </p>
                      <div className="flex items-start gap-2">
                        <Icon
                          className="text-primary mt-0.5"
                          icon="solar:info-circle-linear"
                          width={16}
                        />
                        <p className="text-xs text-default-500">
                          Let them know they can sign in at{" "}
                          <span className="font-mono text-primary">
                            meyoo.app
                          </span>{" "}
                          using their Google account with this email address.
                        </p>
                      </div>
                    </div>
                  </ModalBody>
                  <ModalFooter className="justify-center pb-6">
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={() => {
                        setShowSuccess(false);
                        setEmail("");
                      }}
                    >
                      Invite Another Member
                    </Button>
                    <Button color="primary" onPress={onClose}>
                      Done
                    </Button>
                  </ModalFooter>
                </>
              )}
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
