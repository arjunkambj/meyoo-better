"use client";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface CreateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  isCreating: boolean;
}

export default function CreateApiKeyModal({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: CreateApiKeyModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setError(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    await onCreate(name.trim());
    resetForm();
  };

  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      size="md"
      className="bg-default-50"
    >
      <ModalContent>
        {(_onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:key-bold-duotone" width={20} />
                Create New API Key
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Input
                  label="Key Name"
                  labelPlacement="outside"
                  placeholder="e.g., Production Server Key"
                  description="Use a descriptive label so your team knows what this key powers."
                  value={name}
                  onValueChange={(value) => {
                    setName(value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  isInvalid={!!error}
                  errorMessage={error || undefined}
                  isRequired
                />

                <div className="bg-warning-50 dark:bg-warning-100/10 p-3 rounded-lg">
                  <div className="flex gap-2">
                    <Icon
                      icon="solar:danger-triangle-bold-duotone"
                      className="text-warning-600 dark:text-warning mt-0.5"
                      width={16}
                    />
                    <div className="text-sm">
                      <p className="font-medium text-warning-600 dark:text-warning">
                        Important
                      </p>
                      <p className="text-warning-600 dark:text-warning-500 text-xs mt-1">
                        The API key will only be shown once. Make sure to copy
                        and save it securely.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="default"
                variant="flat"
                onPress={handleClose}
                isDisabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleCreate}
                isDisabled={!name.trim() || isCreating}
                isLoading={isCreating}
                startContent={
                  !isCreating && (
                    <Icon icon="solar:add-circle-bold-duotone" width={18} />
                  )
                }
              >
                Create API Key
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
