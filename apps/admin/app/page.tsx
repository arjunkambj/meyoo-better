"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import Logo from "@/components/shared/Logo";
import { useState } from "react";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      void signIn("google", { redirectTo: "/dashboard" });
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Logo in top left */}
      <div className="absolute top-6 left-4">
        <Logo variant="full" size="md" />
      </div>

      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-4 p-10">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Welcome Back
            </h1>
            <p className="text-default-500 text-sm">
              Sign in to access the admin dashboard
            </p>
          </div>

          {/* Google Sign In Button */}
          <Button
            fullWidth
            size="lg"
            variant="flat"
            className="bg-default-100"
            startContent={<Icon icon="flat-color-icons:google" width={20} />}
            onPress={handleGoogleSignIn}
            isLoading={isLoading}
          >
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-divider" />
            <span className="text-xs text-default-400">SECURE ACCESS</span>
            <div className="flex-1 h-px bg-divider" />
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-default-400">
              Authorized personnel only · Protected by Convex Auth
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
