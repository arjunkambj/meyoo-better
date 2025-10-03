"use client";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { setSettingsPendingAtom } from "@/store/atoms";

import { api } from "@/libs/convexApi";

export default function LeaveOrganizationButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const leaveOrg = useMutation(api.core.teams.leaveOrganization);
  const router = useRouter();
  const setPending = useSetAtom(setSettingsPendingAtom);

  const onConfirm = async () => {
    setLoading(true);
    setPending(true);
    try {
      const res = await leaveOrg({});
      if (res.success) {
        addToast({ title: "Left organization successfully", color: "default" });
        // Redirect to onboarding
        router.push("/onboarding/shopify");
      } else {
        addToast({ title: res.message, color: "danger" });
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to leave organization";
      addToast({ title: msg, color: "danger" });
    } finally {
      setLoading(false);
      setOpen(false);
      // Keep pending while redirecting only if success path triggered a navigation.
      // If we got here due to error (no redirect), clear pending.
      setPending(false);
    }
  };

  return (
    <>
      <Button
        color="danger"
        startContent={<Icon icon="solar:logout-2-linear" width={18} />}
        onPress={() => setOpen(true)}
      >
        Leave Organization
      </Button>

      <Modal isOpen={open} onOpenChange={setOpen} placement="center" size="md">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <Icon
                  className="text-danger"
                  icon="solar:warning-triangle-bold"
                  width={20}
                />
                <span>Leave Organization</span>
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-600">
                  Are you sure you want to leave this organization? You will
                  lose access to its data. A new personal organization will be
                  created for you, like a fresh signup.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" isLoading={loading} onPress={onConfirm}>
                  Yes, Leave
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
