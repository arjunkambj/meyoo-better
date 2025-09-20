import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/libs/convexApi";
import { createLogger } from "@/libs/logging/Logger";

const logger = createLogger("Meta.FetchAccounts");

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  try {
    // Get Convex auth token for the authenticated user
    const token = await convexAuthNextjsToken();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Fetch ad accounts from Meta API
    const result = await fetchAction(
      api.integrations.meta.fetchMetaAccountsAction,
      {},
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string }
    );

    if (!result.success || !result.accounts || result.accounts.length === 0) {
      logger.warn("No ad accounts found or fetch failed", {
        success: result.success,
        error: result.error,
      });
      return NextResponse.json(result);
    }

    // Store the fetched accounts
    const storeResult = await fetchMutation(
      api.integrations.meta.storeAdAccountsFromCallback,
      { accounts: result.accounts },
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string }
    );

    logger.info("Ad accounts fetched and stored", {
      count: result.accounts.length,
      stored: storeResult.stored,
    });

    return NextResponse.json({
      success: true,
      accounts: result.accounts,
      stored: storeResult.stored,
    });
  } catch (error) {
    logger.error("Failed to fetch ad accounts", error as Error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}