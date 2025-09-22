import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserAndOrg } from "../utils/auth";

const KEY_LENGTH = 48;
const PREFIX_LENGTH = 8;

// Convex runtime does not expose Node's crypto library, so we build a
// reasonably long random key using Math.random and a simple, deterministic hash
// routine to avoid storing the raw key.
const generateApiKey = () => {
  let key = "";

  while (key.length < KEY_LENGTH) {
    key += Math.random().toString(36).slice(2);
  }

  return key.slice(0, KEY_LENGTH).toUpperCase();
};

const hashApiKey = (key: string) => {
  let h1 = 0xdeadbeef ^ key.length;
  let h2 = 0x41c6ce57 ^ key.length;

  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  return combined.padStart(32, "0");
};

// Create a new API key
export const createApiKey = mutation({
  args: {
    name: v.string(),
  },
  returns: v.object({
    key: v.string(),
    prefix: v.string(),
    id: v.id("apiKeys"),
  }),
  handler: async (ctx, args) => {
    const { user, orgId } = await requireUserAndOrg(ctx);

    // Generate the API key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);
    const prefix = apiKey.substring(0, PREFIX_LENGTH);

    // Store the key
    const id = await ctx.db.insert("apiKeys", {
      userId: user._id,
      organizationId: orgId,
      name: args.name,
      key: hashedKey,
      prefix,
      isActive: true,
      usageCount: 0,
      createdAt: Date.now(),
    });

    // Return the key (only time it's shown in plain text)
    return {
      key: apiKey,
      prefix,
      id,
    };
  },
});

// List all API keys for the user
export const listApiKeys = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("apiKeys"),
      name: v.string(),
      prefix: v.string(),
      lastUsed: v.optional(v.number()),
      usageCount: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
      revokedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return keys.map((key) => ({
      _id: key._id,
      name: key.name,
      prefix: key.prefix,
      lastUsed: key.lastUsed,
      usageCount: key.usageCount,
      isActive: key.isActive,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
    }));
  },
});

// Delete an API key
export const deleteApiKey = mutation({
  args: {
    id: v.id("apiKeys"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const key = await ctx.db.get(args.id);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found");
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

// Revoke an API key (soft delete)
export const revokeApiKey = mutation({
  args: {
    id: v.id("apiKeys"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const key = await ctx.db.get(args.id);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found");
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      revokedAt: Date.now(),
    });

    return null;
  },
});

// Update API key name or permissions
export const updateApiKey = mutation({
  args: {
    id: v.id("apiKeys"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const key = await ctx.db.get(args.id);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found");
    }

    await ctx.db.patch(args.id, { name: args.name });
    return null;
  },
});

// Validate an API key (for internal use - read only)
export const validateApiKey = query({
  args: {
    key: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      userId: v.id("users"),
      organizationId: v.id("organizations"),
    }),
    v.object({
      valid: v.literal(false),
      reason: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const hashedKey = hashApiKey(args.key);

    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", hashedKey))
      .first();

    if (!apiKey) {
      return {
        valid: false as const,
        reason: "Invalid API key",
      };
    }

    if (!apiKey.isActive) {
      return {
        valid: false as const,
        reason: "API key has been revoked",
      };
    }

    // Note: Usage statistics would be updated in a separate mutation
    return {
      valid: true as const,
      userId: apiKey.userId,
      organizationId: apiKey.organizationId,
    };
  },
});
