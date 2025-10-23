import crypto from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Generate or propagate a request id for traceability.
 * Prefers incoming `x-request-id` header, otherwise generates a short id.
 */
export function genRequestId(req: NextRequest | Request): string {
  // Try common incoming headers first
  const headers = req.headers;
  const fromHeader =
    headers.get?.("x-request-id") ||
    headers.get?.("x-cf-ray") ||
    headers.get?.("cf-ray") ||
    headers.get?.("fly-request-id") ||
    null;
  if (fromHeader) return String(fromHeader);

  // Fallback: timestamp + random suffix
  const suffix = crypto.randomBytes(4).toString("hex");
  return `rid_${Date.now()}_${suffix}`;
}

/**
 * Create a stable, non‑PII user tag from a token.
 * Produces an 8-char hex prefix of SHA256(token).
 */
export function tagFromToken(token?: string | null): string | undefined {
  if (!token) return undefined;
  try {
    return crypto.createHash("sha256").update(token).digest("hex").slice(0, 8);
  } catch {
    return undefined;
  }
}
