import {
  ONBOARDING_STEP_META,
  TOTAL_STEPS as TOTAL,
  type OnboardingStepMeta,
} from "@repo/types";

// Re-export shared types for backward compatibility
export type OnboardingStep = OnboardingStepMeta;

// Sub-step type definition (local to frontend)
export type OnboardingSubStep = {
  id: string;
  name: string;
  title: string;
  route: string;
  icon?: string;
  conditional?: boolean;
};

// Convert shared meta to array format for UI components
export const ONBOARDING_STEPS: readonly OnboardingStep[] = Object.values(ONBOARDING_STEP_META);

// The complete page route for reference (not shown in sidebar)
export const COMPLETE_ROUTE = "/onboarding/complete";

// Helper to get step by ID
export const getStepById = (id: number): OnboardingStep | undefined =>
  ONBOARDING_STEPS.find((step) => step.id === id);

// Helper to get step by key
export const getStepByKey = (key: string): OnboardingStep | undefined =>
  ONBOARDING_STEPS.find((step) => step.key === key);

// Helper to get step by route (includes sub-steps)
export const getStepByRoute = (route: string): OnboardingStep | undefined => {
  // First check main steps
  const mainStep = ONBOARDING_STEPS.find((step) => step.route === route);

  if (mainStep) return mainStep;

  // Then check sub-steps
  for (const step of ONBOARDING_STEPS) {
    if (step.subSteps?.some((sub) => sub.route === route)) {
      return step;
    }
  }

  return undefined;
};

// Get the current sub-step for a route
export const getCurrentSubStep = (
  route: string,
  parentStep: OnboardingStep,
): OnboardingSubStep | undefined => {
  return parentStep.subSteps?.find((sub) => sub.route === route);
};

// Get next step or sub-step
export const getNextStep = (currentStepId: number, currentRoute?: string) => {
  const currentStep = getStepById(currentStepId);

  if (!currentStep) return undefined;

  // If we're on a sub-step, check for next sub-step first
  if (currentRoute && currentStep.subSteps) {
    const subSteps = currentStep.subSteps; // narrowed by guard
    const currentSubIndex = subSteps.findIndex(
      (sub) => sub.route === currentRoute,
    );

    if (
      currentSubIndex !== -1 &&
      currentSubIndex < subSteps.length - 1
    ) {
      // Return next sub-step
      return {
        id: currentStepId,
        route: subSteps[currentSubIndex + 1]!.route,
        key: currentStep.key,
        isSubStep: true,
      };
    }
  }

  // No special handling needed - complete is now a regular step

  // Otherwise go to next main step
  const nextStep = ONBOARDING_STEPS.find(
    (step) => step.id === currentStepId + 1,
  );

  if (nextStep) {
    // If next step has sub-steps, go to first sub-step
    if (nextStep.subSteps && nextStep.subSteps.length > 0) {
      const firstSub = nextStep.subSteps[0]!;
      return {
        id: nextStep.id,
        route: firstSub.route,
        key: nextStep.key,
        isSubStep: true,
      };
    }

    return {
      id: nextStep.id,
      route: nextStep.route,
      key: nextStep.key,
      isSubStep: false,
    };
  }

  return undefined;
};

// Get previous step
export const getPreviousStep = (
  currentStepId: number,
  currentRoute?: string,
) => {
  const currentStep = getStepById(currentStepId);

  if (!currentStep) return undefined;

  // If we're on a sub-step, check for previous sub-step first
  if (currentRoute && currentStep.subSteps) {
    const subSteps = currentStep.subSteps; // narrowed by guard
    const currentSubIndex = subSteps.findIndex(
      (sub) => sub.route === currentRoute,
    );

    if (currentSubIndex > 0) {
      // Return previous sub-step
      return {
        id: currentStepId,
        route: subSteps[currentSubIndex - 1]!.route,
        key: currentStep.key,
        isSubStep: true,
      };
    }
  }

  // Otherwise go to previous main step
  const prevStep = ONBOARDING_STEPS.find(
    (step) => step.id === currentStepId - 1,
  );

  if (prevStep) {
    // If previous step has sub-steps, go to last sub-step
    if (prevStep.subSteps && prevStep.subSteps.length > 0) {
      const lastSub = prevStep.subSteps[prevStep.subSteps.length - 1]!;
      return {
        id: prevStep.id,
        route: lastSub.route,
        key: prevStep.key,
        isSubStep: true,
      };
    }

    return {
      id: prevStep.id,
      route: prevStep.route,
      key: prevStep.key,
      isSubStep: false,
    };
  }

  return undefined;
};

// Total steps (re-export from shared types)
export const TOTAL_STEPS = TOTAL;

// Check if step is valid
export const isValidStep = (stepId: number) =>
  stepId >= 1 && stepId <= TOTAL_STEPS;

// Helpers to map between step id and key
export const getStepKeyById = (id: number): string | undefined =>
  getStepById(id)?.key;

export const getStepIdByKey = (key: string): number | undefined =>
  getStepByKey(key)?.id;

// Helper to check if we're on a specific page
export const isOnboardingRoute = (pathname: string) => {
  return pathname.startsWith("/onboarding/");
};

// Helper to check if we're on the complete page
export const isCompleteRoute = (pathname: string) => {
  return pathname === COMPLETE_ROUTE;
};

// Helper to check if we're on the accounts sub-page
export const isAccountsRoute = (pathname: string) => {
  return pathname.startsWith("/onboarding/accounts");
};
