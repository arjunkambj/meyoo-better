import { TiersEnum } from "@/components/home/pricing/types";

export const SHOPIFY_PLAN_NAME_BY_TIER_KEY: Record<TiersEnum, string> = {
  [TiersEnum.Free]: "Free Plan",
  [TiersEnum.Pro]: "Starter Plan",
  [TiersEnum.Team]: "Growth Plan",
  [TiersEnum.Custom]: "Business Plan",
  [TiersEnum.Enterprise]: "Enterprise Plan",
};

const normalizedEntries = Object.entries(SHOPIFY_PLAN_NAME_BY_TIER_KEY).map(
  ([tierKey, name]) => [tierKey as TiersEnum, name.toLowerCase()] as const
);

export const getTierKeyFromPlanName = (
  planName: string | null | undefined
): TiersEnum | null => {
  if (!planName) return null;

  const normalized = planName.trim().toLowerCase();

  const directMatch = normalizedEntries.find(([, name]) => name === normalized);
  if (directMatch) {
    return directMatch[0];
  }

  if (normalized.includes("enterprise")) return TiersEnum.Enterprise;
  if (normalized.includes("business") || normalized.includes("custom")) {
    return TiersEnum.Custom;
  }
  if (normalized.includes("growth")) return TiersEnum.Team;
  if (normalized.includes("starter") || normalized.includes("pro")) {
    return TiersEnum.Pro;
  }
  if (normalized.includes("free")) return TiersEnum.Free;

  return null;
};
