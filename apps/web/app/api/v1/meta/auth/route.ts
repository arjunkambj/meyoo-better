import type { NextRequest } from "next/server";
import { createOAuthHandler } from "@/libs/api/createOAuthHandler";
import { META_CONFIG } from "@/config/integrations/meta.config";

export const runtime = "nodejs";

export const GET = createOAuthHandler({
  platform: "Meta",
  // Read-only access to ad accounts, campaigns/ads/insights + businesses list
  scope: ["ads_read", "business_management"],
  authorizationUrl: `https://www.facebook.com/${META_CONFIG.API_VERSION}/dialog/oauth`,
  clientId: process.env.META_APP_ID || "",
  redirectUri: (req: NextRequest) => {
    const envBase = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const base = envBase || origin;
    return `${base}/api/v1/meta/callback`;
  },
  additionalParams: {
    response_type: "code",
  },
});
