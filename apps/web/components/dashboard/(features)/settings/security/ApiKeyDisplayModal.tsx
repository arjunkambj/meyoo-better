"use client";

import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Snippet } from "@heroui/snippet";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface ApiKeyDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  keyName: string;
}

export default function ApiKeyDisplayModal({
  isOpen,
  onClose,
  apiKey,
  keyName,
}: ApiKeyDisplayModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      addToast({
        title: "API key copied",
        description: "The API key has been copied to your clipboard",
        color: "default",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      addToast({
        title: "Failed to copy",
        description: "Please copy the API key manually",
        color: "danger",
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      size="lg"
      hideCloseButton
      isDismissable={false}
    >
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon icon="solar:key-bold-duotone" className="text-success" width={20} />
                API Key Created Successfully
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-default-600 mb-2">
                    Your new API key <span className="font-medium">&ldquo;{keyName}&rdquo;</span> has been created.
                  </p>
                </div>

                <div className="bg-danger-50 dark:bg-danger-100/10 p-3 rounded-lg">
                  <div className="flex gap-2">
                    <Icon
                      icon="solar:danger-triangle-bold-duotone"
                      className="text-danger-600 dark:text-danger mt-0.5 flex-shrink-0"
                      width={16}
                    />
                    <div className="text-sm">
                      <p className="font-medium text-danger-600 dark:text-danger">
                        Important: Save this key now
                      </p>
                      <p className="text-danger-600 dark:text-danger-500 text-xs mt-1">
                        This is the only time you&apos;ll see this key. It cannot be retrieved later.
                        Store it in a secure location.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Your API Key</label>
                  <Snippet
                    symbol=""
                    variant="bordered"
                    className="w-full"
                    codeString={apiKey}
                    onCopy={handleCopy}
                  >
                    <span className="font-mono text-xs break-all">{apiKey}</span>
                  </Snippet>
                </div>

                <div className="bg-default-100 dark:bg-default-50/10 p-3 rounded-lg">
                  <p className="text-xs text-default-600">
                    <span className="font-medium">How to use:</span> Include this key in the{" "}
                    <code className="bg-default-200 dark:bg-default-100/20 px-1 py-0.5 rounded">
                      X-API-Key
                    </code>{" "}
                    header when making API requests.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="default"
                variant="flat"
                onPress={handleCopy}
                startContent={
                  <Icon
                    icon={copied ? "solar:check-circle-bold-duotone" : "solar:copy-bold-duotone"}
                    width={18}
                  />
                }
              >
                {copied ? "Copied!" : "Copy Key"}
              </Button>
              <Button color="primary" onPress={onModalClose}>
                I&apos;ve Saved My Key
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
