import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { normalizeEmail } from "./authHelpers";
import { ResendOTP } from "./ResendOTP";

const passwordProviderBase = Password<DataModel>({
  reset: ResendOTP,
  profile(params, _ctx) {
    const email = params.email as string;
    const name = params.name as string | undefined;

    return {
      email: email ? normalizeEmail(email) : email,
      ...(name && { name }),
    };
  },
});

type PasswordAuthorize = NonNullable<typeof passwordProviderBase.authorize>;

const passwordProvider = {
  ...passwordProviderBase,
  async authorize(
    ...args: Parameters<PasswordAuthorize>
  ): ReturnType<PasswordAuthorize> {
    try {
      const authorize = passwordProviderBase.authorize;
      if (!authorize) {
        throw new ConvexError("Password provider is not configured correctly");
      }

      return await authorize(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes("InvalidSecret") ||
        message.includes("Invalid credentials")
      ) {
        throw new ConvexError("Invalid email or password");
      }

      throw error;
    }
  },
};

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
    passwordProvider,
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      await ctx.scheduler.runAfter(0, internal.authFinalize.finalizeSignIn, {
        userId,
      });
    },
  },
});
