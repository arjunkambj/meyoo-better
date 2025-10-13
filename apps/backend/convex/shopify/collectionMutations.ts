
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const storeCollectionInternal = internalMutation({
  args: {
    organizationId: v.string(),
    collection: v.any(),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    // production: avoid noisy collection logs

    return null;
  },
});

export const updateCollectionInternal = internalMutation({
  args: {
    organizationId: v.string(),
    collection: v.any(),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    // production: avoid noisy collection logs

    return null;
  },
});

export const deleteCollectionInternal = internalMutation({
  args: {
    organizationId: v.string(),
    collectionId: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, _args) => {
    // production: avoid noisy collection logs

    return null;
  },
});
