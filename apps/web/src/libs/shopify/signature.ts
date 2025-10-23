import crypto from "node:crypto";

import { requireEnv } from "@/libs/env";

import { normalizeShopDomain } from "./domain";

const SHOPIFY_API_SECRET = requireEnv("SHOPIFY_API_SECRET");

/**
 * Generate the provisioning signature used to authenticate internal Shopify actions.
 */
export function createShopProvisionSignature(shopDomain: string, nonce: string): string {
  const canonicalDomain = normalizeShopDomain(shopDomain);

  return crypto.createHmac("sha256", SHOPIFY_API_SECRET).update(`${canonicalDomain}:${nonce}`).digest("hex");
}
