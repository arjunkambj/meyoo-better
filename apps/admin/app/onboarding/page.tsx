"use client";

import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Icon } from "@iconify/react";
import Logo from "@/components/shared/Logo";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  const handleContactAdmin = () => {
    window.location.href =
      "mailto:admin@meyoo.com?subject=Admin Access Request";
  };

  const handleSignOut = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Logo in top left */}
      <div className="absolute top-6 left-4">
        <Logo variant="full" size="md" />
      </div>

      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-lg w-full mx-4 p-10 text-center">
          {/* Status Chip */}
          <div className="flex justify-center mb-6">
            <Chip
              size="lg"
              variant="flat"
              color="warning"
              startContent={
                <Icon icon="solar:hourglass-line-linear" width={18} />
              }
            >
              Pending Approval
            </Chip>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-foreground mb-3">
            Access Request Received
          </h1>

          {/* Description */}
          <p className="text-default-500 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            Your admin access request has been submitted. An administrator will
            review and approve your request shortly.
          </p>

          {/* Info Box */}
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-center gap-2">
              <Icon
                icon="solar:clock-circle-linear"
                className="text-warning-600"
                width={20}
              />
              <span className="text-sm font-medium text-warning-700">
                Expected approval time: 1-2 hours
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              fullWidth
              size="lg"
              variant="flat"
              className="bg-default-100"
              startContent={<Icon icon="solar:letter-linear" width={20} />}
              onPress={handleContactAdmin}
            >
              Contact Administrator
            </Button>

            <Button
              fullWidth
              size="lg"
              variant="light"
              startContent={<Icon icon="solar:logout-2-linear" width={20} />}
              onPress={handleSignOut}
            >
              Sign Out
            </Button>
          </div>

          {/* Footer Note */}
          <div className="mt-8">
            <p className="text-xs text-default-400">
              You&apos;ll receive an email once your access is approved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
