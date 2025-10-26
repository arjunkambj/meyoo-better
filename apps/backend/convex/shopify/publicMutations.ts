import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { findShopifyStoreByDomain, normalizeShopDomain } from "../utils/shop";

export const setWebhooksRegisteredByDomain = mutation({
  args: { shopDomain: v.string(), value: v.boolean() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const domain = normalizeShopDomain(args.shopDomain);
    const store = await findShopifyStoreByDomain(ctx.db, domain);

    if (!store) throw new Error("Store not found");

    await ctx.db.patch(store._id, {
      webhooksRegistered: args.value,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const checkAndSetWebhooksRegistered = mutation({
  args: { shopDomain: v.string() },
  returns: v.object({
    shouldRegister: v.boolean(),
    alreadyRegistered: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const domain = normalizeShopDomain(args.shopDomain);
    const store = await findShopifyStoreByDomain(ctx.db, domain);

    if (!store) {
      throw new Error("Store not found");
    }

    if (store.webhooksRegistered === true) {
      return {
        shouldRegister: false,
        alreadyRegistered: true,
      };
    }

    await ctx.db.patch(store._id, {
      webhooksRegistered: true,
      updatedAt: Date.now(),
    });

    return {
      shouldRegister: true,
      alreadyRegistered: false,
    };
  },
});
