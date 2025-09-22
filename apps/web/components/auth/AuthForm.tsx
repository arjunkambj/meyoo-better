"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { addToast, Button, Input, Skeleton, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { lazy, Suspense, useCallback, useState } from "react";
import { parseAuthError } from "@/libs/auth/errorParser";
import { AuthDivider } from "./AuthDivider";
import { GoogleAuthButton } from "./GoogleAuthButton";

// Lazy load OTP component only when needed
const OTPAuthForm = lazy(() =>
  import("./OTPAuthForm").then((mod) => ({ default: mod.OTPAuthForm })),
);

type AuthMode = "signin" | "signup";
type AuthMethod = "otp" | "password";

interface AuthFormProps {
  mode: AuthMode;
  returnUrl?: string;
}

export const AuthForm = React.memo(function AuthForm({
  mode,
  returnUrl = "/overview",
}: AuthFormProps) {
  // Default method: password for signin, OTP for signup
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    mode === "signin" ? "password" : "otp",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, _setConfirmPassword] = useState("");
  const [name, _setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useAuthActions();
  const router = useRouter();

  // Handle password auth with memoization
  const handlePasswordAuth = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Validation for signin
      if (mode === "signin") {
        if (!email.trim()) {
          addToast({
            title: "Email required",
            description: "Please enter your email address",
            color: "warning",
            timeout: 3000,
          });
          return;
        }

        if (!password.trim()) {
          addToast({
            title: "Password required",
            description: "Please enter your password",
            color: "warning",
            timeout: 3000,
          });
          return;
        }
      }

      // Validation for signup
      if (mode === "signup") {
        if (!name.trim()) {
          addToast({
            title: "Name required",
            description: "Please enter your name",
            color: "danger",
            timeout: 3000,
          });

          return;
        }

        if (password.length < 8) {
          addToast({
            title: "Password too short",
            description: "Password must be at least 8 characters",
            color: "danger",
            timeout: 3000,
          });

          return;
        }

        if (password !== confirmPassword) {
          addToast({
            title: "Passwords don't match",
            description: "Please make sure passwords match",
            color: "danger",
            timeout: 3000,
          });

          return;
        }
      }

      setIsLoading(true);

      try {
        const formData = new FormData();

        formData.append("email", email.toLowerCase().trim());
        formData.append("password", password);
        formData.append("flow", mode === "signup" ? "signUp" : "signIn");

        if (mode === "signup") {
          formData.append("name", name);
        }

        await signIn("password", formData);

        addToast({
          title: mode === "signup" ? "Account created!" : "Welcome back!",
          color: "default",
          timeout: 3000,
        });

        // Removed redundant API call - middleware will handle routing
        // Just navigate to the intended return URL
        router.push(returnUrl);
      } catch (err) {
        const message = parseAuthError(err);

        addToast({
          title: mode === "signup" ? "Sign up failed" : "Sign in failed",
          description: message,
          color: "danger",
          timeout: 5000,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, mode, name, confirmPassword, returnUrl, router, signIn],
  );

  // Memoized toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className="w-full max-w-lg  mx-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            {mode === "signin" ? "Welcome back" : "Get started free"}
          </h1>
          <p className="text-default-600">
            {mode === "signin"
              ? "Sign in to access your dashboard"
              : "Start your profit intelligence journey"}
          </p>
        </div>

        {/* Google Auth */}
        <GoogleAuthButton
          returnUrl={returnUrl}
          text={
            mode === "signin" ? "Continue with Google" : "Sign up with Google"
          }
        />

        {/* Divider */}
        <AuthDivider />

        {/* Auth Methods */}
        {mode === "signup" ? (
          // Disable password-based signup: render only OTP method
          <Suspense
            fallback={
              <div className="mt-6 space-y-4">
                <Skeleton className="rounded-lg">
                  <div className="h-12 rounded-lg bg-default-300"></div>
                </Skeleton>
                <Skeleton className="rounded-lg">
                  <div className="h-12 rounded-lg bg-default-300"></div>
                </Skeleton>
              </div>
            }
          >
            <OTPAuthForm mode={mode} returnUrl={returnUrl} />
          </Suspense>
        ) : (
          <Tabs
            fullWidth
            selectedKey={authMethod}
            onSelectionChange={(key) => setAuthMethod(key as AuthMethod)}
          >
            <Tab key="password" title="Password">
              <form className="mt-6 space-y-4" onSubmit={handlePasswordAuth}>
                <Input
                  isRequired
                  isDisabled={isLoading}
                  placeholder="you@example.com"
                  variant="bordered"
                  radius="lg"
                  startContent={
                    <Icon
                      className="mr-1"
                      icon="solar:letter-bold"
                      width={18}
                    />
                  }
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                  isRequired
                  endContent={
                    <button
                      className="focus:outline-none"
                      type="button"
                      onClick={togglePasswordVisibility}
                    >
                      <Icon
                        className="text-default-400"
                        icon={
                          showPassword
                            ? "solar:eye-closed-linear"
                            : "solar:eye-linear"
                        }
                        width={18}
                      />
                    </button>
                  }
                  isDisabled={isLoading}
                  placeholder="Enter password"
                  radius="lg"
                  startContent={
                    <Icon
                      className="mr-1"
                      icon="solar:lock-keyhole-bold"
                      width={18}
                    />
                  }
                  type={showPassword ? "text" : "password"}
                  value={password}
                  variant="bordered"
                  onChange={(e) => setPassword(e.target.value)}
                />

                <Button
                  fullWidth
                  color="primary"
                  isLoading={isLoading}
                  radius="lg"
                  size="lg"
                  type="submit"
                >
                  Sign In
                </Button>
              </form>
            </Tab>

            <Tab key="otp" title="Email OTP">
              <Suspense
                fallback={
                  <div className="mt-6 space-y-4">
                    <Skeleton className="rounded-lg">
                      <div className="h-12 rounded-lg bg-default-300"></div>
                    </Skeleton>
                    <Skeleton className="rounded-lg">
                      <div className="h-12 rounded-lg bg-default-300"></div>
                    </Skeleton>
                  </div>
                }
              >
                <OTPAuthForm mode={mode} returnUrl={returnUrl} />
              </Suspense>
            </Tab>
          </Tabs>
        )}

        {/* Footer Links */}
        <div className="mt-4 text-center space-y-2">
          <p className="text-sm text-default-500">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                  href="/signup"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                  href="/signin"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>

        {/* Terms */}
        <div className="mt-2">
          <p className="text-center text-xs text-default-500">
            By continuing, you agree to our{" "}
            <Link
              className="text-primary hover:text-primary/80 font-medium transition-colors"
              href="/privacy/terms"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              className="text-primary hover:text-primary/80 font-medium transition-colors"
              href="/privacy/policy"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
});

