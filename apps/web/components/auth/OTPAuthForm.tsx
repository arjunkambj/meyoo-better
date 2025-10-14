"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import React, { useCallback, useState } from "react";

import { parseAuthError } from "@/libs/auth/errorParser";

interface OTPAuthFormProps {
  mode: "signin" | "signup";
  returnUrl: string;
}

export const OTPAuthForm = React.memo(function OTPAuthForm({
  mode,
  returnUrl,
}: OTPAuthFormProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [resendCooldown, setResendCooldown] = useState(0);

  const { signIn } = useAuthActions();
  const router = useRouter();

  // Cooldown timer for OTP resend
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle OTP send with memoization
  const handleSendOTP = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate email before proceeding
      if (!email.trim()) {
        addToast({
          title: "Email required",
          description: "Please enter your email address",
          color: "warning",
          timeout: 3000,
        });
        return;
      }

      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append("email", email);

        await signIn("resend-otp", formData);
        setOtpStep("code");
        setResendCooldown(30);

        addToast({
          title: "Code sent!",
          description: "Check your email for the verification code",
          color: "default",
          timeout: 4000,
        });
      } catch (err) {
        const message = parseAuthError(err);
        addToast({
          title: "Failed to send code",
          description: message,
          color: "danger",
          timeout: 5000,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [email, signIn]
  );

  // Handle OTP verify with memoization
  const handleVerifyOTP = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validate code before proceeding
      if (!code.trim()) {
        addToast({
          title: "Code required",
          description: "Please enter the verification code",
          color: "warning",
          timeout: 3000,
        });
        return;
      }

      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append("code", code);
        formData.append("email", email);

        await signIn("resend-otp", formData);

        addToast({
          title: mode === "signin" ? "Welcome back!" : "Account created!",
          color: "default",
          timeout: 3000,
        });

        router.push(returnUrl);
      } catch (err) {
        const message = parseAuthError(err);
        addToast({
          title: "Verification failed",
          description: message,
          color: "danger",
          timeout: 5000,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [code, email, mode, returnUrl, router, signIn]
  );

  // Resend OTP with memoization
  const handleResendOTP = useCallback(async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", email);

      await signIn("resend-otp", formData);
      setResendCooldown(30);

      addToast({
        title: "New code sent!",
        description: "Check your email",
        color: "default",
        timeout: 4000,
      });
    } catch (_err) {
      addToast({
        title: "Failed to resend",
        description: "Please try again later",
        color: "danger",
        timeout: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [resendCooldown, email, signIn]);

  // Memoized reset OTP step
  const resetOtpStep = useCallback(() => {
    setOtpStep("email");
    setCode("");
  }, []);

  if (otpStep === "email") {
    return (
      <form className="mt-6 space-y-4" onSubmit={handleSendOTP}>
        <Input
          isRequired
          isDisabled={isLoading}
          placeholder="you@example.com"
          radius="lg"
          size="lg"
          startContent={
            <Icon className="mr-1" icon="solar:letter-bold-duotone" width={20} />
          }
          type="email"
          value={email}
          variant="bordered"
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button
          fullWidth
          color="primary"
          isLoading={isLoading}
          radius="lg"
          size="lg"
          type="submit"
        >
          {mode === "signup" ? "continue with email" : "Send Code"}
        </Button>
      </form>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleVerifyOTP}>
      <div className="text-center text-sm text-default-500 mb-4">
        Code sent to {email}
      </div>

      <Input
        isRequired
        isDisabled={isLoading}
        maxLength={6}
        placeholder="Enter 6-digit code"
        radius="lg"
        size="lg"
        startContent={<Icon icon="solar:shield-keyhole-bold-duotone" width={18} />}
        value={code}
        variant="bordered"
        onChange={(e) => setCode(e.target.value)}
      />

      <Button
        fullWidth
        color="primary"
        isLoading={isLoading}
        radius="lg"
        size="lg"
        type="submit"
      >
        Verify Code
      </Button>

      <div className="flex gap-2">
        <Button
          fullWidth
          isDisabled={isLoading}
          radius="lg"
          size="lg"
          variant="bordered"
          onPress={resetOtpStep}
        >
          Change Email
        </Button>

        <Button
          fullWidth
          color="secondary"
          isDisabled={resendCooldown > 0 || isLoading}
          radius="lg"
          size="lg"
          variant="flat"
          onPress={handleResendOTP}
        >
          {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend"}
        </Button>
      </div>
    </form>
  );
});
