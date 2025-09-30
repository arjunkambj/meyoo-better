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
  import("./OTPAuthForm").then((mod) => ({ default: mod.OTPAuthForm }))
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
    mode === "signin" ? "password" : "otp"
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
    [email, password, mode, name, confirmPassword, returnUrl, router, signIn]
  );

  // Memoized toggle password visibility
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className="w-full bg-transparent max-w-lg mx-auto">
      <div className="px-3 py-8 sm:px-6 md:px-8">
        {/* Header */}
        <div className="mb-10 text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            {mode === "signin" ? "Welcome back" : "Get started free"}
          </h1>
          <p className="text-base text-muted-foreground">
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
              <form className="mt-8 space-y-5" onSubmit={handlePasswordAuth}>
                <Input
                  isRequired
                  isDisabled={isLoading}
                  placeholder="you@example.com"
                  variant="bordered"
                  radius="lg"
                  size="lg"
                  startContent={
                    <Icon
                      className="mr-1 text-default-400"
                      icon="solar:letter-bold"
                      width={20}
                    />
                  }
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  classNames={{
                    input: "text-base",
                    inputWrapper: "h-12"
                  }}
                />

                <Input
                  isRequired
                  endContent={
                    <button
                      className="focus:outline-none transition-colors hover:text-foreground"
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
                        width={20}
                      />
                    </button>
                  }
                  isDisabled={isLoading}
                  placeholder="Enter password"
                  radius="lg"
                  size="lg"
                  startContent={
                    <Icon
                      className="mr-1 text-default-400"
                      icon="solar:lock-keyhole-bold"
                      width={20}
                    />
                  }
                  type={showPassword ? "text" : "password"}
                  value={password}
                  variant="bordered"
                  onChange={(e) => setPassword(e.target.value)}
                  classNames={{
                    input: "text-base",
                    inputWrapper: "h-12"
                  }}
                />

                <Button
                  fullWidth
                  color="primary"
                  isLoading={isLoading}
                  radius="lg"
                  size="lg"
                  type="submit"
                  className="h-12 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-100"
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
        <div className="mt-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <Link
                  className="text-primary hover:text-primary/90 font-semibold transition-colors underline-offset-4 hover:underline"
                  href="/signup"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  className="text-primary hover:text-primary/90 font-semibold transition-colors underline-offset-4 hover:underline"
                  href="/signin"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>

        {/* Terms */}
        <div className="mt-6">
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            By continuing, you agree to our{" "}
            <Link
              className="text-foreground hover:text-primary font-medium transition-colors underline-offset-2 hover:underline"
              href="/privacy/terms"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              className="text-foreground hover:text-primary font-medium transition-colors underline-offset-2 hover:underline"
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
