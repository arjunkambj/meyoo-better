import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  createNewUserData,
  findExistingUser,
  handleExistingUser,
  handleInvitedUser,
  normalizeEmail,
  updateLoginTracking,
} from "./authHelpers";
import { ResendOTP } from "./ResendOTP";
import { createJob, PRIORITY } from "./engine/workpool";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email ? normalizeEmail(profile.email) : profile.email,
          name: profile.name,
          image: profile.picture,
        };
      },
    }),
    ResendOTP,
    Password<DataModel>({
      reset: ResendOTP,
      profile(params, _ctx) {
        const email = params.email as string;
        const name = params.name as string | undefined;

        return {
          email: email ? normalizeEmail(email) : email,
          ...(name && { name }),
        };
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      const authUser = await ctx.db.get(userId);

      if (!authUser) return;

      // Check for existing user with same email
      const existingUser = (await findExistingUser(
        ctx as unknown as MutationCtx,
        authUser.email,
        userId,
      )) as Doc<"users"> | null;

        if (existingUser) {
          // Handle invited user activation
          if (existingUser.status === "invited") {
          const activated = await handleInvitedUser(ctx, userId, existingUser);

          if (activated) {
            // Enqueue background store user reassignment (idempotent)
            const updated = await ctx.db.get(userId);
            if (updated?.organizationId) {
              await createJob(
                ctx as unknown as any,
                "maintenance:reassign_store_users",
                PRIORITY.BACKGROUND,
                {
                  organizationId: updated.organizationId,
                  userId,
                },
              );
            }
            return;
          }
          }

          // Handle existing user with connections
        const merged = await handleExistingUser(ctx, userId, existingUser);

        if (merged) {
          const updated = await ctx.db.get(userId);
          if (updated?.organizationId) {
            await createJob(
              ctx as unknown as any,
              "maintenance:reassign_store_users",
              PRIORITY.BACKGROUND,
              {
                organizationId: updated.organizationId,
                userId,
              },
            );
          }
          return;
        }

        // Note: App installation linking handled via claimInstallation mutation
        // production: avoid noisy auth logs
      }

      // If no separate existing user doc is found, but this user is marked invited,
      // activate this same user record on first login.
      if (!existingUser && authUser.status === "invited") {
        const activated = await handleInvitedUser(
          ctx as unknown as MutationCtx,
          userId,
          authUser as Doc<"users">,
        );
        if (activated) {
          const updated = await ctx.db.get(userId);
          if (updated?.organizationId) {
            await createJob(
              ctx as unknown as any,
              "maintenance:reassign_store_users",
              PRIORITY.BACKGROUND,
              {
                organizationId: updated.organizationId,
                userId,
              },
            );
          }
          return;
        }
      }

      // Create initial data for new users
      if (!authUser.organizationId) {
        await createNewUserData(ctx, userId, authUser);
      } else {
        // Update login tracking for existing users
        await updateLoginTracking(ctx, userId);
      }
    },
  },
});
