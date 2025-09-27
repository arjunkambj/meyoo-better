/**
 * Shared onboarding constants between frontend and backend
 * This ensures consistency across the entire application
 */

export const ONBOARDING_STEPS = {
  SHOPIFY: 1,
  BILLING: 2,
  MARKETING: 3,
  ACCOUNTS: 4,
  PRODUCTS: 5,
  COSTS: 6,
  COMPLETE: 7,
} as const;

export const ONBOARDING_STEP_KEYS = {
  1: "shopify",
  2: "billing",
  3: "marketing",
  4: "accounts",
  5: "products",
  6: "cost",
  7: "complete",
} as const;

export const ONBOARDING_ROUTES = {
  shopify: "/onboarding/shopify",
  billing: "/onboarding/billing",
  marketing: "/onboarding/marketing",
  accounts: "/onboarding/accounts",
  products: "/onboarding/products",
  cost: "/onboarding/cost",
  complete: "/onboarding/complete",
} as const;

export type OnboardingStepNumber = typeof ONBOARDING_STEPS[keyof typeof ONBOARDING_STEPS];
export type OnboardingStepKey = typeof ONBOARDING_STEP_KEYS[OnboardingStepNumber];
export type OnboardingRoute = typeof ONBOARDING_ROUTES[OnboardingStepKey];

export interface SyncStageStatus {
  products?: string;
  inventory?: string;
  customers?: string;
  orders?: string;
}

export interface PlatformSyncStatus {
  status: string;
  recordsProcessed?: number;
  baselineRecords?: number;
  ordersProcessed?: number;
  ordersQueued?: number;
  productsProcessed?: number;
  customersProcessed?: number;
  startedAt?: number;
  completedAt?: number;
  lastError?: string;
  stageStatus?: SyncStageStatus;
  syncedEntities?: string[];
}

export interface OnboardingStatus {
  completed: boolean;
  currentStep: OnboardingStepNumber;
  completedSteps: OnboardingStepKey[];
  connections: {
    shopify: boolean;
    meta: boolean;
  };
  hasShopifySubscription: boolean;
  isProductCostSetup: boolean;
  isExtraCostSetup: boolean;
  isInitialSyncComplete: boolean;
  syncStatus?: {
    shopify?: PlatformSyncStatus;
    meta?: PlatformSyncStatus;
  };
  pendingSyncPlatforms?: string[];
  analyticsTriggeredAt?: number;
  lastSyncCheckAt?: number;
  syncCheckAttempts?: number;
}

export interface OnboardingStepMeta {
  id: OnboardingStepNumber;
  key: OnboardingStepKey;
  name: string;
  title: string;
  subtitle: string;
  route: OnboardingRoute;
  icon: string;
  required: boolean;
  /** Optional list of sub-steps for richer onboarding flows (frontend may render these) */
  subSteps?: OnboardingSubStep[];
}

/**
 * Optional sub-step metadata for onboarding flows.
 * This is primarily used by the frontend to render nested progress.
 */
export interface OnboardingSubStep {
  id: string;
  name: string;
  title: string;
  route: string;
  icon?: string;
  conditional?: boolean;
}

export const ONBOARDING_STEP_META: Record<OnboardingStepKey, OnboardingStepMeta> = {
  shopify: {
    id: 1,
    key: "shopify",
    name: "Shopify",
    title: "Connect Shopify",
    subtitle: "Link your store to start",
    route: "/onboarding/shopify",
    icon: "solar:shop-bold",
    required: true,
  },
  billing: {
    id: 2,
    key: "billing",
    name: "Billing",
    title: "Choose Plan",
    subtitle: "Select a plan to continue",
    route: "/onboarding/billing",
    icon: "solar:card-bold",
    required: true,
  },
  marketing: {
    id: 3,
    key: "marketing",
    name: "Marketing",
    title: "Connect Marketing",
    subtitle: "Optional: Meta and Google",
    route: "/onboarding/marketing",
    icon: "solar:speaker-bold-duotone",
    required: false,
  },
  accounts: {
    id: 4,
    key: "accounts",
    name: "Ad Accounts",
    title: "Select Ad Accounts",
    subtitle: "Choose your primary accounts",
    route: "/onboarding/accounts",
    icon: "solar:user-id-bold",
    required: false,
  },
  products: {
    id: 5,
    key: "products",
    name: "Products",
    title: "Product Costs",
    subtitle: "Set costs for your products",
    route: "/onboarding/products",
    icon: "solar:box-bold",
    required: false,
  },
  cost: {
    id: 6,
    key: "cost",
    name: "Costs",
    title: "Fixed Costs",
    subtitle: "Salary, expenses, gateway fees",
    route: "/onboarding/cost",
    icon: "solar:calculator-minimalistic-bold-duotone",
    required: false,
  },
  complete: {
    id: 7,
    key: "complete",
    name: "Complete",
    title: "Review & Finish",
    subtitle: "Start syncing data",
    route: "/onboarding/complete",
    icon: "solar:check-circle-bold-duotone",
    required: true,
  },
};

export const TOTAL_STEPS = Object.keys(ONBOARDING_STEPS).length;
