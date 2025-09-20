import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/libs/logging/Logger";
import { getShopifySession } from "@/libs/shopify/sessionManager";
import shopify from "@/libs/shopify/shopify";
import { genRequestId, tagFromToken } from "@/libs/logging/trace";

const logger = createLogger("Billing.Cancel");

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
    const {
      shop,
      subscriptionId,
      prorate = true,
    } = body as {
      shop?: string;
      subscriptionId?: string;
      prorate?: boolean;
    };

    if (!shop || !subscriptionId) {
      return NextResponse.json(
        { error: "Missing shop or subscriptionId parameter" },
        { status: 400 },
      );
    }

    const sanitizedShop = shopify.utils.sanitizeShop(shop, true);
    if (!sanitizedShop) {
      return NextResponse.json(
        { error: "Invalid shop domain" },
        { status: 400 },
      );
    }

    // Minimal logging for cancel action

    // Get real session from database
    const session = await getShopifySession(sanitizedShop);

    if (!session) {
      return NextResponse.json(
        { error: "No valid Shopify session found for shop" },
        { status: 404 },
      );
    }

    const cancelResult = await shopify.billing.cancel({
      session,
      subscriptionId,
      prorate,
    });

    // Avoid logging response payloads

    const res = NextResponse.json({
      success: true,
      cancelledSubscription: cancelResult,
    });
    res.headers.set("X-Request-Id", requestId);
    if (userTag) res.headers.set("X-User-Tag", userTag);
    return res;
  } catch (error) {
    const requestId = genRequestId(req);
    logger.error("Error cancelling subscription", error as Error, { requestId });
    const res = NextResponse.json(
      { error: "Failed to cancel subscription", requestId },
      { status: 500 },
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
