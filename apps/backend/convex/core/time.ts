import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getShopTimeInfo as fetchShopTimeInfo } from "../../libs/time/shopTime";
import { internal } from "../_generated/api";

export const getShopTimeInfo = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.object({
    offsetMinutes: v.number(),
    timezoneAbbreviation: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    let orgId: Id<"organizations"> | undefined = args.organizationId as Id<
      "organizations"
    > | undefined;

    if (!orgId) {
      const userId = await getAuthUserId(ctx);
      if (userId) {
        const user = (await ctx.runQuery(internal.core.users.getById, {
          userId,
        })) as unknown as { organizationId?: Id<"organizations"> } | null;
        if (user?.organizationId) orgId = user.organizationId as Id<"organizations">;
      }
    }

    if (!orgId) {
      return { offsetMinutes: 0, timezoneAbbreviation: undefined };
    }

    const info = await fetchShopTimeInfo(ctx, String(orgId));
    return { offsetMinutes: info.offsetMinutes ?? 0, timezoneAbbreviation: info.timezoneAbbreviation };
  },
});
