import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  createNewUserData,
  findExistingUser,
  handleExistingUser,
  handleInvitedUser,
  updateLoginTracking,
} from "./authHelpers";
import { createJob, PRIORITY } from "./engine/workpool";

async function enqueueMembershipReassign(
  ctx: MutationCtx,
  authUserId: Id<"users">,
  previousUserIds: Id<"users">[] | undefined,
) {
  if (!previousUserIds || previousUserIds.length === 0) return;

  const updatedUser = await ctx.db.get(authUserId);
  if (!updatedUser?.organizationId) return;

  await createJob(
    ctx as unknown as any,
    "maintenance:reassign_store_users",
    PRIORITY.BACKGROUND,
    {
      organizationId: updatedUser.organizationId,
      userId: authUserId,
      previousUserIds,
    },
  );
}

export const finalizeSignIn = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const mutationCtx = ctx as unknown as MutationCtx;
    const authUser = await mutationCtx.db.get(args.userId);
    if (!authUser) return;

    const existingUser = authUser.email
      ? await findExistingUser(mutationCtx, authUser.email, args.userId)
      : null;

    if (existingUser) {
      if (existingUser.status === "invited") {
        const activated = await handleInvitedUser(
          mutationCtx,
          args.userId,
          existingUser,
        );

        if (activated) {
          await enqueueMembershipReassign(mutationCtx, args.userId, [
            existingUser._id,
          ]);
        }
        return;
      }

      const merged = await handleExistingUser(
        mutationCtx,
        args.userId,
        existingUser,
      );

      if (merged) {
        await enqueueMembershipReassign(mutationCtx, args.userId, [
          existingUser._id,
        ]);
      }
      return;
    }

    if (authUser.status === "invited") {
      await handleInvitedUser(
        mutationCtx,
        args.userId,
        authUser as Doc<"users">,
      );
      return;
    }

    if (!authUser.organizationId) {
      await createNewUserData(mutationCtx, args.userId, authUser);
      return;
    }

    await updateLoginTracking(mutationCtx, args.userId);
  },
});
