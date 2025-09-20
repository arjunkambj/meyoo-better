"use client";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useCreateIntegrationRequest } from "@/hooks";

interface RequestIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestIntegrationModal({
  isOpen,
  onClose,
  onSuccess,
}: RequestIntegrationModalProps) {
  const { createRequest } = useCreateIntegrationRequest();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    platformName: "",
    description: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Simplified schema: only platformName and description

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.platformName.trim()) {
      errors.platformName = "Platform name is required";
    } else if (formData.platformName.length < 2) {
      errors.platformName = "Platform name is too short";
    }

    if (!formData.description.trim()) {
      errors.description = "Description is required";
    } else if (formData.description.length < 20) {
      errors.description = "Please provide more details (min 20 characters)";
    }

    // No additional fields required in simple schema

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createRequest({
        platformName: formData.platformName,
        description: formData.description,
      });

      if (result.success) {
        // Reset form
        setFormData({ platformName: "", description: "" });
        setFormErrors({});

        onSuccess?.();
        onClose();
      } else {
        setError(result.error || "Failed to submit request");
      }
    } catch (_err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };

        delete newErrors[field];

        return newErrors;
      });
    }
    // Clear general error
    if (error) {
      setError(null);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset form on close
      setFormData({ platformName: "", description: "" });
      setFormErrors({});
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      hideCloseButton={isSubmitting}
      isDismissable={!isSubmitting}
      isOpen={isOpen}
      className="bg-default-50"
      scrollBehavior="inside"
      size="2xl"
      onClose={handleClose}
    >
      <ModalContent>
        {(_onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <Icon
                className="text-primary"
                icon="solar:add-square-bold-duotone"
                width={24}
              />
              <span>Request New Integration</span>
            </ModalHeader>

            <ModalBody className="bg-default-50 gap-6 pb-6">
              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 flex items-start gap-2">
                  <Icon
                    className="text-danger mt-0.5"
                    icon="solar:danger-triangle-bold"
                    width={18}
                  />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              <Input
                isRequired
                description="Name of the platform you want to integrate"
                errorMessage={formErrors.platformName}
                isDisabled={isSubmitting}
                isInvalid={!!formErrors.platformName}
                label="Platform Name"
                labelPlacement="outside"
                placeholder="e.g., QuickBooks, Klaviyo, TikTok Shop"
                startContent={
                  <Icon
                    className="text-default-400"
                    icon="solar:widget-2-bold"
                    width={18}
                  />
                }
                value={formData.platformName}
                onChange={(e) =>
                  handleInputChange("platformName", e.target.value)
                }
              />

              <Textarea
                isRequired
                description="Help us understand what this integration would do"
                errorMessage={formErrors.description}
                isDisabled={isSubmitting}
                isInvalid={!!formErrors.description}
                label="Description"
                labelPlacement="outside"
                maxRows={3}
                minRows={2}
                placeholder="Briefly describe what this platform does and why you need it"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
              />

              {/* Simplified form: no use case, impact, priority or category */}

              <div className="bg-default-100 rounded-lg p-3 flex items-start gap-2">
                <Icon
                  className="text-default-500 mt-0.5"
                  icon="solar:info-circle-bold"
                  width={18}
                />
                <div className="text-xs text-default-600">
                  <p className="font-medium mb-1">What happens next?</p>
                  <ul className="space-y-0.5">
                    <li>• We&apos;ll review your request within 48 hours</li>
                    <li>• Popular requests get prioritized in our roadmap</li>
                    <li>
                      • You&apos;ll be notified when the integration is
                      available
                    </li>
                  </ul>
                </div>
              </div>
            </ModalBody>

            <ModalFooter>
              <Button
                color="default"
                isDisabled={isSubmitting}
                variant="flat"
                onPress={handleClose}
              >
                Cancel
              </Button>
              <Button
                color="primary"
                isLoading={isSubmitting}
                startContent={
                  !isSubmitting && (
                    <Icon icon="solar:send-square-bold" width={18} />
                  )
                }
                onPress={handleSubmit}
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
