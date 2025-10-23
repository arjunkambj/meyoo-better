"use client";

import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Icon } from "@iconify/react";

interface DeleteApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  keyName: string;
  isDeleting: boolean;
}

export default function DeleteApiKeyModal({
  isOpen,
  onClose,
  onConfirm,
  keyName,
  isDeleting,
}: DeleteApiKeyModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="md">
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon
                  icon="solar:trash-bin-trash-bold-duotone"
                  className="text-danger"
                  width={20}
                />
                Delete API Key
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-3">
                <p className="text-sm text-default-600">
                  Are you sure you want to delete the API key{" "}
                  <span className="font-medium text-default-900">
                    &ldquo;{keyName}&rdquo;
                  </span>
                  ?
                </p>

                <div className="bg-danger-50 dark:bg-danger-100/10 p-3 rounded-lg">
                  <div className="flex gap-2">
                    <Icon
                      icon="solar:danger-triangle-bold-duotone"
                      className="text-danger-600 dark:text-danger mt-0.5 flex-shrink-0"
                      width={16}
                    />
                    <div className="text-sm">
                      <p className="font-medium text-danger-600 dark:text-danger">
                        This action cannot be undone
                      </p>
                      <p className="text-danger-600 dark:text-danger-500 text-xs mt-1">
                        Any applications or services using this API key will
                        immediately lose access.
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
                onPress={onModalClose}
                isDisabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                onPress={onConfirm}
                isLoading={isDeleting}
                startContent={
                  !isDeleting && (
                    <Icon icon="solar:trash-bin-trash-bold" width={18} />
                  )
                }
              >
                Delete API Key
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
