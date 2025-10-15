import crypto from "node:crypto";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/libs/convexApi";
import { createLogger } from "@/libs/logging/Logger";
import shopify, { configuredScopes } from "@/libs/shopify/shopify";
import { genRequestId, tagFromToken } from "@/libs/logging/trace";
import { optionalEnv, requireEnv } from "@/libs/env";
import {
  normalizeShopDomain,
  fetchShopData,
  createAuthSignature,
  registerStoreWebhooks,
  triggerInitialSync,
  setAuthCookies,
  getRedirectUrl,
  withRetry,
} from "./helpers";

const logger = createLogger("Shopify.Callback");

export const runtime = "nodejs";
const NEXT_PUBLIC_APP_URL = requireEnv("NEXT_PUBLIC_APP_URL");
const SHOPIFY_WEBHOOK_DEBUG = optionalEnv("SHOPIFY_WEBHOOK_DEBUG") === "1";

export async function GET(req: NextRequest) {
  try {
    const requestId = genRequestId(req);

    const baseUrl = NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");

    // Process the OAuth callback from Shopify
    const response = await shopify.auth.callback({
      rawRequest: req,
    });

    const session = response.session;

    // Parse granted scopes from session
    const grantedScopes = new Set(
      (session.scope || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );

    // Normalize scopes: if write_products is granted, consider read_products as granted too
    const normalizedScopes = new Set(grantedScopes);
    if (grantedScopes.has('write_products')) {
      normalizedScopes.add('read_products');
    }
    if (grantedScopes.has('write_orders')) {
      normalizedScopes.add('read_orders');
    }

    // Check if all configured scopes are granted (using normalized set)
    const missingScopes = configuredScopes.filter(scope => !normalizedScopes.has(scope));
    
    // Only log scopes in debug mode
    if (SHOPIFY_WEBHOOK_DEBUG) {
      logger.info("Scope validation", { 
        configured: configuredScopes,
        granted: Array.from(grantedScopes),
        normalized: Array.from(normalizedScopes),
        missing: missingScopes 
      });
    }

    // If scopes are missing after normalization, the app needs to be reinstalled
    if (missingScopes.length > 0) {
      logger.warn("OAuth session missing required scopes after normalization", {
        missing: missingScopes,
        granted: Array.from(grantedScopes),
        normalized: Array.from(normalizedScopes),
        shop: session.shop
      });
      
      // For critical missing scopes, we should request a re-authorization
      const criticalMissing = missingScopes.filter(s => 
        s === 'read_products' || s === 'read_orders'
      );
      
      if (criticalMissing.length > 0 && !normalizedScopes.has('write_products') && !normalizedScopes.has('write_orders')) {
        // Only fail if we don't have the write permissions either
        logger.error("Critical scopes missing, app needs reinstallation", {
          critical: criticalMissing,
          shop: session.shop
        });
      }
    }

    // Check if user is authenticated (coming from onboarding flow)
    const token = await convexAuthNextjsToken();

    if (token) {
      // Authenticated flow: User is logged in and connecting from onboarding
      // Minimal logging (avoid shop domain)

      // Fetch shop data to get currency and other info
      const shopData = await fetchShopData(session);

      // Before connecting, check if this shop already belongs to a different organization
      const shopDomain = normalizeShopDomain(session.shop);


      try {
        const { fetchQuery } = await import("convex/nextjs");
        const currentUser = await fetchQuery(
          api.core.users.getCurrentUser,
          {},
          { token },
        );

        const existing = await fetchQuery(
          api.shopify.publicQueries.getPublicStoreByDomain,
          { shopDomain },
          { token },
        );

        if (
          existing &&
          currentUser?.organizationId &&
          existing.organizationId !== currentUser.organizationId
        ) {
          logger.warn("Shopify store already linked to another organization", {
            requestId,
          });
          const redirect = NextResponse.redirect(
            `${baseUrl}/onboarding/shopify?error=store-already-connected`,
            { status: 303 },
          );
          redirect.headers.set("X-Request-Id", requestId);
          return redirect;
        }
      } catch (_precheckError) {
        // If precheck fails, fall back to normal connect flow
        void 0;
      }

      // Normal connect (either same org or first-time connect)
      const connectionResult = await fetchMutation(
        api.core.onboarding.connectShopifyStore,
        {
          domain: session.shop,
          accessToken: session.accessToken || "",
          scope: session.scope || "",
          shopData,
        },
        {
          token,
        },
      );

      // Register webhooks for the store if not already registered
      if (connectionResult.success) {
        await registerStoreWebhooks(session, token);
      }

      // Trigger initial sync for new user if products are not present yet
      if (connectionResult.success && connectionResult.organizationId) {
        await triggerInitialSync(token, connectionResult.organizationId);
      }

      // Success logging only in debug mode
      if (SHOPIFY_WEBHOOK_DEBUG) {
        const userTag = tagFromToken(token) || "anon";
        logger.info("Shopify connected", { user: userTag, connected: true, requestId });
      }

      // Decide next step based on billing state
      const redirectUrl = await getRedirectUrl(token, session.shop);
      const res = NextResponse.redirect(redirectUrl);
      res.headers.set("X-Request-Id", requestId);
      return res;
    } else {
      // Unauthenticated flow: Install from Shopify App Store (no email claim)
      // Minimal logging for unauthenticated flow

      // Fetch shop data to help provision user/org
      const shopData = await fetchShopData(session);

      // Create or attach a user/org and connect the store
      const nonce = crypto.randomBytes(16).toString("hex");
      const shopDomain = normalizeShopDomain(session.shop);
      const sig = createAuthSignature(shopDomain, nonce);

      // Provision user/organization with retry

      const _provision = await withRetry(
        () =>
          fetchMutation(
            api.installations.createOrAttachFromShopifyOAuth,
            {
              shop: session.shop,
              accessToken: session.accessToken || "",
              scope: session.scope || "",
              shopData,
              nonce,
              sig,
            },
          ),
        "provisioning user/org",
      );

      // Set Convex Auth cookies for the newly provisioned user
      try {
        const attempt = async () =>
          await fetchAction(
            api.installations.issueTokensFromShopifyOAuth,
            { shop: session.shop, nonce, sig },
          );

        let tokens: { token: string; refreshToken: string } | null = null;
        let lastError: unknown = null;
        for (let i = 0; i < 3; i++) {
          try {
            tokens = await attempt();
            break;
          } catch (err) {
            lastError = err;
            // Exponential backoff: 200ms, 400ms
            const delay = 200 * 2 ** i;
            await new Promise((r) => setTimeout(r, delay));
          }
        }
        if (!tokens) throw lastError ?? new Error("Token issuance failed");
        // If onboarding is complete, redirect to overview, else to billing
        // Decide redirect using Convex onboarding state
        const overviewUrl = `${baseUrl}/overview`;
        const costsUrl = `${baseUrl}/onboarding/marketing`;
        const billingUrl = `${baseUrl}/onboarding/billing?shop=${encodeURIComponent(
          session.shop,
        )}`;

        let target = billingUrl;
        try {
          const { fetchQuery } = await import("convex/nextjs");
          const status = await fetchQuery(
            api.core.onboarding.getOnboardingStatus,
            {},
            {
              // Use freshly issued Convex token for accurate status
              token: tokens.token,
            },
          );

          if (status?.completed) target = overviewUrl;
          else if (status?.connections?.shopify && status?.hasShopifySubscription)
            target = costsUrl;
          else target = billingUrl;
        } catch (_) {
          // fallback stays billingUrl
        }

        const redirect = NextResponse.redirect(target);
        setAuthCookies(redirect, tokens);

        // Register webhooks if not already registered
        await registerStoreWebhooks(session);

        redirect.headers.set("X-Request-Id", requestId);
        return redirect;
      } catch (e) {
        logger.error(
          "Failed setting auth cookies after provisioning",
          e as Error,
        );
      }

      // Fallback: if cookie set fails, still redirect
      // Note: Webhook registration already handled above, no need to duplicate

      // Redirect based on onboarding (fallback path without cookies)
      const res = NextResponse.redirect(
        `${baseUrl}/onboarding/billing?shop=${encodeURIComponent(session.shop)}`,
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
  } catch (error) {
    const requestId = genRequestId(req);
    logger.error("OAuth callback error", error as Error, { requestId });
    return NextResponse.json(
      { error: "OAuth error", requestId },
      { status: 500 },
    );
  }
}
