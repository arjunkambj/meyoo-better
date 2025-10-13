import { ShopifyGraphQLClient } from "../../libs/shopify/ShopifyGraphQLClient";

export type ShopifyStoreLike = {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
};

export async function initializeShopifyClient(
  store: ShopifyStoreLike,
): Promise<ShopifyGraphQLClient> {
  return new ShopifyGraphQLClient({
    shopDomain: store.shopDomain,
    accessToken: store.accessToken,
    apiVersion: store.apiVersion,
  });
}
