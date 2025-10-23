"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import React from "react";

import { parseAuthError } from "@/libs/auth/errorParser";

interface GoogleAuthButtonProps {
  returnUrl?: string;
  text?: string;
}

export const GoogleAuthButton = React.memo(function GoogleAuthButton({
  returnUrl = "/overview",
  text = "Sign in with Google",
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const { signIn } = useAuthActions();

  const handleGoogleLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);

    // Open popup immediately to avoid popup blockers
    signIn("google", { redirectTo: returnUrl }).catch((error) => {
      setIsLoading(false);

      const message = parseAuthError(error);

      addToast({
        title: "Google sign-in failed",
        description: message,
        color: "danger",
        timeout: 5000,
      });
    });
  };

  return (
    <Button
      fullWidth
      isLoading={isLoading}
      radius="lg"
      size="lg"
      variant="flat"
      startContent={
        !isLoading && <Icon icon="flat-color-icons:google" width={20} />
      }
      onPress={handleGoogleLogin}
    >
      {text}
    </Button>
  );
});
