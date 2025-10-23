"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import React from "react";

interface SkipConfirmationModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SkipConfirmationModal({
  isOpen,
  onCancel,
  onConfirm,
}: SkipConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} size="sm" onClose={onCancel}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Skip cost setup?
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">
            You can add costs later, but profit calculations won&apos;t be available
            until you do.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onCancel}>
            Cancel
          </Button>
          <Button color="primary" onPress={onConfirm}>
            Skip Setup
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
