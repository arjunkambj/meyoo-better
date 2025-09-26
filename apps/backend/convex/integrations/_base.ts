import type { GenericActionCtx, GenericMutationCtx } from "convex/server";

import type { DataModel } from "../_generated/dataModel";

/**
 * Sync result interface
 */
export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  dataChanged: boolean;
  errors?: string[];
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Date range for syncing
 */
export interface DateRange {
  startDate?: string;
  endDate?: string;
  daysBack?: number;
}

export const DATE_RANGES = {
  TODAY: 0,
  YESTERDAY: 1,
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
  LAST_90_DAYS: 90,
  LAST_YEAR: 365,
  LAST_2_YEARS: 730,
  LAST_5_YEARS: 1825,
  ALL_TIME: null,
} as const;

export type DateRangePreset = keyof typeof DATE_RANGES;

function buildDateRange(daysBack: number): DateRange {
  const endDate = new Date();
  const startDate = new Date();

  startDate.setDate(startDate.getDate() - daysBack);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    daysBack,
  };
}

/**
 * Base integration interface that all platforms must implement
 */
export interface Integration {
  /**
   * Integration metadata
   */
  name: string;
  displayName: string;
  version: string;
  icon?: string;

  /**
   * Sync operations
   */
  sync: {
    /**
     * Initial sync - fetch historical data (usually 60 days)
     */
    initial: (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        dateRange?: DateRange;
        credentials?: Record<string, string>;
      },
    ) => Promise<SyncResult>;

    /**
     * Incremental sync - fetch recent updates
     */
    incremental: (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        since?: string;
        credentials?: Record<string, string>;
      },
    ) => Promise<SyncResult>;

    /**
     * Daily sync - scheduled daily sync
     */
    daily?: (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
      },
    ) => Promise<SyncResult>;

    /**
     * Validate credentials/connection
     */
    validate: (
      ctx: GenericActionCtx<DataModel>,
      args: {
        organizationId: string;
        credentials?: Record<string, string>;
      },
    ) => Promise<boolean>;
  };

  /**
   * Webhook handlers (optional - mainly for Shopify)
   */
  webhooks?: {
    [topic: string]: (
      ctx: GenericMutationCtx<DataModel>,
      payload: Record<string, unknown>,
    ) => Promise<void>;
  };

  /**
   * Data access queries
   */
  queries: {
    [key: string]: unknown; // Query functions registered separately
  };

  /**
   * Data mutations
   */
  mutations?: {
    [key: string]: unknown; // Mutation functions registered separately
  };

  /**
   * Rate limiting configuration
   */
  rateLimit: {
    requests: number; // Max requests
    window: number; // Time window in milliseconds
    concurrent?: number; // Max concurrent requests
  };

  /**
   * OAuth configuration (optional)
   */
  oauth?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientId?: string; // Can be from env
    clientSecret?: string; // Can be from env
  };

  /**
   * Required environment variables
   */
  requiredEnvVars?: string[];

  /**
   * Cost per API call (for optimization)
   */
  apiCost?: number;
}

/**
 * Integration registry type
 */
export type IntegrationRegistry = Record<string, Integration>;

/**
 * Helper to create a typed integration
 */
export function createIntegration<T extends Integration>(integration: T): T {
  // Validate required fields
  if (!integration.name) {
    throw new Error("Integration must have a name");
  }

  if (!integration.sync?.initial || !integration.sync?.incremental) {
    throw new Error(
      `Integration ${integration.name} must implement initial and incremental sync`,
    );
  }

  if (!integration.rateLimit) {
    throw new Error(`Integration ${integration.name} must define rate limits`);
  }

  return integration;
}

/**
 * Common sync utilities
 */
export const SyncUtils = {
  /**
   * Calculate date range for initial sync
   */
  getInitialDateRange(daysBack: number = 60): DateRange {
    return buildDateRange(daysBack);
  },

  /**
   * Convenience helper to map preset ranges to concrete dates
   */
  getPresetDateRange(preset: DateRangePreset): DateRange {
    const daysBack = DATE_RANGES[preset];

    if (daysBack === null) {
      return {};
    }

    return buildDateRange(daysBack);
  },

  /**
   * Check if sync is needed based on last sync time
   */
  shouldSync(lastSyncTime: number, minInterval: number): boolean {
    return Date.now() - lastSyncTime > minInterval;
  },

  /**
   * Format sync result
   */
  formatResult(
    success: boolean,
    recordsProcessed: number,
    dataChanged: boolean,
    errors?: string[],
  ): SyncResult {
    return {
      success,
      recordsProcessed,
      dataChanged,
      errors: errors || [],
    };
  },

  /**
   * Batch process items with rate limiting
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10,
    delayMs: number = 100,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));

      results.push(...batchResults);

      // Delay between batches to respect rate limits
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  },
};

/**
 * Base OAuth handler
 */
export const OAuthUtils = {
  /**
   * Generate OAuth state for CSRF protection
   */
  generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  },

  /**
   * Build authorization URL
   */
  buildAuthUrl(
    baseUrl: string,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state: string,
    additionalParams?: Record<string, string>,
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      response_type: "code",
      ...additionalParams,
    });

    return `${baseUrl}?${params.toString()}`;
  },

  /**
   * Exchange code for token
   */
  async exchangeCodeForToken(
    tokenUrl: string,
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }> {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Refresh access token
   */
  async refreshToken(
    tokenUrl: string,
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }> {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    return response.json();
  },
};

/**
 * Common webhook utilities
 */
export const WebhookUtils = {
  /**
   * Verify webhook signature (HMAC)
   */
  async verifyHMAC(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload),
    );

    const computedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signatureBuffer)),
    );

    return computedSignature === signature;
  },

  /**
   * Parse webhook headers
   */
  parseHeaders(headers: Headers): Record<string, string> {
    const parsed: Record<string, string> = {};

    headers.forEach((value, key) => {
      parsed[key.toLowerCase()] = value;
    });

    return parsed;
  },
};

/**
 * Error types for integrations
 */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public integration: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

export class RateLimitError extends IntegrationError {
  constructor(
    integration: string,
    public retryAfter?: number,
  ) {
    super(
      `Rate limit exceeded for ${integration}`,
      "RATE_LIMIT",
      integration,
      true,
    );
    this.name = "RateLimitError";
  }
}

export class AuthenticationError extends IntegrationError {
  constructor(integration: string, details?: string) {
    super(
      `Authentication failed for ${integration}: ${details || "Invalid credentials"}`,
      "AUTH_FAILED",
      integration,
      false,
    );
    this.name = "AuthenticationError";
  }
}
