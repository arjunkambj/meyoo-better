import type { Id } from "@repo/convex/dataModel";

// User types
export interface User {
  _id: Id<"users">;
  _creationTime: number;
  userId: Id<"users">;

  // Auth fields from Better Auth
  email?: string;
  emailVerified?: boolean;
  name?: string;
  image?: string;

  // Contact information
  mobileNumber?: string;
  mobileCountryCode?: string;

  // Onboarding - simplified
  isOnboarded?: boolean;

  // Settings
  timezone?: string;
  locale?: string;
  emailNotifications?: boolean;
  marketingEmails?: boolean;
  twoFactorEnabled?: boolean;

  // Account status
  status?: "active" | "inactive" | "suspended";
  lastLoginAt?: string;
  loginCount?: number;

  // Metadata
  updatedAt?: string;
}

export interface OnboardingData {
  referralSource?: string;
  setupDate?: string;
  completedSteps?: string[];
  syncPendingPlatforms?: string[];
  syncCheckAttempts?: number;
  lastSyncCheckAt?: number;
  analyticsTriggeredAt?: number;
}

// Dedicated onboarding record interface
export interface Onboarding {
  _id: Id<"onboarding">;
  _creationTime: number;
  userId: Id<"users">;
  organizationId: Id<"organizations">;

  // Current onboarding state
  onboardingStep?: number;
  isCompleted?: boolean;

  // Integration connection status
  hasShopifyConnection?: boolean;
  hasMetaConnection?: boolean;
  hasGoogleConnection?: boolean;
  isInitialSyncComplete?: boolean;

  // Setup progress
  hasSetupInitialCosts?: boolean;
  isProductCostSetup?: boolean;
  isExtraCostSetup?: boolean;

  // Onboarding metadata
  onboardingData?: OnboardingData;

  // Timestamps
  createdAt?: number;
  updatedAt?: number;
}

export interface BusinessProfile {
  mobileNumber?: string;
  mobileCountryCode?: string;
  referralSource?: string;
}

// Organization types
export interface Organization {
  _id: string;
  name: string;
  ownerId: Id<"users">;

  // Settings
  primaryCurrency?: string;
  timezone?: string;

  // Billing
  billingEmail?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: "free" | "starter" | "growth" | "business" | "enterprise";

  // Metadata
  updatedAt?: string;
}

// Sync session types
export type SyncStatus =
  | "pending"
  | "syncing"
  | "completed"
  | "failed"
  | "cancelled";

export interface SyncSession {
  _id: Id<"syncSessions">;
  organizationId: string;
  platform: "shopify" | "meta";
  type: string;
  status: SyncStatus;
  startedAt: string;
  completedAt?: string;
  recordsProcessed?: number;
  recordsFailed?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Integration session types
export interface IntegrationSession {
  _id: Id<"integrationSessions">;
  organizationId: string;
  userId: Id<"users">;
  platform: "shopify" | "meta";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scope?: string;
  accountId?: string;
  accountName?: string;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt?: string;
}
