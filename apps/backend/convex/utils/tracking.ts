import { internalAction } from "../_generated/server";
import { v } from "convex/values";

type TrackingPayload = {
  type: string;
  eventType: string;
  source: string;
  referral: string | null;
  slug: string | null;
  customerId: string | null;
  email: string | null;
  organizationId: string | null;
  plan: string | null;
  planKey: string | null;
  billingCycle: string | null;
  billingId: string | null;
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
    console.warn("Tracking event delivery failed", error);
    return { ok: false };
  }
};

export const emitTrackingEvent = internalAction({
  args: {
    eventType: v.string(),
    type: v.optional(v.string()),
    source: v.optional(v.string()),
    userId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    referral: v.optional(v.string()),
    slug: v.optional(v.string()),
    plan: v.optional(v.string()),
    planKey: v.optional(v.string()),
    billingCycle: v.optional(v.string()),
    billingId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    isUpgrade: v.optional(v.boolean()),
    becamePaid: v.optional(v.boolean()),
    previousPlan: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const metadataEntries = [
      ["subscriptionId", args.subscriptionId],
      ["subscriptionStatus", args.subscriptionStatus],
      ["isUpgrade", args.isUpgrade],
      ["becamePaid", args.becamePaid],
      ["previousPlan", args.previousPlan],
    ].filter(([, value]) => value !== undefined && value !== null);

    const metadata =
      metadataEntries.length > 0
        ? Object.fromEntries(metadataEntries)
        : undefined;

    const result = await sendTrackingEvent({
      type: args.type ?? args.eventType,
      eventType: args.eventType,
      source: args.source ?? "convex",
      referral: args.referral ?? null,
      slug: args.slug ?? args.referral ?? null,
      customerId: args.userId ?? null,
      email: args.customerEmail ?? null,
      organizationId: args.organizationId ?? null,
      plan: args.plan ?? null,
      planKey: args.planKey ?? null,
      billingCycle: args.billingCycle ?? null,
      billingId: args.billingId ?? args.subscriptionId ?? null,
      metadata,
    });

    return result;
  },
});
