"use client";
import {
  Button,
  Card,
  CardBody,
  Input,
  Spacer,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useState } from "react";

import { useCreateTicket, useUser } from "@/hooks";
export default function ContactSupport() {
  const { user } = useUser();
  const { createTicket } = useCreateTicket();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Auto-populate user data when available
  React.useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
        company: user.organizationId || "",
      }));
    }
  }, [user]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email address";
    }

    if (!formData.subject.trim()) {
      errors.subject = "Subject is required";
    }

    if (!formData.message.trim()) {
      errors.message = "Message is required";
    } else if (formData.message.length < 20) {
      errors.message = "Message must be at least 20 characters";
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTicket({
        name: formData.name,
        email: formData.email,
        company: formData.company || undefined,
        type: "support",
        subject: formData.subject,
        message: formData.message,
      });

      if (result.success) {
        setSubmitSuccess(true);
        // Reset form
        setFormData({
          name: user?.name || "",
          email: user?.email || "",
          company: user?.organizationId || "",
          subject: "",
          message: "",
        });
        setFormErrors({});

        // Hide success message after 5 seconds
        setTimeout(() => {
          setSubmitSuccess(false);
        }, 5000);
      } else {
        setError(result.error || "Failed to submit ticket");
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
  };

  return (
    <div className="space-y-8">
      {/* Success Message */}
      {submitSuccess && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-start gap-3">
          <Icon
            className="text-success mt-0.5"
            icon="solar:check-circle-bold-duotone"
            width={20}
          />
          <div>
            <p className="text-sm font-medium text-success">
              Ticket submitted successfully!
            </p>
            <p className="text-xs text-default-600 mt-1">
              We&apos;ve received your request and will respond within 2-4 hours
              during business hours.
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 flex items-start gap-3">
          <Icon
            className="text-danger mt-0.5"
            icon="solar:danger-triangle-bold-duotone"
            width={20}
          />
          <div>
            <p className="text-sm font-medium text-danger">
              Failed to submit ticket
            </p>
            <p className="text-xs text-default-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Content Grid: Left form card, Right info panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Support Form Card */}
        <Card className="rounded-2xl bg-background shadow-none lg:col-span-2">
          <CardBody className="px-5">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Input
                  isRequired
                  classNames={{
                    label: "text-sm font-medium text-foreground mb-2",
                  }}
                  errorMessage={formErrors.name}
                  isDisabled={isSubmitting}
                  isInvalid={!!formErrors.name}
                  label="Full Name"
                  labelPlacement="outside"
                  placeholder="John Doe"
                  startContent={
                    <Icon
                      className="text-default-400"
                      icon="solar:user-bold-duotone"
                      width={18}
                    />
                  }
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                />

                <Input
                  isRequired
                  classNames={{
                    label: "text-sm font-medium text-foreground mb-2",
                  }}
                  errorMessage={formErrors.email}
                  isDisabled={isSubmitting}
                  isInvalid={!!formErrors.email}
                  label="Email Address"
                  labelPlacement="outside"
                  placeholder="john@example.com"
                  startContent={
                    <Icon
                      className="text-default-400"
                      icon="solar:letter-bold-duotone"
                      width={18}
                    />
                  }
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>

              <Spacer y={4} />

              <Input
                isRequired
                classNames={{
                  label: "text-sm font-medium text-foreground mb-2",
                }}
                errorMessage={formErrors.subject}
                isDisabled={isSubmitting}
                isInvalid={!!formErrors.subject}
                label="Subject"
                labelPlacement="outside"
                placeholder="Brief description of your issue"
                startContent={
                  <Icon
                    className="text-default-400"
                    icon="solar:chat-square-bold-duotone"
                    width={18}
                  />
                }
                value={formData.subject}
                onChange={(e) => handleInputChange("subject", e.target.value)}
              />

              <Textarea
                isRequired
                classNames={{
                  label: "text-sm font-medium text-foreground mb-2",
                }}
                errorMessage={formErrors.message}
                isDisabled={isSubmitting}
                isInvalid={!!formErrors.message}
                label="Message"
                labelPlacement="outside"
                minRows={8}
                placeholder="Please provide as much detail as possible about your issue or question..."
                value={formData.message}
                onChange={(e) => handleInputChange("message", e.target.value)}
              />

              {/* Actions */}
              <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
                <div className="flex items-center gap-3 text-xs text-default-500">
                  <div className="flex items-center gap-1">
                    <Icon
                      className="text-success"
                      icon="solar:shield-check-bold-duotone"
                      width={16}
                    />
                    <span>Secure & private</span>
                  </div>
                  <div className="hidden sm:block h-3 w-px bg-divider" />
                  <div className="flex items-center gap-1">
                    <Icon
                      className="text-primary"
                      icon="solar:clock-circle-bold-duotone"
                      width={16}
                    />
                    <span>Avg. response 2–4 hrs</span>
                  </div>
                </div>

                <Button
                  className="px-6"
                  color="primary"
                  isLoading={isSubmitting}
                  size="md"
                  startContent={
                    !isSubmitting && (
                      <Icon icon="solar:letter-send-bold-duotone" width={18} />
                    )
                  }
                  type="submit"
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Right: Info Panel */}
        <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
          <CardBody className="px-5 py-5 space-y-4">
            {/* Response Time */}
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-md bg-success/10">
                <Icon
                  className="text-success"
                  icon="solar:clock-circle-bold"
                  width={18}
                />
              </span>
              <div>
                <p className="text-sm font-semibold text-default-800">
                  Response Time
                </p>
                <p className="text-xs text-default-700">
                  Typically 2–4 hours (Mon–Fri)
                </p>
              </div>
            </div>

            {/* Email CTA */}
            <a
              className="flex items-center gap-3 rounded-xl border border-default-200 bg-content1 px-4 py-3 hover:bg-content2 transition-colors"
              href="mailto:support@meyoo.com"
            >
              <span className="p-2 rounded-md bg-primary/10">
                <Icon
                  className="text-primary"
                  icon="solar:letter-bold-duotone"
                  width={18}
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-default-800">
                  Email Support
                </p>
                <p className="text-xs text-primary truncate">
                  support@meyoo.com
                </p>
              </div>
            </a>

            {/* Support Hours */}
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-md bg-warning/10">
                <Icon
                  className="text-warning"
                  icon="solar:calendar-bold-duotone"
                  width={18}
                />
              </span>
              <div>
                <p className="text-sm font-semibold text-default-800">
                  Support Hours
                </p>
                <p className="text-xs text-default-500">
                  9AM–6PM EST, Monday–Friday
                </p>
              </div>
            </div>

            {/* Privacy Note */}
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-md bg-default/10">
                <Icon
                  className="text-default-500"
                  icon="solar:shield-keyhole-bold-duotone"
                  width={18}
                />
              </span>
              <p className="text-xs text-default-500 leading-relaxed">
                We only use your details to assist with your request and never
                share your information.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
