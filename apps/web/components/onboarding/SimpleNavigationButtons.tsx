"use client";

import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

interface SimpleNavigationButtonsProps {
  onNext?: () => Promise<boolean> | void;
  onPrevious?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  isNextDisabled?: boolean;
  showPrevious?: boolean;
  isLastStep?: boolean;
}

export default function SimpleNavigationButtons({
  onNext,
  onPrevious,
  nextLabel = "Continue",
  previousLabel = "Back",
  isNextDisabled = false,
  showPrevious = true,
  isLastStep = false,
}: SimpleNavigationButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const setNavigationPending = useSetAtom(setNavigationPendingAtom);

  const handleNext = async () => {
    if (!onNext || isLoading) return;
    
    setIsLoading(true);
    setNavigationPending(true);
    try {
      const result = await onNext();
      if (result === false) {
        setIsLoading(false);
        setNavigationPending(false);
      }
    } catch (error) {
      console.error("Navigation error:", error);
      setIsLoading(false);
      setNavigationPending(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-0 p-6 flex items-center justify-end gap-4">
      {/* Previous Button */}
      {showPrevious && (
        <Button
          variant="flat"
          size="md"
          onPress={onPrevious}
          isDisabled={isLoading}
          startContent={<Icon icon="solar:arrow-left-line-duotone" />}
        >
          {previousLabel}
        </Button>
      )}

      {/* Next/Complete Button */}
      <Button
        color={isLastStep ? "success" : "primary"}
        size="md"
        onPress={handleNext}
        isDisabled={isNextDisabled || isLoading}
        endContent={
          isLoading ? (
            <Icon icon="solar:spinner-linear" className="animate-spin" />
          ) : isLastStep ? (
            <Icon icon="solar:check-circle-bold-duotone" />
          ) : (
            <Icon icon="solar:arrow-right-line-duotone" />
          )
        }
      >
        {isLastStep ? "Complete" : nextLabel}
      </Button>
    </div>
  );
}
