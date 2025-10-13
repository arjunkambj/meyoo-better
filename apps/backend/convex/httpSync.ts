import { getAuthUserId } from "@convex-dev/auth/server";
import { httpAction } from "./_generated/server";

/**
 * Sync HTTP Endpoints
 * Direct HTTP handlers for platform sync triggers
 */

interface SyncRequest {
  syncType?: "full" | "incremental" | string;
  storeId?: string;
  adAccountId?: string;
  customerAccountId?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
    daysBack?: number;
  };
}

interface SyncResponse {
  success: boolean;
  platform: string;
  syncType: string;
  sessionId?: string;
  message: string;
  error?: string;
  alreadyRunning?: boolean;
}

/**
 * Helper to check billing limits
 */
async function checkBillingLimits(): Promise<{
  allowed: boolean;
  creditsRemaining: number;
  message?: string;
}> {
  return { allowed: true, creditsRemaining: Number.POSITIVE_INFINITY };
}

/**
 * Helper to validate date range
 */
function validateDateRange(dateRange?: SyncRequest["dateRange"]): {
  valid: boolean;
  error?: string;
} {
  if (!dateRange) return { valid: true };

  const { startDate, endDate, daysBack } = dateRange;

  if (startDate && isNaN(Date.parse(startDate))) {
    return {
      valid: false,
      error: "Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)",
    };
  }

  if (endDate && isNaN(Date.parse(endDate))) {
    return {
      valid: false,
      error: "Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)",
    };
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return {
      valid: false,
      error: "startDate must be before endDate",
    };
  }

  if (
    daysBack !== undefined &&
    (typeof daysBack !== "number" || daysBack < 0)
  ) {
    return {
      valid: false,
      error: "daysBack must be a positive number",
    };
  }

  return { valid: true };
}

/**
 * Create a sync handler for a platform
 */
function createSyncHandler(config: {
  platform: string;
  validSyncTypes: string[];
  defaultSyncType?: string;
  idFieldName: "storeId" | "adAccountId" | "customerAccountId";
  requireAuth?: boolean;
  supportDateRange?: boolean;
}) {
  return httpAction(async (ctx, request): Promise<Response> => {
    const requestId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Only accept POST requests
      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Method not allowed",
          } as SyncResponse),
          {
            status: 405,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Parse request body
      const body = (await request.json()) as SyncRequest;

      // Get auth user if required
      if (config.requireAuth !== false) {
        // Get auth token from header
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return new Response(
            JSON.stringify({
              success: false,
              platform: config.platform,
              syncType: "",
              message: "Authentication required",
              error: "Missing or invalid authorization header",
            } as SyncResponse),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Get user from token (using Convex Auth)
        const userId = await getAuthUserId(ctx);
        if (!userId) {
          return new Response(
            JSON.stringify({
              success: false,
              platform: config.platform,
              syncType: "",
              message: "Authentication failed",
              error: "Invalid or expired token",
            } as SyncResponse),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Check billing limits (getCurrentUsage will handle organization lookup)
        const billingCheck = await checkBillingLimits();
        if (!billingCheck.allowed) {
          return new Response(
            JSON.stringify({
              success: false,
              platform: config.platform,
              syncType: body.syncType || config.defaultSyncType || "",
              message: billingCheck.message || "Billing limit reached",
              error: billingCheck.message,
            } as SyncResponse),
            {
              status: 402,
              headers: {
                "Content-Type": "application/json",
                "X-Credits-Remaining": billingCheck.creditsRemaining.toString(),
              },
            },
          );
        }
      }

      // Validate sync type
      const syncType: string =
        body.syncType ?? config.defaultSyncType ?? config.validSyncTypes[0] ?? "";
      if (!config.validSyncTypes.includes(syncType)) {
        return new Response(
          JSON.stringify({
            success: false,
            platform: config.platform,
            syncType,
            message: `Invalid sync type: ${syncType}`,
            error: `Valid sync types are: ${config.validSyncTypes.join(", ")}`,
          } as SyncResponse),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Validate required ID field
      const entityId = body[config.idFieldName];
      if (!entityId) {
        return new Response(
          JSON.stringify({
            success: false,
            platform: config.platform,
            syncType,
            message: `Missing required field: ${config.idFieldName}`,
            error: `The ${config.idFieldName} field is required`,
          } as SyncResponse),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Validate date range if supported
      if (config.supportDateRange && body.dateRange) {
        const dateValidation = validateDateRange(body.dateRange);
        if (!dateValidation.valid) {
          return new Response(
            JSON.stringify({
              success: false,
              platform: config.platform,
              syncType,
              message: "Invalid date range",
              error: dateValidation.error,
            } as SyncResponse),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }

      // Manual HTTP-triggered syncs are disabled
      return new Response(
        JSON.stringify({
          success: false,
          platform: config.platform,
          syncType,
          message: "Manual sync is disabled; syncs run automatically.",
          error: "manual_sync_disabled",
          alreadyRunning: false,
        } as SyncResponse),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    } catch (error) {
      console.error(`[${config.platform} Sync HTTP] Error:`, error);

      return new Response(
        JSON.stringify({
          success: false,
          platform: config.platform,
          syncType: "",
          message: "Internal server error",
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        } as SyncResponse),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
        },
      );
    }
  });
}

/**
 * Shopify sync endpoint
 */
export const syncShopify = createSyncHandler({
  platform: "Shopify",
  validSyncTypes: ["full", "incremental", "orders", "products", "historical"],
  defaultSyncType: "full",
  idFieldName: "storeId",
  requireAuth: false, // Shopify uses webhook verification instead
});

/**
 * Meta sync endpoint
 */
export const syncMeta = createSyncHandler({
  platform: "Meta",
  validSyncTypes: ["full", "incremental", "campaigns", "insights"],
  defaultSyncType: "incremental",
  idFieldName: "adAccountId",
  requireAuth: true,
  supportDateRange: true,
});

/**
 * Google sync endpoint
 */
export const syncGoogle = createSyncHandler({
  platform: "Google",
  validSyncTypes: ["full", "incremental", "campaigns", "insights"],
  defaultSyncType: "incremental",
  idFieldName: "customerAccountId",
  requireAuth: true,
  supportDateRange: true,
});
