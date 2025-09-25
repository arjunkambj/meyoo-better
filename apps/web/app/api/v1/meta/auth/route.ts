import type { NextRequest } from "next/server";
import { createOAuthHandler } from "@/libs/api/createOAuthHandler";
import { META_CONFIG } from "@/config/integrations/meta.config";
import { requireEnv } from "@/libs/env";

export const runtime = "nodejs";

const META_APP_ID = requireEnv("META_APP_ID");
const NEXT_PUBLIC_APP_URL = requireEnv("NEXT_PUBLIC_APP_URL");

export const GET = createOAuthHandler({
  platform: "Meta",
  // Read-only access to ad accounts, campaigns/ads/insights + businesses list
  scope: ["ads_read", "business_management"],
  authorizationUrl: `https://www.facebook.com/${META_CONFIG.API_VERSION}/dialog/oauth`,
  clientId: META_APP_ID,
  redirectUri: (req: NextRequest) => {
    const envBase = NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const base = envBase || origin;
    return `${base}/api/v1/meta/callback`;
  },
  additionalParams: {
    response_type: "code",
  },
});
