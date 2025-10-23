"use client";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { useMutation } from "convex/react";
import { useState } from "react";

import { api } from "@/libs/convexApi";

interface OrganizationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  currentName: string;
}

export default function OrganizationEditModal({
  isOpen,
  onClose,
  currentName,
}: OrganizationEditModalProps) {
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const updateOrganizationName = useMutation(
    api.core.users.updateOrganizationName,
  );

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({
        title: "Name is required",
        description: "Please enter a valid organization name",
        color: "danger",
        timeout: 3000,
      });

      return;
    }

    if (name === currentName) {
      onClose();

      return;
    }

    setIsLoading(true);
    try {
      // Update organization name in Convex
      await updateOrganizationName({
        organizationName: name.trim(),
      });

      addToast({
        title: "Organization updated",
        description: "Organization name has been updated successfully",
        color: "default",
        timeout: 3000,
      });

      // Close modal
      onClose();
    } catch (error) {
      addToast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update organization name",
        color: "danger",
        timeout: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Edit Organization Name
        </ModalHeader>
        <ModalBody>
          <Input
            label="Organization Name"
            labelPlacement="outside"
            placeholder="Enter organization name"
            value={name}
            
            onChange={(e) => setName(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            color="default"
            isDisabled={isLoading}
            variant="light"
            onPress={onClose}
          >
            Cancel
          </Button>
          <Button color="primary" isLoading={isLoading} onPress={handleSave}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
