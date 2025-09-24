"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";

export type RenameThreadDialogProps = {
  isOpen: boolean;
  initialTitle?: string;
  onClose: () => void;
  onConfirm: (nextTitle: string) => Promise<void> | void;
};

export default function RenameThreadDialog({ isOpen, initialTitle, onClose, onConfirm }: RenameThreadDialogProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(initialTitle ?? "");
  }, [initialTitle, isOpen]);

  const canSave = useMemo(() => value.trim().length > 0 && !busy, [value, busy]);

  const handleConfirm = async () => {
    if (!canSave) return;
    try {
      setBusy(true);
      await onConfirm(value.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <ModalContent>
        <ModalHeader>Rename Conversation</ModalHeader>
        <ModalBody>
          <Input
            autoFocus
            label="Title"
            placeholder="Enter a conversation title"
            value={value}
            onValueChange={setValue}
            isDisabled={busy}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleConfirm} isDisabled={!canSave} isLoading={busy}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

