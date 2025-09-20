"use client";

import { Button } from "@heroui/react";
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
    <div className="flex items-center justify-between gap-4 mt-8">
      {/* Previous Button */}
      {showPrevious ? (
        <Button
          variant="flat"
          size="md"
          onPress={onPrevious}
          isDisabled={isLoading}
          startContent={<Icon icon="solar:arrow-left-linear" />}
        >
          {previousLabel}
        </Button>
      ) : (
        <div />
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
            <Icon icon="solar:check-circle-linear" />
          ) : (
            <Icon icon="solar:arrow-right-linear" />
          )
        }
      >
        {isLastStep ? "Complete" : nextLabel}
      </Button>
    </div>
  );
}
