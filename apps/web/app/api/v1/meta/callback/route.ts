import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import axios from "axios";
import { genRequestId, tagFromToken } from "@/libs/logging/trace";
import { fetchMutation } from "convex/nextjs";
import { type NextRequest, NextResponse } from "next/server";

import { api } from "@/libs/convexApi";
import { META_CONFIG } from "@/config/integrations/meta.config";
import { createLogger } from "@/libs/logging/Logger";

const logger = createLogger("Meta.Callback");

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const requestId = genRequestId(req);
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      logger.warn("Meta OAuth error", { error, requestId });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/marketing?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      logger.error("Missing required Meta OAuth parameters");

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/marketing?error=missing_parameters`,
      );
    }

    // Get Convex auth token for the authenticated user
    const token = await convexAuthNextjsToken();
    const userTag = tagFromToken(token) || "anon";

    if (!token) {
      // Only log in debug mode
      if (process.env.META_DEBUG === "1") {
        logger.info("No authenticated user, redirecting to signin");
      }

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/signin?returnUrl=${encodeURIComponent("/onboarding/marketing")}`,
      );
    }

    const clientId = process.env.META_APP_ID || "";
    const clientSecret = process.env.META_APP_SECRET || "";
    const envBase = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const baseUrl = envBase || origin;
    const redirectUri = `${baseUrl}/api/v1/meta/callback`;

    // Exchange code for access token
    const tokenUrl = new URL(
      `https://graph.facebook.com/${META_CONFIG.API_VERSION}/oauth/access_token`,
    );

    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await axios.get(tokenUrl.toString());

    // Avoid verbose token logs in production

    const accessToken = tokenResponse.data.access_token;
    // const expiresIn = tokenResponse.data.expires_in || 3600;

    if (!accessToken) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/marketing?error=no_access_token`,
      );
    }

    // Get user info to get the user ID
    const userInfoRes = await fetch(
      `https://graph.facebook.com/${META_CONFIG.API_VERSION}/me?access_token=${accessToken}`,
    );
    const userInfo = await userInfoRes.json();

    // Store Meta connection in Convex
    await fetchMutation(
      api.integrations.meta.connectMeta,
      {
        accessToken: accessToken,
        refreshToken: tokenResponse.data.refresh_token,
        expiresIn: tokenResponse.data.expires_in,
        scope: tokenResponse.data.scope,
        userId: userInfo.id || "",
        userName: userInfo.name || "Meta Account",
      },
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
    );

    // Fetch and store ad accounts immediately after connection
    try {
      const fetchResult = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/meta/fetch-accounts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: req.headers.get("cookie") || "",
          },
        },
      );

      if (!fetchResult.ok) {
        logger.warn("Failed to fetch ad accounts after connection", {
          status: fetchResult.status,
          requestId,
        });
      }
    } catch (error) {
      logger.warn("Error fetching ad accounts", { error, requestId });
    }

    // Only log success in debug mode
    if (process.env.META_DEBUG === "1") {
      logger.info("Meta connected", { user: userTag, connected: true });
    }

    // Redirect back to marketing step with success indicator
    const res = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/marketing?meta_connected=true`,
    );
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("X-User-Tag", userTag);
    return res;
  } catch (error) {
    const requestId = genRequestId(req);
    logger.error("Meta callback error", error as Error, { requestId });
    const res = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/marketing?error=callback_error&rid=${encodeURIComponent(requestId)}`,
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
