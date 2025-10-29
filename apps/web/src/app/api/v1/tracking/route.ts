import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { api } from "@/libs/convexApi";
import { createLogger } from "@/libs/logging/Logger";
import { genRequestId, tagFromToken } from "@/libs/logging/trace";

const logger = createLogger("Tracking.Route");

export const runtime = "nodejs";

type TrackingEventType = "signup.created" | "subscription.updated";

type RequestBody = {
  eventType?: string;
  type?: string;
  context?: string;
  metadata?: Record<string, unknown>;
};

const planNameMap: Record<string, string> = {
  free: "Free Plan",
  starter: "Starter Plan",
  growth: "Growth Plan",
  business: "Business Plan",
};

const normalizePlanName = (planKey: string | null | undefined): string | null => {
  if (!planKey) return null;
  return planNameMap[planKey] ?? null;
};

type TrackingPayload = {
  type: TrackingEventType;
  source: string;
  slug: string | null;
  customerId: string | null;
  email: string | null;
  userId: string | null;
  organizationId: string | null;
  plan?: string | null;
  planKey?: string | null;
  billingCycle?: string | null;
  billingId?: string | null;
  metadata?: Record<string, unknown>;
};

type TrackingResult = {
  ok: boolean;
  status?: number;
  skipped?: boolean;
};

const resolveTrackingEndpoint = (): string | undefined => {
  const direct = process.env.TRACKING_URL;
  if (direct && direct.trim().length > 0) return direct;
  const fallback = process.env.NEXT_PUBLIC_TRACKING_URL;
  if (fallback && fallback.trim().length > 0) return fallback;
  return undefined;
};

const sendTrackingEvent = async (payload: TrackingPayload): Promise<TrackingResult> => {
  const endpoint = resolveTrackingEndpoint();
  if (!endpoint) {
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        timestamp: Date.now(),
      }),
    });

    return { ok: response.ok, status: response.status };
  } catch (error) {
    logger.warn("Tracking event delivery failed", { error });
    return { ok: false };
  }
};

export async function POST(req: NextRequest) {
  const requestId = genRequestId(req);

  try {
    const token = await convexAuthNextjsToken();
    const userTag = tagFromToken(token);

    if (!token) {
      const res = NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    const cookie = req.cookies.get("meyoo_ref");
    if (!cookie || !cookie.value) {
      const res = NextResponse.json(
        { success: false, skipped: true, reason: "missing_referral_cookie" },
        { status: 200 },
      );
      res.headers.set("X-Request-Id", requestId);
      if (userTag) res.headers.set("X-User-Tag", userTag);
      return res;
    }

    const body = ((await req.json().catch(() => ({}))) ?? {}) as RequestBody;
    const eventType = (body.type ?? body.eventType) as TrackingEventType | undefined;

    if (eventType !== "signup.created" && eventType !== "subscription.updated") {
      const res = NextResponse.json(
        { error: "Invalid or missing eventType" },
        { status: 400 },
      );
      res.headers.set("X-Request-Id", requestId);
      if (userTag) res.headers.set("X-User-Tag", userTag);
      return res;
    }

    const [user, onboarding, billingSummary] = await Promise.all([
      fetchQuery(api.core.users.getCurrentUser, {}, { token }),
      fetchQuery(api.core.onboarding.getOnboardingStatus, {}, { token }),
      fetchQuery(api.core.users.getUserBilling, {}, { token }).catch(() => null),
    ]);

    if (!user) {
      const res = NextResponse.json({ error: "User not found" }, { status: 404 });
      res.headers.set("X-Request-Id", requestId);
      if (userTag) res.headers.set("X-User-Tag", userTag);
      return res;
    }

    if (!onboarding) {
      const res = NextResponse.json(
        { success: false, skipped: true, reason: "missing_onboarding_state" },
        { status: 200 },
      );
      res.headers.set("X-Request-Id", requestId);
      if (userTag) res.headers.set("X-User-Tag", userTag);
      return res;
    }

    if (eventType === "signup.created") {
      if (onboarding.hasShopifySubscription || onboarding.completed) {
        const res = NextResponse.json(
          { success: false, skipped: true, reason: "already_subscribed" },
          { status: 200 },
        );
        res.headers.set("X-Request-Id", requestId);
        if (userTag) res.headers.set("X-User-Tag", userTag);
        return res;
      }
    }

    if (eventType === "subscription.updated") {
      if (!onboarding.hasShopifySubscription) {
        const res = NextResponse.json(
          { success: false, skipped: true, reason: "subscription_not_active" },
          { status: 200 },
        );
        res.headers.set("X-Request-Id", requestId);
        if (userTag) res.headers.set("X-User-Tag", userTag);
        return res;
      }
    }

    const planKey = billingSummary?.plan ?? null;
    const planName = normalizePlanName(planKey);
    const userId = user._id ? String(user._id) : null;
    const organizationId =
      typeof user.organizationId === "string"
        ? user.organizationId
        : user.organizationId
        ? String(user.organizationId)
        : null;
    const email = typeof user.email === "string" ? user.email : null;
    const billingCycle = billingSummary?.billingCycle ?? null;
    const billingId = billingSummary?.subscriptionId ?? null;
    const onboardingData = onboarding.onboardingData;
    let referralSource: string | undefined;

    if (
      typeof onboardingData === "object" &&
      onboardingData !== null &&
      "referralSource" in onboardingData
    ) {
      const candidate = (onboardingData as { referralSource?: unknown }).referralSource;
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        referralSource = candidate;
      }
    }

    const referralSlug = referralSource ?? cookie.value ?? null;

    const metadata =
      typeof body.metadata === "object" && body.metadata !== null
        ? body.metadata
        : undefined;

    const trackingPayload: TrackingPayload = {
      type: eventType,
      source: `web:${body.context || "onboarding"}`,
      slug: referralSlug,
      customerId: userId,
      email,
      userId,
      organizationId,
      metadata: {
        ...metadata,
        currentStep: onboarding.currentStep ?? null,
        completedSteps: onboarding.completedSteps ?? [],
        hasShopifyConnection: onboarding.connections?.shopify ?? false,
        hasShopifySubscription: onboarding.hasShopifySubscription ?? false,
        subscriptionStatus: billingSummary?.subscriptionStatus ?? null,
      },
    };

    if (eventType === "subscription.updated") {
      trackingPayload.plan = planName;
      trackingPayload.planKey = planKey ?? null;
      trackingPayload.billingCycle = billingCycle;
      trackingPayload.billingId = billingId;
    }

    const trackingResult = await sendTrackingEvent(trackingPayload);

    const res = NextResponse.json(
      {
        success: trackingResult.ok,
        skipped: trackingResult.skipped ?? false,
        status: trackingResult.status,
      },
      { status: trackingResult.ok || trackingResult.skipped ? 200 : 502 },
    );
    res.headers.set("X-Request-Id", requestId);
    if (userTag) res.headers.set("X-User-Tag", userTag);
    return res;
  } catch (error) {
    logger.error("Failed to process tracking event", error as Error, { requestId });
    const res = NextResponse.json(
      { error: "Failed to process tracking event", requestId },
      { status: 500 },
    );
    res.headers.set("X-Request-Id", requestId);
    return res;
  }
}
