"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="relative text-center max-w-lg mx-auto">
        {/* Decorative accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-10 -top-10 h-32 bg-gradient-to-b from-primary/10 to-transparent rounded-3xl blur-2xl"
        />

        {/* 404 header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-content2 px-3 py-1 text-xs text-default-600">
            Not Found
          </div>
          <h1 className="mt-3 text-7xl sm:text-8xl font-extrabold tracking-tight">
            <span className="text-primary">404</span>
          </h1>
        </div>

        {/* Message Card */}
        <div className="bg-content2 rounded-2xl p-6 mb-8  text-left">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center">
                <Icon
                  className="text-warning-600"
                  icon="solar:danger-triangle-outline"
                  width={24}
                />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-default-900 mb-1">
                Page not found
              </h2>
              <p className="text-sm text-default-600">
                The page you&apos;re looking for doesn&apos;t exist or may have
                been moved. If you typed the URL manually, please check your
                spelling.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            color="primary"
            size="lg"
            startContent={
              <Icon icon="solar:alt-arrow-left-linear" width={20} />
            }
            onPress={() => router.back()}
          >
            Go Back
          </Button>

          <Button
            size="lg"
            startContent={
              <Icon icon="solar:double-alt-arrow-up-bold" width={20} />
            }
            variant="bordered"
            onPress={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Help & Report */}
        <div className="mt-8 space-y-2 text-sm text-default-500">
          <p>
            Need help?{" "}
            <button
              type="button"
              className="text-primary hover:underline transition-all duration-200"
              onClick={() => router.push("/settings/help")}
            >
              Contact Support
            </button>
          </p>
          <p>
            Think this is a bug?{" "}
            <button
              type="button"
              className="text-default-700 hover:underline transition-all duration-200"
              onClick={() => router.push("/dashboard")}
            >
              Report an issue
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
