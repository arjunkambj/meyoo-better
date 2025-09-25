import { normalizeShopDomain } from './shop';
import { requireEnv } from './env';

const SHOPIFY_API_KEY = requireEnv('SHOPIFY_API_KEY');

// Timing-safe string comparison to avoid subtle equality issues
export const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
};

export const hmacHex = async (keyUtf8: string, data: string) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyUtf8),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Verify provisioning signature for Shopify app install flow
export const verifyShopProvisionSignature = async (
  shop: string,
  nonce: string,
  sig: string,
) => {
  const canonicalShop = normalizeShopDomain(shop);
  const provided = (sig || '').toLowerCase();
  const expected = (await hmacHex(SHOPIFY_API_KEY, `${canonicalShop}:${nonce}`)).toLowerCase();
  return timingSafeEqual(provided, expected);
};
