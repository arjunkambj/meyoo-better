"use client";

import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import type React from "react";
import { useState } from "react";

import { useTickets } from "@/hooks";

const contactReasons = [
  { value: "sales", label: "Sales Inquiry" },
  { value: "support", label: "Technical Support" },
  { value: "partnership", label: "Partnership Opportunity" },
  { value: "feedback", label: "Product Feedback" },
  { value: "other", label: "Other" },
];

export default function ContactForm() {
  const { createTicket } = useTickets();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    reason: "sales",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createTicket({
        name: formData.name,
        email: formData.email,
        company: formData.company,
        type: formData.reason as
          | "sales"
          | "support"
          | "partnership"
          | "feedback"
          | "other",
        subject: `Contact form: ${formData.reason}`,
        message: formData.message,
      });

      setIsSubmitted(true);
      addToast({
        title: "Message sent!",
        description: "We'll get back to you within 24 hours.",
        color: "default",
        timeout: 5000,
      });

      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({
          name: "",
          email: "",
          company: "",
          reason: "sales",
          message: "",
        });
      }, 5000);
    } catch {
      addToast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        color: "danger",
        timeout: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <Icon
            className="w-8 h-8 text-success"
            icon="solar:check-circle-bold-duotone"
          />
        </div>
        <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
        <p className="text-default-600">
          We&apos;ll get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          isRequired
          label="Your Name"
          placeholder="John Doe"
          startContent={
            <Icon className="w-4 h-4 text-default-400" icon="solar:user-bold" />
          }
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
        />
        <Input
          isRequired
          label="Email Address"
          placeholder="john@company.com"
          startContent={
            <Icon
              className="w-4 h-4 text-default-400"
              icon="solar:letter-bold"
            />
          }
          type="email"
          value={formData.email}
          onChange={(e) => handleChange("email", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Company Name"
          placeholder="Acme Inc."
          startContent={
            <Icon
              className="w-4 h-4 text-default-400"
              icon="solar:buildings-bold"
            />
          }
          value={formData.company}
          onChange={(e) => handleChange("company", e.target.value)}
        />
        <Select
          isRequired
          label="Reason for Contact"
          placeholder="Select a reason"
          selectedKeys={[formData.reason]}
          startContent={
            <Icon
              className="w-4 h-4 text-default-400"
              icon="solar:chat-square-text-bold"
            />
          }
          onChange={(e) => handleChange("reason", e.target.value)}
        >
          {contactReasons.map((reason) => (
            <SelectItem key={reason.value} textValue={reason.value}>
              {reason.label}
            </SelectItem>
          ))}
        </Select>
      </div>

      <Textarea
        isRequired
        label="Your Message"
        minRows={5}
        placeholder="Tell us how we can help you..."
        startContent={
          <Icon
            className="w-4 h-4 text-default-400 mt-2"
            icon="solar:text-field-bold"
          />
        }
        value={formData.message}
        onChange={(e) => handleChange("message", e.target.value)}
      />

      <Button
        className="w-full font-semibold"
        color="primary"
        isLoading={isSubmitting}
        radius="full"
        size="lg"
        startContent={
          !isSubmitting && <Icon className="w-5 h-5" icon="solar:send-bold" />
        }
        type="submit"
      >
        {isSubmitting ? "Sending..." : "Send"}
      </Button>
    </form>
  );
}
