import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { DashboardConfig } from "@repo/types";
import { DEFAULT_DASHBOARD_CONFIG } from "@repo/types";

type DashboardDoc = Doc<"dashboards">;

type LegacyConfig =
  | {
      zone1?: string[];
      zone2?: string[];
    }
  | undefined
  | null;

type StoredConfig = DashboardDoc["config"] | LegacyConfig;

const sanitizeStringList = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filtered = value.filter((item): item is string => typeof item === "string" && item.length > 0);

  if (filtered.length === 0) {
    return fallback;
  }

  return filtered;
};

export const normalizeDashboardConfig = (config: StoredConfig): DashboardConfig => {
  if (!config) {
    return DEFAULT_DASHBOARD_CONFIG;
  }

  if (
    typeof config === "object" &&
    config !== null &&
    ("zone1" in config || "zone2" in config)
  ) {
    const legacy = config as LegacyConfig;
    return {
      kpis: sanitizeStringList(legacy?.zone1, DEFAULT_DASHBOARD_CONFIG.kpis),
      widgets: sanitizeStringList(legacy?.zone2, DEFAULT_DASHBOARD_CONFIG.widgets),
    };
  }

  const modern = config as DashboardConfig;
  const kpis = sanitizeStringList(modern?.kpis, DEFAULT_DASHBOARD_CONFIG.kpis);
  const widgets = sanitizeStringList(modern?.widgets, DEFAULT_DASHBOARD_CONFIG.widgets);

  return { kpis, widgets };
};

export async function resolveDashboardConfig(
  ctx: QueryCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<DashboardConfig> {
  const userDashboard = await ctx.db
    .query("dashboards")
    .withIndex("by_user_and_isDefault", (q) => q.eq("userId", userId).eq("isDefault", true))
    .first();

  if (userDashboard?.config) {
    return normalizeDashboardConfig(userDashboard.config);
  }

  const orgDashboard = await ctx.db
    .query("dashboards")
    .withIndex("by_org_isDefault_orgDefault", (q) =>
      q.eq("organizationId", organizationId).eq("isDefault", true).eq("isOrgDefault", true),
    )
    .first();

  if (orgDashboard?.config) {
    return normalizeDashboardConfig(orgDashboard.config);
  }

  return DEFAULT_DASHBOARD_CONFIG;
}
