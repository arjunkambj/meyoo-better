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

export const normalizeDashboardConfig = (config: StoredConfig): DashboardConfig => {
  if (!config) {
    return DEFAULT_DASHBOARD_CONFIG;
  }

  if ("zone1" in config || "zone2" in config) {
    const legacy = config as LegacyConfig;
    return {
      kpis: Array.isArray(legacy?.zone1) ? legacy.zone1 : DEFAULT_DASHBOARD_CONFIG.kpis,
      widgets: Array.isArray(legacy?.zone2) ? legacy.zone2 : DEFAULT_DASHBOARD_CONFIG.widgets,
    };
  }

  const modern = config as DashboardConfig;
  const kpis = Array.isArray(modern?.kpis) ? modern.kpis : DEFAULT_DASHBOARD_CONFIG.kpis;
  const widgets = Array.isArray(modern?.widgets)
    ? modern.widgets
    : DEFAULT_DASHBOARD_CONFIG.widgets;

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
