"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/react";
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
    try {
      await signIn("google", { redirectTo: returnUrl });
      // Keep the loading state active; successful sign-in will redirect.
    } catch (error) {
      setIsLoading(false);

      const message = parseAuthError(error);

      addToast({
        title: "Google sign-in failed",
        description: message,
        color: "danger",
        timeout: 5000,
      });
    }
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
