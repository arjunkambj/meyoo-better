"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter, usePathname } from "next/navigation";
import { memo, useCallback, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import {
  getNextStep,
  getPreviousStep,
  getStepByRoute,
  COMPLETE_ROUTE,
} from "@/constants/onboarding";
import { optimisticNavigationAtom, completeStepAtom, setNavigationPendingAtom } from "@/store/onboarding";
import { useUpdateOnboardingState } from "@/hooks/onboarding/useOnboarding";

interface NavigationButtonsProps {
  onNext?: () => Promise<boolean> | boolean; // Return false to prevent navigation
  onPrevious?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  isNextDisabled?: boolean;
  isNextLoading?: boolean;
  showPrevious?: boolean;
  showSkip?: boolean;
  onSkip?: () => void;
  className?: string;
  variant?: "inline" | "floating"; // floating = fixed bottom-right like reference
}

const NavigationButtons = memo(function NavigationButtons({
  onNext,
  onPrevious,
  nextLabel,
  previousLabel = "Back",
  isNextDisabled = false,
  isNextLoading = false,
  showPrevious = true,
  showSkip = false,
  onSkip,
  className = "",
  variant = "floating",
}: NavigationButtonsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const updateOnboardingState = useUpdateOnboardingState();
  const [internalLoading, setInternalLoading] = useState(false);
  
  const optimisticNavigation = useSetAtom(optimisticNavigationAtom);
  const completeStep = useSetAtom(completeStepAtom);
  const setNavigationPending = useSetAtom(setNavigationPendingAtom);

  // Get current step info
  const currentStepInfo = useMemo(() => {
    const stepInfo = getStepByRoute(pathname);
    return {
      stepId: stepInfo?.id || 1,
      isComplete: pathname === COMPLETE_ROUTE,
    };
  }, [pathname]);

  // Get navigation routes with memoization
  const { nextRoute, previousRoute, isLastStep } = useMemo(() => {
    const next = getNextStep(currentStepInfo.stepId, pathname);
    const previous = getPreviousStep(currentStepInfo.stepId, pathname);
    
    return {
      nextRoute: next?.route,
      previousRoute: previous?.route,
      isLastStep: currentStepInfo.isComplete || !next,
    };
  }, [currentStepInfo, pathname]);

  // Dynamic next button label
  const computedNextLabel = useMemo(() => {
    if (nextLabel) return nextLabel;
    if (isLastStep) return "Complete Setup";
    return "Save & Continue";
  }, [nextLabel, isLastStep]);

  // Optimistic navigation handlers
  const handleNext = useCallback(async () => {
    if (isNextDisabled || !nextRoute) return;

    console.log(`[NavigationButtons] handleNext called - currentStep: ${currentStepInfo.stepId}, nextRoute: ${nextRoute}`);

    try {
      setInternalLoading(true);
      setNavigationPending(true);
      // Run custom onNext validation if provided
      if (onNext) {
        const canProceed = await onNext();
        if (canProceed === false) {
          console.log('[NavigationButtons] onNext validation returned false, cancelling navigation');
          setInternalLoading(false);
          setNavigationPending(false);
          return;
        }
      }

      // Complete current step
      completeStep(currentStepInfo.stepId);

      // Optimistic navigation with Jotai
      const nextStepInfo = getStepByRoute(nextRoute);
      if (nextStepInfo) {
        optimisticNavigation({ step: nextStepInfo.id, route: nextRoute });
      }

      // Persist next step on the server BEFORE navigation to avoid RouteGuard race
      // This prevents getting bounced back to the same step when server state lags
      if (nextStepInfo?.id) {
        console.log(
          `[NavigationButtons] Persisting onboarding state to step ${nextStepInfo.id} before navigation (${nextRoute})`
        );
        try {
          const res = await updateOnboardingState({ step: nextStepInfo.id });
          if (!res?.success) {
            console.error(
              "[NavigationButtons] Onboarding state update did not succeed; halting navigation"
            );
            setInternalLoading(false);
            setNavigationPending(false);
            return;
          }
        } catch (err) {
          console.error(
            "[NavigationButtons] Failed to update onboarding state (blocking nav for safety):",
            err
          );
          // If server update fails, stop here and let user retry
          setInternalLoading(false);
          setNavigationPending(false);
          return;
        }
      }

      // Navigate after server acknowledges step update
      router.push(nextRoute);
    } catch (error) {
      console.error("Navigation error:", error);
      setInternalLoading(false);
      setNavigationPending(false);
    }
  }, [
    isNextDisabled,
    nextRoute,
    onNext,
    completeStep,
    currentStepInfo.stepId,
    optimisticNavigation,
    router,
    updateOnboardingState,
  ]);

  const handlePrevious = useCallback(() => {
    if (!previousRoute) return;

    // Run custom onPrevious if provided
    if (onPrevious) {
      onPrevious();
    }

    // Optimistic navigation
    const previousStepInfo = getStepByRoute(previousRoute);
    if (previousStepInfo) {
      optimisticNavigation({
        step: previousStepInfo.id,
        route: previousRoute,
      });
    }

    // Navigate
    setNavigationPending(true);
    router.push(previousRoute);
  }, [previousRoute, onPrevious, optimisticNavigation, router]);

  const containerBase = "flex items-center justify-between gap-4";
  const isFloating = variant !== "inline";

  return (
    <div className={
      isFloating
        ? `${containerBase} fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 pointer-events-none ${className}`
        : `${containerBase} ${className}`
    }>
      {/* Previous Button */}
      <div className={isFloating ? "pointer-events-auto" : ""}>
        {showPrevious && previousRoute ? (
          <Button
            variant="bordered"
            onPress={handlePrevious}
            isDisabled={internalLoading || isNextLoading}
            startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
            className="font-medium"
          >
            {previousLabel}
          </Button>
        ) : (
          <div /> // Spacer to maintain layout
        )}
      </div>

      <div className={`flex items-center gap-3 ${isFloating ? "pointer-events-auto" : ""}`}>
        {/* Skip Button */}
        {showSkip && onSkip && (
          <Button
            variant="flat"
            onPress={onSkip}
            className="font-medium"
          >
            Skip for now
          </Button>
        )}

        {/* Next Button */}
        {nextRoute && (
          <Button
            color="primary"
            onPress={handleNext}
            isDisabled={isNextDisabled || internalLoading || isNextLoading}
            isLoading={isNextLoading || internalLoading}
            endContent={
              !isNextLoading && (
                <Icon
                  icon={
                    isLastStep
                      ? "solar:check-circle-bold"
                      : "solar:arrow-right-linear"
                  }
                  width={16}
                />
              )
            }
            className="font-medium min-w-32 shadow-medium"
          >
            {computedNextLabel}
          </Button>
        )}
      </div>
    </div>
  );
});

export default NavigationButtons;
