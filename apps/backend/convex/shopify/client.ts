import { ShopifyGraphQLClient } from "../../libs/shopify/ShopifyGraphQLClient";

import type { ShopifyStoreLike } from "./types";

export async function initializeShopifyClient(
  store: ShopifyStoreLike,
): Promise<ShopifyGraphQLClient> {
  return new ShopifyGraphQLClient({
    shopDomain: store.shopDomain,
    accessToken: store.accessToken,
    apiVersion: store.apiVersion,
  });
}
