import { createSimpleLogger } from "../../libs/logging/simple";

const logger = createSimpleLogger("MetaTokens");

const GRAPH_VERSION = process.env.META_API_VERSION || "v21.0";
const GRAPH_BASE = process.env.META_BASE_URL || "https://graph.facebook.com";

export interface MetaTokenExchangeResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number; // seconds
}

/**
 * Exchange a (short or existing long) user token for a long‑lived token.
 * Meta requires app credentials for fb_exchange_token grant.
 */
export async function exchangeForLongLivedUserToken(
  currentAccessToken: string,
): Promise<MetaTokenExchangeResponse> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Missing META_APP_ID or META_APP_SECRET");
  }

  const url = new URL(`${GRAPH_BASE}/${GRAPH_VERSION}/oauth/access_token`);

  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentAccessToken);

  const res = await fetch(url.toString(), { method: "GET" });

  if (!res.ok) {
    const text = await res.text();
    logger.error("Meta token exchange failed", new Error(text));
    throw new Error(`Meta token exchange failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as MetaTokenExchangeResponse;
  logger.info("Exchanged Meta token", {
    hasToken: !!data.access_token,
    expiresIn: data.expires_in,
  });
  return data;
}

/**
 * Optional debug endpoint to inspect token validity and expiry.
 * Requires an app access token in the form APP_ID|APP_SECRET.
 */
export async function debugToken(inputToken: string): Promise<any> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Missing META_APP_ID or META_APP_SECRET");
  }
  const appAccessToken = `${appId}|${appSecret}`;

  const url = new URL(`${GRAPH_BASE}/${GRAPH_VERSION}/debug_token`);
  url.searchParams.set("input_token", inputToken);
  url.searchParams.set("access_token", appAccessToken);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    logger.warn("Meta token debug failed", { status: res.status, text });
    throw new Error(`Meta token debug failed: ${res.status}`);
  }
  return res.json();
}
