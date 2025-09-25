import type { Session } from "@shopify/shopify-api";
import {
  getCriticalWebhookTopics,
  SHOPIFY_CONFIG,
} from "../../config/integrations/shopify.config";
import { createLogger } from "../../libs/logging";
import { optionalEnv, requireEnv } from "../env";
import shopify from "./shopify";

const logger = createLogger("webhook-register");
const IS_DEBUG_MODE = optionalEnv("SHOPIFY_WEBHOOK_DEBUG") === "1";
const NEXT_PUBLIC_CONVEX_SITE_URL = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");

export type WebhookRegistrationResult = {
  success: boolean;
  successfulTopics: string[];
  failedTopics: { topic: string; error: string }[];
  callbackUrl: string;
};

export async function registerWebhooks(
  session: Session,
  maxRetries: number = 3,
): Promise<WebhookRegistrationResult> {
  const isDebugMode = IS_DEBUG_MODE;
  if (isDebugMode) {
    logger.info(
      `[Webhook Registration] Starting webhook registration for shop: ${session.shop}`,
    );
  }

  try {
    // Map lowercase webhook topics to GraphQL format
    const webhookTopicMapping: Record<string, string> = {
      "app/uninstalled": "APP_UNINSTALLED",
      // Billing
      "app_subscriptions/update": "APP_SUBSCRIPTIONS_UPDATE",
      // Not all API versions allow these to be created; included defensively
      "app_subscriptions/cancelled": "APP_SUBSCRIPTIONS_CANCELLED",
      "app_subscriptions/approaching_capped_amount":
        "APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT",
      "app_subscription_billing_attempts/success":
        "APP_SUBSCRIPTION_BILLING_ATTEMPTS_SUCCESS",
      "app_subscription_billing_attempts/failure":
        "APP_SUBSCRIPTION_BILLING_ATTEMPTS_FAILURE",
      "products/create": "PRODUCTS_CREATE",
      "products/update": "PRODUCTS_UPDATE",
      "products/delete": "PRODUCTS_DELETE",
      // Customers
      "customers/create": "CUSTOMERS_CREATE",
      "customers/update": "CUSTOMERS_UPDATE",
      "customers/delete": "CUSTOMERS_DELETE",
      "customers/enable": "CUSTOMERS_ENABLE",
      "customers/disable": "CUSTOMERS_DISABLE",
      "inventory_levels/update": "INVENTORY_LEVELS_UPDATE",
      // Inventory items
      "inventory_items/create": "INVENTORY_ITEMS_CREATE",
      "inventory_items/update": "INVENTORY_ITEMS_UPDATE",
      "inventory_items/delete": "INVENTORY_ITEMS_DELETE",
      "orders/create": "ORDERS_CREATE",
      "orders/updated": "ORDERS_UPDATED",
      "orders/paid": "ORDERS_PAID",
      "orders/cancelled": "ORDERS_CANCELLED",
      "orders/fulfilled": "ORDERS_FULFILLED",
      "orders/partially_fulfilled": "ORDERS_PARTIALLY_FULFILLED",
      "orders/edited": "ORDERS_EDITED",
      "orders/delete": "ORDERS_DELETE",
      "order_transactions/create": "ORDER_TRANSACTIONS_CREATE",
      "refunds/create": "REFUNDS_CREATE",
      "fulfillments/create": "FULFILLMENTS_CREATE",
      "fulfillments/update": "FULFILLMENTS_UPDATE",
      // Shop + collections
      "shop/update": "SHOP_UPDATE",
      "collections/create": "COLLECTIONS_CREATE",
      "collections/update": "COLLECTIONS_UPDATE",
      "collections/delete": "COLLECTIONS_DELETE",
    };

    // Minimal scope requirements per topic (lowercase REST-style key)
    // If a topic is missing required scopes, we skip registering it to avoid userErrors.
    const requiredScopesByTopic: Record<string, string[]> = {
      // Products
      "products/create": ["read_products"],
      "products/update": ["read_products"],
      "products/delete": ["read_products"],
      // Customers
      "customers/create": ["read_customers"],
      "customers/update": ["read_customers"],
      "customers/delete": ["read_customers"],
      "customers/enable": ["read_customers"],
      "customers/disable": ["read_customers"],
      // Orders
      "orders/create": ["read_orders"],
      "orders/updated": ["read_orders"],
      "orders/paid": ["read_orders"],
      "orders/cancelled": ["read_orders"],
      "orders/fulfilled": ["read_orders"],
      "orders/partially_fulfilled": ["read_orders"],
      "orders/edited": ["read_orders"],
      "orders/delete": ["read_orders"],
      "order_transactions/create": ["read_orders"],
      "refunds/create": ["read_orders"],
      // Inventory
      "inventory_levels/update": ["read_inventory"],
      "inventory_items/create": ["read_inventory"],
      "inventory_items/update": ["read_inventory"],
      "inventory_items/delete": ["read_inventory"],
      // Fulfillments
      "fulfillments/create": ["read_fulfillments"],
      "fulfillments/update": ["read_fulfillments"],
      // Collections
      "collections/create": ["read_products"],
      "collections/update": ["read_products"],
      "collections/delete": ["read_products"],
      // Shop + billing generally require no additional scopes
      // "shop/update": [],
      // "app_subscriptions/update": [],
    };

    // Get webhook topics from configuration
    const topicsToRegister = [
      SHOPIFY_CONFIG.WEBHOOKS.APP_UNINSTALLED,
      // Billing (canonical)
      SHOPIFY_CONFIG.WEBHOOKS.APP_SUBSCRIPTIONS_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.PRODUCT_CREATE,
      SHOPIFY_CONFIG.WEBHOOKS.PRODUCT_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.PRODUCT_DELETE,
      SHOPIFY_CONFIG.WEBHOOKS.CUSTOMER_CREATE,
      SHOPIFY_CONFIG.WEBHOOKS.CUSTOMER_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.CUSTOMER_DELETE,
      SHOPIFY_CONFIG.WEBHOOKS.CUSTOMER_ENABLE,
      SHOPIFY_CONFIG.WEBHOOKS.CUSTOMER_DISABLE,
      SHOPIFY_CONFIG.WEBHOOKS.INVENTORY_LEVELS_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.INVENTORY_ITEMS_CREATE,
      SHOPIFY_CONFIG.WEBHOOKS.INVENTORY_ITEMS_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.INVENTORY_ITEMS_DELETE,
      SHOPIFY_CONFIG.WEBHOOKS.ORDER_CREATE,
      SHOPIFY_CONFIG.WEBHOOKS.ORDER_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.ORDER_PAID,
      SHOPIFY_CONFIG.WEBHOOKS.ORDER_CANCELLED,
      SHOPIFY_CONFIG.WEBHOOKS.ORDER_FULFILLED,
      SHOPIFY_CONFIG.WEBHOOKS.ORDER_PARTIALLY_FULFILLED,
      "orders/edited",
      "orders/delete",
      "order_transactions/create",
      "refunds/create",
      SHOPIFY_CONFIG.WEBHOOKS.FULFILLMENT_CREATE,
      SHOPIFY_CONFIG.WEBHOOKS.FULFILLMENT_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.SHOP_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.COLLECTION_CREATE,
      SHOPIFY_CONFIG.WEBHOOKS.COLLECTION_UPDATE,
      SHOPIFY_CONFIG.WEBHOOKS.COLLECTION_DELETE,
    ];

    // Build callback URL using only NEXT_PUBLIC_CONVEX_SITE_URL
    const baseUrl = NEXT_PUBLIC_CONVEX_SITE_URL.trim().replace(/\/$/, "");
    if (!baseUrl) {
      throw new Error(
        "NEXT_PUBLIC_CONVEX_SITE_URL is required for webhook registration",
      );
    }
    const callbackUrl = `${baseUrl}/webhook/shopify`;

    if (!/^https?:\/\//i.test(callbackUrl)) {
      throw new Error(
        `[Webhook Registration] Invalid callback URL constructed: ${callbackUrl}`,
      );
    }

    if (isDebugMode) {
      logger.info(`[Webhook Registration] Callback URL: ${callbackUrl}`);
    }

    // Resolve granted scopes from current OAuth session
    const scopeString = (session as any)?.scope || session.scope || "";
    const grantedScopes = new Set(
      String(scopeString)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );

    // Normalize scopes: if write permission is granted, consider read permission as granted too
    // This handles Shopify's scope behavior where write_products should include read_products
    if (grantedScopes.has('write_products')) {
      grantedScopes.add('read_products');
    }
    if (grantedScopes.has('write_orders')) {
      grantedScopes.add('read_orders');
    }
    if (grantedScopes.has('write_customers')) {
      grantedScopes.add('read_customers');
    }
    if (grantedScopes.has('write_inventory')) {
      grantedScopes.add('read_inventory');
    }
    if (grantedScopes.has('write_fulfillments')) {
      grantedScopes.add('read_fulfillments');
    }

    // Log scope information for debugging
    if (isDebugMode) {
      logger.info(
        `[Webhook Registration] Session scopes: ${Array.from(grantedScopes).join(", ")}`,
      );
      logger.info(
        `[Webhook Registration] Raw scope string from session: "${scopeString}"`,
      );
    }

    // Filter topics by required scopes to avoid futile registration attempts
    const missingScopeTopics: { topic: string; missing: string[] }[] = [];
    const eligibleTopics = topicsToRegister.filter((topic) => {
      const needs = requiredScopesByTopic[topic] || [];
      const missing = needs.filter((s) => !grantedScopes.has(s));
      if (missing.length > 0) {
        missingScopeTopics.push({ topic, missing });
        return false;
      }
      return true;
    });

    if (missingScopeTopics.length > 0) {
      // Summarize distinct missing scopes
      const distinctMissing = Array.from(
        new Set(missingScopeTopics.flatMap((t) => t.missing)),
      ).sort();
      logger.warn(
        `[Webhook Registration] Skipping ${missingScopeTopics.length} topics due to missing scopes: ${distinctMissing.join(", ")}`,
      );
      logger.warn(
        `[Webhook Registration] To fix: Add these scopes to SHOPIFY_SCOPES environment variable and reinstall the app`,
      );
      // Only emit per-topic details in debug mode
      if (isDebugMode) {
        missingScopeTopics.forEach(({ topic, missing }) =>
          logger.warn(
            `[Webhook Registration] Skipped ${topic}: requires ${missing.join(", ")}`,
          ),
        );
        logger.info(
          `[Webhook Registration] Current granted scopes: ${Array.from(grantedScopes).join(", ")}`,
        );
      }
    }

    // Helper function to register a single webhook with retry
    const registerWebhookWithRetry = async (
      lowercaseTopic: string,
      attempts: number = 0,
    ): Promise<{ success: boolean; topic?: string; error?: string }> => {
      const isDebugMode = IS_DEBUG_MODE;
      const graphqlTopic = webhookTopicMapping[lowercaseTopic];

      if (!graphqlTopic) {
        logger.error(
          `[Webhook Registration] No GraphQL mapping for topic: ${lowercaseTopic}`,
        );

        return { success: false, topic: lowercaseTopic, error: "No mapping" };
      }

      try {
        const client = new shopify.clients.Graphql({ session });

        const mutation = `
          mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              webhookSubscription {
                id
                topic
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        if (isDebugMode) {
          logger.info(
            `[Webhook Registration] Registering webhook: ${lowercaseTopic} (GraphQL: ${graphqlTopic}) - Attempt ${attempts + 1}/${maxRetries}`,
          );
        }

        const response = await client.request(mutation, {
          variables: {
            topic: graphqlTopic,
            webhookSubscription: {
              callbackUrl,
              format: "JSON",
            },
          },
        });

        const result = response.data?.webhookSubscriptionCreate;

        if (result?.userErrors?.length > 0) {
          // Check if webhook already exists
          const alreadyExists = result.userErrors.some(
            (err: { message?: string }) =>
              err.message?.toLowerCase().includes("already exists"),
          );

          if (alreadyExists) {
            if (isDebugMode) {
              logger.info(
                `[Webhook Registration] ✅ Webhook already exists: ${lowercaseTopic}`,
              );
            }
            return {
              success: true,
              topic: lowercaseTopic,
            };
          }

          // Retry if not at max attempts
          if (attempts < maxRetries - 1) {
            const delay = 2 ** attempts * 1000; // Exponential backoff

            logger.warn(
              `[Webhook Registration] Retrying webhook ${lowercaseTopic} after ${delay}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));

            return registerWebhookWithRetry(lowercaseTopic, attempts + 1);
          }

          logger.error(
            `[Webhook Registration] ❌ Failed to register webhook ${lowercaseTopic} after ${maxRetries} attempts:`,
            undefined,
            { userErrors: result.userErrors },
          );

          return {
            success: false,
            topic: lowercaseTopic,
            error: JSON.stringify(result.userErrors),
          };
        }

        if (isDebugMode) {
          logger.info(
            `[Webhook Registration] ✅ Successfully registered webhook: ${lowercaseTopic} (ID: ${result?.webhookSubscription?.id})`,
          );
        }

        return {
          success: true,
          topic: lowercaseTopic,
        };
      } catch (error) {
        // Retry on network errors
        if (attempts < maxRetries - 1) {
          const delay = 2 ** attempts * 1000;

          logger.warn(
            `[Webhook Registration] Network error for ${lowercaseTopic}, retrying after ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));

          return registerWebhookWithRetry(lowercaseTopic, attempts + 1);
        }

        logger.error(
          `[Webhook Registration] ❌ Exception registering webhook ${lowercaseTopic} after ${maxRetries} attempts:`,
          error instanceof Error ? error : undefined,
          error instanceof Error ? undefined : { error },
        );

        return {
          success: false,
          topic: lowercaseTopic,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    // Register all webhooks with retry logic
    const results = await Promise.allSettled(
      eligibleTopics.map((topic) => registerWebhookWithRetry(topic)),
    );

    // Log summary
    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;
    const failed = results.length - successful;

    // Always log summary for visibility
    if (failed > 0) {
      logger.warn(
        `[Webhook Registration] Summary: ${successful} successful, ${failed} failed out of ${results.length} total`,
      );
    } else if (isDebugMode) {
      logger.info(
        `[Webhook Registration] Summary: ${successful} successful, ${failed} failed out of ${results.length} total`,
      );
    }

    // Build detailed results and log
    const successfulTopics: string[] = [];
    const failedTopics: { topic: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error(
          `[Webhook Registration] Promise rejected for webhook ${index}:`,
          result.reason instanceof Error ? result.reason : undefined,
          result.reason instanceof Error ? undefined : { reason: result.reason },
        );
        failedTopics.push({
          topic: eligibleTopics[index]!,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      } else if (!result.value.success) {
        logger.error(
          `[Webhook Registration] Failed webhook details:`,
          undefined,
          result.value,
        );
        failedTopics.push({
          topic: result.value.topic || eligibleTopics[index]!,
          error: result.value.error || "unknown",
        });
      } else if (result.value.success) {
        successfulTopics.push(result.value.topic || eligibleTopics[index]!);
      }
    });

    if (isDebugMode) {
      logger.info(
        `[Webhook Registration] Webhook registration completed for shop: ${session.shop}`,
      );
    }

    // Determine success based on critical topics. If a critical topic was
    // skipped due to missing scopes, we surface failure so the installer
    // can address scopes and reinstall.
    const critical = new Set(getCriticalWebhookTopics());
    const criticalSkipped = missingScopeTopics
      .map((t) => t.topic)
      .filter((t) => critical.has(t));
    // All critical topics must be successfully registered
    const allCriticalPresent = Array.from(critical).every((t) =>
      successfulTopics.includes(t),
    );

    if (criticalSkipped.length > 0) {
      // Always warn about critical missing scopes
      const criticalMissingScopes = Array.from(
        new Set(
          missingScopeTopics
            .filter((t) => critical.has(t.topic))
            .flatMap((t) => t.missing)
        )
      ).sort();
      
      logger.warn(
        `[Webhook Registration] Missing scopes for critical topics: ${criticalSkipped.join(", ")}`,
      );
      logger.warn(
        `[Webhook Registration] Required scopes not granted: ${criticalMissingScopes.join(", ")}`,
      );
      logger.warn(
        `[Webhook Registration] Action required: Update SHOPIFY_SCOPES environment variable and reinstall the app`,
      );
    }

    return {
      success: allCriticalPresent && criticalSkipped.length === 0 && failedTopics.length === 0,
      successfulTopics,
      failedTopics,
      callbackUrl,
    };
  } catch (error) {
    logger.error(
      "[Webhook Registration] Failed to register webhooks:",
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );
    return {
      success: false,
      successfulTopics: [],
      failedTopics: [
        {
          topic: "*",
          error: error instanceof Error ? error.message : String(error),
        },
      ],
      callbackUrl: "",
    };
  }
}

export async function unregisterWebhooks(
  shopDomain: string,
  accessToken: string,
) {
  logger.info(
    `[Webhook Unregistration] Starting webhook unregistration for shop: ${shopDomain}`,
  );

  try {
    const client = new shopify.clients.Graphql({
      session: {
        shop: shopDomain,
        accessToken: accessToken,
      } as Session,
    });

    // First, list all existing webhooks
    const listQuery = `
      query {
        webhookSubscriptions(first: 100) {
          edges {
            node {
              id
              topic
              callbackUrl
            }
          }
        }
      }
    `;

    const listResponse = await client.request(listQuery);

    const webhooks = listResponse.data?.webhookSubscriptions?.edges || [];

    if (webhooks.length === 0) {
      logger.info("[Webhook Unregistration] No webhooks found to unregister");

      return { success: true, deletedCount: 0 };
    }

    logger.info(
      `[Webhook Unregistration] Found ${webhooks.length} webhooks to unregister`,
    );

    // Delete each webhook
    const deleteResults = await Promise.allSettled(
      webhooks.map(
        async ({ node }: { node: { id: string; topic: string } }) => {
          try {
            const deleteQuery = `
            mutation webhookSubscriptionDelete($id: ID!) {
              webhookSubscriptionDelete(id: $id) {
                userErrors {
                  field
                  message
                }
                deletedWebhookSubscriptionId
              }
            }
          `;

            const response = await client.request(deleteQuery, {
              variables: { id: node.id },
            });

            const result = response.data?.webhookSubscriptionDelete;

            if (result?.userErrors?.length > 0) {
              logger.error(
                `[Webhook Unregistration] Failed to delete webhook ${node.topic}:`,
                undefined,
                { userErrors: result.userErrors },
              );

              return { success: false, id: node.id, topic: node.topic };
            }

            logger.info(
              `[Webhook Unregistration] ✅ Successfully deleted webhook: ${node.topic}`,
            );

            return { success: true, id: node.id, topic: node.topic };
          } catch (error) {
            logger.error(
              `[Webhook Unregistration] Exception deleting webhook ${node.topic}:`,
              error instanceof Error ? error : undefined,
              error instanceof Error ? undefined : { error },
            );

            return { success: false, id: node.id, topic: node.topic, error };
          }
        },
      ),
    );

    const successful = deleteResults.filter(
      (r: PromiseSettledResult<{ success: boolean }>) =>
        r.status === "fulfilled" && r.value.success,
    ).length;

    logger.info(
      `[Webhook Unregistration] Summary: ${successful} successful, ${deleteResults.length - successful} failed out of ${deleteResults.length} total`,
    );

    return {
      success: successful === deleteResults.length,
      deletedCount: successful,
      totalCount: deleteResults.length,
    };
  } catch (error) {
    logger.error(
      `[Webhook Unregistration] Fatal error:`,
      error instanceof Error ? error : undefined,
      error instanceof Error ? undefined : { error },
    );
    throw error;
  }
}
