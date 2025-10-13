
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { logger } from "./shared";
import { DELETE_BATCH_SIZE, ORGANIZATION_TABLES, STORE_TABLES } from "./cleanup";
import { createNewUserData } from "../authHelpers";

export const handleAppUninstallInternal = internalMutation({
  args: {
    shopDomain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // This function ONLY marks the store as inactive
    // The full cleanup is handled by handleAppUninstalled which is called separately
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
      .first();

    if (store) {
      await ctx.db.patch(store._id, {
        isActive: false,
        uninstalledAt: Date.now(),
      });
      
      logger.info("Marked Shopify store as inactive", {
        storeId: store._id,
        shopDomain: args.shopDomain,
        organizationId: store.organizationId,
      });
    } else {
      logger.warn("Store not found for uninstall", {
        shopDomain: args.shopDomain,
      });
    }

    return null;
  },
});


export const handleAppUninstalled = internalMutation({
  args: {
    organizationId: v.string(),
    shopDomain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      logger.info("Processing app uninstall", {
        organizationId: args.organizationId,
        shopDomain: args.shopDomain,
      });

      // STEP 1: IMMEDIATELY RESET USER STATE TO NEW USER
      // This ensures users are marked as new even if deletion fails
      logger.info("Resetting user state to new user FIRST", {
        organizationId: args.organizationId,
      });

      const organizationId = args.organizationId as Id<"organizations">;

      const users = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId)
        )
        .collect();

      for (const user of users) {
        const uninstallTimestamp = Date.now();
          const onboardingResetData = {
            completedSteps: [],
            setupDate: new Date(uninstallTimestamp).toISOString(),
            firecrawlSeededAt: undefined,
            firecrawlSeededUrl: undefined,
            firecrawlSummary: undefined,
            firecrawlPageCount: undefined,
            firecrawlSeedingStatus: undefined,
            firecrawlLastAttemptAt: undefined,
          };

        try {
          // Mark existing memberships as removed so the user no longer belongs to the org
          const memberships = await ctx.db
            .query("memberships")
            .withIndex("by_org_user", (q) =>
              q
                .eq("organizationId", organizationId)
                .eq("userId", user._id),
            )
            .collect();

          for (const membership of memberships) {
            if (membership.status !== "removed") {
              await ctx.db.patch(membership._id, {
                status: "removed",
                updatedAt: uninstallTimestamp,
              });
            }
          }

          // Reset onboarding record so any residual data is cleared before cleanup
          const onboarding = await ctx.db
            .query("onboarding")
            .withIndex("by_user_organization", (q) =>
              q
                .eq("userId", user._id)
                .eq("organizationId", user.organizationId as Id<"organizations">),
            )
            .first();

          if (onboarding) {
            await ctx.db.patch(onboarding._id, {
              hasShopifyConnection: false,
              hasShopifySubscription: false,
              hasMetaConnection: false,
              hasGoogleConnection: false,
              isInitialSyncComplete: false,
              isProductCostSetup: false,
              isExtraCostSetup: false,
              isCompleted: false,
              onboardingStep: 1,
              onboardingData: onboardingResetData,
              updatedAt: uninstallTimestamp,
            });
          } else {
            await ctx.db.insert("onboarding", {
              userId: user._id,
              organizationId: user.organizationId as Id<"organizations">,
              hasShopifyConnection: false,
              hasShopifySubscription: false,
              hasMetaConnection: false,
              hasGoogleConnection: false,
              isInitialSyncComplete: false,
              isProductCostSetup: false,
              isExtraCostSetup: false,
              isCompleted: false,
              onboardingStep: 1,
              onboardingData: onboardingResetData,
              createdAt: uninstallTimestamp,
              updatedAt: uninstallTimestamp,
            });
          }

          // Move the user into a fresh personal organization so they can re-onboard later
          await createNewUserData(ctx as unknown as MutationCtx, user._id, {
            name: user.name || null,
            email: user.email || null,
          });

          // Record uninstall timestamp on the user for audit purposes
          await ctx.db.patch(user._id, {
            appDeletedAt: uninstallTimestamp,
            updatedAt: Date.now(),
          });

          logger.info("Detached user from organization after uninstall", {
            organizationId: args.organizationId,
            userId: user._id,
          });
        } catch (error) {
          logger.error("Failed to detach user during uninstall", error, {
            organizationId: args.organizationId,
            userId: user._id,
          });
        }
      }

      // STEP 2: RESET ORGANIZATION STATE
      const organization = await ctx.db.get(organizationId);
      if (organization) {
        await ctx.db.patch(organization._id, {
          isPremium: false,
          updatedAt: Date.now(),
        });

        // Delete existing billing record to ensure reinstall goes through billing step
        const billingRecord = await ctx.db
          .query("billing")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id)
          )
          .first();

        if (billingRecord) {
          await ctx.db.delete(billingRecord._id);
        }
      }

      logger.info("User and organization state reset completed", {
        organizationId: args.organizationId,
        usersReset: users.length,
      });

      // STEP 3: SCHEDULE DATA CLEANUP IN BATCHES
      const storeJobsPerTable: Record<string, number> = {};
      const organizationJobsPerTable: Record<string, number> = {};

      const stores = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId)
        )
        .collect();

      let storeCleanupJobs = 0;

      for (const store of stores) {
        for (const table of STORE_TABLES) {
          await ctx.scheduler.runAfter(
            0,
            internal.shopify.cleanup.deleteStoreDataBatch,
            {
              table,
              storeId: store._id,
              batchSize: DELETE_BATCH_SIZE,
            },
          );

          storeCleanupJobs += 1;
          storeJobsPerTable[table] = (storeJobsPerTable[table] ?? 0) + 1;
        }

        await ctx.scheduler.runAfter(
          0,
          internal.shopify.cleanup.deleteShopifyStoreIfEmpty,
          {
            storeId: store._id,
            organizationId,
          },
        );

        storeCleanupJobs += 1;
      }

      let organizationCleanupJobs = 0;

      for (const table of ORGANIZATION_TABLES) {
        await ctx.scheduler.runAfter(
          0,
          internal.shopify.cleanup.deleteOrganizationDataBatch,
          {
            table,
            organizationId,
            batchSize: DELETE_BATCH_SIZE,
          },
        );

        organizationCleanupJobs += 1;
        organizationJobsPerTable[table] =
          (organizationJobsPerTable[table] ?? 0) + 1;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.shopify.cleanup.deleteDashboardsBatch,
        {
          organizationId,
          ownerId: organization?.ownerId as Id<"users"> | undefined,
          batchSize: DELETE_BATCH_SIZE,
        },
      );

      organizationCleanupJobs += 1;
      organizationJobsPerTable.dashboards =
        (organizationJobsPerTable.dashboards ?? 0) + 1;

      logger.info("App uninstall cleanup scheduled", {
        organizationId: args.organizationId,
        shopDomain: args.shopDomain,
        usersReset: users.length,
        storeCount: stores.length,
        storeCleanupJobs,
        organizationCleanupJobs,
        storeJobsPerTable,
        organizationJobsPerTable,
      });

      return null;
    } catch (error) {
      logger.error("App uninstall handler failed", error, {
        organizationId: args.organizationId,
        shopDomain: args.shopDomain,
      });

      // Try to get a user for audit log
      throw error;
    }
  },
});
