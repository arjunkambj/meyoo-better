import { type NextRequest, NextResponse } from "next/server";

import shopify from "@/libs/shopify/shopify";
import { requireEnv } from "@/libs/env";

export const runtime = "nodejs";

const SHOPIFY_REDIRECT_URI = requireEnv("SHOPIFY_REDIRECT_URI");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");

    if (!shop) {
      return new NextResponse(
        JSON.stringify({ error: "Missing shop parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const sanitizedShop = shopify.utils.sanitizeShop(shop, true);

    return shopify.auth.begin({
      shop: sanitizedShop || "",
      callbackPath: SHOPIFY_REDIRECT_URI,
      isOnline: false,
      rawRequest: req,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Shopify auth error: ${error}` },
      { status: 500 },
    );
  }
}

