import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/libs/logging/Logger";
import { getShopifySession } from "@/libs/shopify/sessionManager";
import shopify from "@/libs/shopify/shopify";
import { genRequestId, tagFromToken } from "@/libs/logging/trace";

const logger = createLogger("Billing.Subscriptions");

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return NextResponse.json(
        { error: "Missing shop parameter" },
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

    // Minimal logging; avoid shop domain in logs

    // Get real session from database
    const session = await getShopifySession(sanitizedShop);

    if (!session) {
      return NextResponse.json(
        { error: "No valid Shopify session found for shop" },
        { status: 404 },
      );
    }

    const subscriptions = await shopify.billing.subscriptions({
      session,
    });

    // Avoid logging subscription payloads

    const res = NextResponse.json({
      success: true,
      subscriptions,
      shop,
    });
    res.headers.set("X-Request-Id", requestId);
    if (userTag) res.headers.set("X-User-Tag", userTag);
    return res;
  } catch (error) {
    const requestId = genRequestId(req);
    logger.error("Error fetching subscriptions", error as Error, { requestId });
    const res = NextResponse.json(
      { error: "Failed to fetch subscriptions", requestId },
      { status: 500 },
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
