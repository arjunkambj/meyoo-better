import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/libs/convexApi";
import { createLogger } from "@/libs/logging/Logger";
import { createManagedPricingRedirectUrl } from "@/libs/shopify/billing";
import shopify from "@/libs/shopify/shopify";
import { genRequestId, tagFromToken } from "@/libs/logging/trace";

const logger = createLogger("Billing.Request");

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const requestId = genRequestId(req);
    // Check if user is authenticated
    const token = await convexAuthNextjsToken();
    const userTag = tagFromToken(token);

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { shop, plan, returnPath } = body as {
      shop?: string;
      plan?: string;
      returnPath?: string;
    };

    if (!shop || !plan) {
      return NextResponse.json(
        { error: "Missing shop or plan parameter" },
        { status: 400 },
      );
    }

    // Sanitize and validate shop domain
    const sanitizedShop = shopify.utils.sanitizeShop(shop, true);
    if (!sanitizedShop) {
      return NextResponse.json(
        { error: "Invalid shop domain" },
        { status: 400 },
      );
    }

    // Validate plan is one of our supported plans
    const validPlans = [
      "Free Plan",
      "Starter Plan",
      "Growth Plan",
      "Business Plan",
    ];

    if (!validPlans.includes(plan)) {
      return NextResponse.json(
        { error: `Invalid plan. Available plans: ${validPlans.join(", ")}` },
        { status: 400 },
      );
    }

    // Note: For Free Plan, we also redirect to Shopify Managed Pricing so
    // Shopify remains the source of truth for subscription state.

    // Minimal logging for billing request

    // Get organization to check trial status
    const { fetchQuery } = await import("convex/nextjs");

    // Get organization details to check trial status
    const organization = await fetchQuery(
      api.billing.organizationHelpers.getOrganizationByUser,
      {},
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
    );

    if (!organization) {
      logger.error("No organization found for user", { shop });

      return NextResponse.json(
        { error: "Organization not found. Please reconnect your store." },
        { status: 400 },
      );
    }

    // We no longer skip Shopify billing for free plan; all plans flow through Shopify.

    // For all paid plans - redirect to Shopify Managed Pricing page
    // Avoid logging shop domain

    // Create the redirect URL to Shopify's managed pricing page
    // Normalize base app URL to include scheme if missing
    const normalizeWithScheme = (value?: string) => {
      if (!value) return "";
      const trimmed = value.trim().replace(/\/$/, "");
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      const noLeadingSlashes = trimmed.replace(/^\/+/, "");
      // Default to https unless explicitly localhost
      const scheme = /^(localhost|127\.0\.0\.1)/.test(noLeadingSlashes)
        ? "http"
        : "https";
      return `${scheme}://${noLeadingSlashes}`;
    };
    const baseAppUrl = normalizeWithScheme(process.env.NEXT_PUBLIC_APP_URL);
    const safeReturnPath =
      typeof returnPath === "string" && returnPath.startsWith("/")
        ? returnPath
        : "/onboarding/marketing";
    const returnUrl = `${baseAppUrl}${safeReturnPath}?billing_completed=true&plan=${encodeURIComponent(
      plan,
    )}`;
    const confirmationUrl = createManagedPricingRedirectUrl(
      sanitizedShop,
      returnUrl,
    );

    // Note: With managed pricing, Shopify handles the subscription
    // We'll update the organization plan when the merchant returns from Shopify

    // Avoid logging redirect URLs in production logs

    const res = NextResponse.json({
      success: true,
      confirmationUrl,
      plan,
      managedPricing: true,
    });
    res.headers.set("X-Request-Id", requestId);
    if (userTag) res.headers.set("X-User-Tag", userTag);
    return res;
  } catch (error) {
    const requestId = genRequestId(req);
    logger.error("Error requesting billing charge", error as Error, { requestId });

    // Provide more specific error messages
    const errorMessage =
      error instanceof Error ? error.message : "Unknown billing error";

    // Check for common issues
    if (errorMessage.includes("Subscription creation failed")) {
      return NextResponse.json(
        {
          error:
            "Unable to create subscription. Please try again or contact support.",
        },
        { status: 400 },
      );
    }

    if (errorMessage.includes("Unknown plan")) {
      return NextResponse.json(
        { error: "Invalid plan selected. Please choose a valid plan." },
        { status: 400 },
      );
    }

    if (errorMessage.includes("No confirmation URL")) {
      return NextResponse.json(
        { error: "Billing setup failed. Please try again." },
        { status: 500 },
      );
    }

    const res = NextResponse.json(
      {
        error: "Failed to process billing request. Please try again.",
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 },
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
