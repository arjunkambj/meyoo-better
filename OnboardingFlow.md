# Onboarding Flow

This document explains the complete Shopify onboarding experience that lives under the protected `/onboarding` routes in `apps/web`. It maps every page transition to the Next.js route handler, the API endpoints it touches, and the Convex queries/mutations those handlers call. Use it as the canonical reference when updating the flow or adding new steps.

---

## High-Level Sequence
- **Entry (`/onboarding`)** - server component fetches Convex onboarding status and redirects to the appropriate step.
- **Layout (`apps/web/app/(protected)/onboarding/layout.tsx`)** - wraps every step in `OnboardingLayoutClient`, which keeps status in sync and shows the progress UI.
- **Step 1:** `/onboarding/shopify` - connect a Shopify store or join the demo organization.
- **Step 2:** `/onboarding/billing` - choose a paid plan through Shopify managed pricing.
- **Step 3:** `/onboarding/marketing` - connect Meta Ads (Google Ads is marked "Coming soon").
- **Step 4:** `/onboarding/accounts` - pick the primary Meta ad account.
- **Step 5:** `/onboarding/products` - review and save product-level cost inputs.
- **Step 6:** `/onboarding/cost` - enter global operating, shipping, and payment cost assumptions.
- **Step 7:** `/onboarding/complete` - trigger analytics + initial syncs and redirect to the dashboard.

The Convex `onboarding` table is the source of truth for progress (`onboardingStep`) and flags such as `hasShopifyConnection`, `hasShopifySubscription`, `hasMetaConnection`, etc. Every step either calls `api.core.onboarding.updateOnboardingState` directly or relies on a Convex mutation/webhook that patches that record.

---

## Shared State & Guards

### Convex onboarding snapshot
- `api.core.onboarding.getOnboardingStatus` (query) is the single read used across the flow. It returns completion flags, per-platform sync state, current step, and whether billing is active.
- The server entrypoint (`apps/web/app/(protected)/onboarding/page.tsx`) calls this query via `fetchQuery` (with the current Convex auth token when available) and performs the initial redirect logic.
- `OnboardingLayoutClient` re-queries both `api.core.onboarding.getOnboardingStatus` and `api.core.users.getCurrentUser` with `useQuery`, caches them in Jotai atoms (`@/store/onboarding`), prefetches the next route, and reroutes to `/overview` once `completed` is true.

### Progress updates
- `NavigationButtons` (used in most steps) persists navigation by calling `api.core.onboarding.updateOnboardingState` *before* pushing to the next route. This avoids race conditions with the server guards.
- `SimpleNavigationButtons` (used on the Shopify step) only toggles the local pending overlay; Shopify connect advances the Convex step server-side.

---

## Step 1 - Shopify Store Connection (`/onboarding/shopify`)

### Primary data sources
- `useCurrentUser` -> `api.core.users.getCurrentUser`.
- `useOnboarding` (inside layout) -> `api.core.onboarding.getOnboardingStatus`.

### User actions and side effects
1. **Connect Shopify** (`ShopifyOnboardingClient`):
   - Clicking "Connect" navigates to `NEXT_PUBLIC_APP_INSTALL_URI` (usually `/api/v1/shopify/auth?shop=...`).
   - `GET /api/v1/shopify/auth` delegates to `shopify.auth.begin` with `SHOPIFY_REDIRECT_URI`.
   - Shopify redirects back to `GET /api/v1/shopify/callback` (`apps/web/app/api/v1/shopify/callback/route.ts`):
     - Obtains the Convex auth token (`convexAuthNextjsToken`).
     - Handles cross-organization installs by calling:
       - `api.installations.createOrAttachFromShopifyOAuth`
       - `api.installations.issueTokensFromShopifyOAuth`
       - `api.installations.ensureShopifyOnboarding` (indirect via helpers)
     - **Standard onboarding path** calls `api.core.onboarding.connectShopifyStore` which:
       - Inserts or updates `shopifyStores` with access token & metadata.
       - Updates the organization's primary currency, 14-day trial (`billing` table), and optionally timezone.
       - Patches the onboarding record (`hasShopifyConnection = true`, `onboardingStep = 2`/`BILLING`, appends `completedSteps`).
       - Seeds Firecrawl docs & brand summary via `api.agent.firecrawlSeed.seedDocsFromFirecrawl` and `api.agent.brandSummary.upsertBrandSummary`.
     - After storing credentials, the callback:
       - Registers Shopify webhooks (`api.integrations.shopify.checkAndSetWebhooksRegistered` / `setWebhooksRegisteredByDomain`).
       - Schedules an initial Shopify sync if needed using `api.engine.syncJobs.triggerInitialSync`.
       - Chooses the return route with `getRedirectUrl`, which fetches `api.core.onboarding.getOnboardingStatus`.
2. **Join demo workspace** (`View Demo` CTA):
   - Calls `api.core.onboarding.joinDemoOrganization`, which switches the user into the demo org, marks every onboarding flag as complete, and returns success toast details.

### Post conditions & background jobs
- `connectShopifyStore` sets `hasShopifyConnection = true` and moves the onboarding step to Billing (Step 2).
- Firecrawl and initial sync jobs are queued immediately; results are monitored later by `monitorInitialSyncs`.
- Billing completion still relies on Shopify managed pricing + webhook (see next step).

---

## Step 2 - Billing Plan Selection (`/onboarding/billing`)

### Primary data sources
- `useBilling()` pulls:
  - `api.core.users.getUserBilling`
  - `api.billing.organizationHelpers.getOrganizationByUser`
- `useQuery(api.core.shopDomainHelper.getCurrentShopDomain)` - gets active Shopify domain for redirect payloads.
- Live status via `api.core.onboarding.getOnboardingStatus` to auto-redirect when `hasShopifySubscription` flips to true.

### User actions and side effects
- **Select plan / upgrade** (`upgradePlan`):
  - Invokes `POST /api/v1/billing/request`, which:
    - Requires a Convex auth token (`convexAuthNextjsToken`).
    - Validates plan & shop, loads the organization via `api.billing.organizationHelpers.getOrganizationByUser`.
    - Builds a Shopify managed pricing URL with `createManagedPricingRedirectUrl` (return defaults to `/onboarding/marketing`).
    - Responds with `{ confirmationUrl, managedPricing: true }`, then the client hard-redirects.
  - Free plans still go through Shopify; on return, the webhook is responsible for marking the subscription.
- **Ancillary billing endpoints** exposed to the UI:
  - `GET /api/v1/billing/check` -> `checkBillingStatus(session)` (internal Shopify Admin REST call).
  - `GET /api/v1/billing/subscriptions` -> `shopify.billing.subscriptions`.
  - `POST /api/v1/billing/cancel` -> `shopify.billing.cancel`.
- **Shopify webhook** `app_subscriptions/update` (see `apps/backend/convex/webhooks/shopify.ts`):
  - Calls `internal.webhooks.processor.patchOnboardingById` to set `hasShopifySubscription = true`.
  - Delegates to `internal.billing.organizationHelpers.updateOrganizationPlanInternalWithTracking` to sync plan metadata, invoices, etc.

### Post conditions
- Once `hasShopifySubscription` is true, the browser is redirected to `/onboarding/marketing`.
- `api.core.onboarding.getOnboardingStatus` will now report `currentStep = 3`.

---

## Step 3 - Marketing Integrations (`/onboarding/marketing`)

### Primary data sources
- `useCurrentUser` -> `api.core.users.getCurrentUser` (used for Meta connection state).
- `useIntegration` hook:
  - `api.integrations.shopify.getStore`
  - `api.integrations.meta.getAdAccounts`
- `useOnboarding` -> `api.core.onboarding.getOnboardingStatus` & `api.core.status.getIntegrationStatus` for sync progress.

### User actions and side effects
- **Connect Meta Ads**:
  - Button navigates to `GET /api/v1/meta/auth`, which builds an OAuth request against `facebook.com/.../dialog/oauth`.
  - Facebook redirects into `GET /api/v1/meta/callback`:
    - Confirms Convex auth (`convexAuthNextjsToken`); otherwise redirects to sign-in.
    - Exchanges the code for a token, fetches the Meta user info.
    - Calls `api.integrations.meta.connectMeta` (stores token in `integrationSessions`, sets `hasMetaConnection = true` on the onboarding record).
    - Immediately fetches ad accounts via `api.integrations.meta.fetchMetaAccountsAction` (Convex action) and persists them with `api.integrations.meta.storeAdAccountsFromCallback`.
    - Returns to `/onboarding/marketing?meta_connected=true`.
- **Navigation onward**:
  - `NavigationButtons` runs `api.core.onboarding.updateOnboardingState({ step: 4 })` before pushing to `/onboarding/accounts`.

### Post conditions
- The onboarding record now has `hasMetaConnection = true`.
- Stored ad accounts become available to the next step; a sync job may be scheduled later when a primary account is chosen.

---

## Step 4 - Ad Account Selection (`/onboarding/accounts`)

### Primary data sources
- `useQuery(api.integrations.meta.getAdAccounts)` returns the accounts saved in the previous step.
- `useOnboarding` ensures Shopify + billing remain satisfied before rendering.

### User actions and side effects
- **Set primary account**:
  - Calls `api.integrations.meta.setPrimaryAdAccount`, which:
    - Toggles the `metaAdAccounts` records (ensuring only one primary).
    - Updates the onboarding record to step 5 when the current step is `ACCOUNTS`.
    - Schedules a high-priority sync job via `createJob(..., PRIORITY.HIGH)` to pull historical Meta data.
- **Skip / Continue**:
  - Both paths call `useUpdateOnboardingState` (`api.core.onboarding.updateOnboardingState`) to persist step 5 and push `/onboarding/products`.

### Post conditions
- `hasMetaConnection` remains true.
- `onboardingStep` is advanced to the products step (5) server-side to satisfy guards.

---

## Step 5 - Product Cost Inputs (`/onboarding/products`)

### Primary data sources
- `useShopifyProductVariantsPaginated` -> `api.integrations.shopify.getProductVariantsPaginated` (joins variants with product metadata and previously saved variant costs).
- `useOnboarding` supplies Shopify sync progress, shown in the UI badges.

### User actions and side effects
- **Row-level "Save"** button -> `api.core.costs.upsertVariantCosts`.
- **Save & Continue** (`NavigationButtons`):
  - Aggregates edited variants and calls `api.core.costs.saveVariantCosts` (bulk mutation) to persist COGS/tax/handling adjustments.
  - Relies on `NavigationButtons` to call `api.core.onboarding.updateOnboardingState({ step: 6 })` before moving to `/onboarding/cost`.

### Post conditions
- Variant-level costs are stored in `variantCosts`.
- The onboarding step advances to Cost setup.

---

## Step 6 - Global Costs & Returns (`/onboarding/cost`)

### Primary data sources
- `useCost("OPERATIONAL")`, `useCost("SHIPPING")`, `useCost("PAYMENT")` -> `api.core.costs.getCosts`.
- `useManualReturnRate` -> `api.core.costs.getManualReturnRate`.
- `useOnboarding` (guards against missing Shopify/Billing and exposes sync status text).
- `useUser` for currency display.

### User actions and side effects
- **Save** button:
  - Calls `useOnboardingCosts().saveInitialCosts` -> `api.core.onboarding.saveInitialCosts`.
  - The mutation:
    - Upserts `globalCosts` documents (shipping, payment fee %, monthly operating) with a 60-day retroactive effective date.
    - Optionally calls `internal.core.costs.upsertManualReturnRate`.
    - Marks `isExtraCostSetup = true` and moves the onboarding step to COMPLETE if the user was already on/after the costs phase.
    - Schedules analytics recomputation via `internal.engine.analytics.calculateAnalytics`.
  - The client subsequently updates the step to 7 with `useUpdateOnboardingState({ step: 7 })` and pushes `/onboarding/complete`.

### Post conditions
- Global costs are saved and analytics backfill is queued.
- Onboarding is ready for completion (Step 7).

---

## Step 7 - Completion & Initial Sync (`/onboarding/complete`)

### Primary data sources
- `useOnboarding` again (surfaced to display sync progress, pending platforms, expected orders).
- `useIntegrationStatus` data from `api.core.status.getIntegrationStatus`.

### User actions and side effects
- **Finish setup** (`handleComplete`):
  - Calls `finishOnboarding()` -> `api.core.onboarding.completeOnboarding`.
  - The mutation performs:
    - Sync status assessment for Shopify/Meta (`syncSessions` table).
    - Creation/update of a `syncProfiles` document to kick off ongoing cadenced syncs.
    - Updates the onboarding record (`isCompleted`, `isInitialSyncComplete` when appropriate, tracks pending platforms, resets monitoring counters).
    - Schedules `internal.core.onboarding.monitorInitialSyncs` (immediate `runMutation` + delayed `scheduler.runAfter`) for any platform still syncing.
    - Refreshes integration snapshots (`internal.core.status.refreshIntegrationStatus`).
    - Marks the user as onboarded (`isOnboarded = true`).
- The client waits for the mutation, marks the local state as complete, and redirects to `/overview`.

### Post conditions
- Onboarding is fully complete; future visits to `/onboarding` redirect immediately to `/overview`.
- `monitorInitialSyncs` continues to watch for stuck sync jobs and marks analytics as ready when they finish.

---

## Additional Reference

### Notable Next.js API routes touched during onboarding
| Endpoint | Purpose | Key Convex calls |
| --- | --- | --- |
| `GET /api/v1/shopify/auth` | Starts Shopify OAuth | - |
| `GET /api/v1/shopify/callback` | Finalizes Shopify OAuth | `api.core.onboarding.connectShopifyStore`, `api.installations.*`, `api.engine.syncJobs.triggerInitialSync` |
| `POST /api/v1/billing/request` | Build Shopify managed pricing URL | `api.billing.organizationHelpers.getOrganizationByUser` |
| `GET /api/v1/billing/check` | Inspect current billing status | Shopify Admin REST via session |
| `GET /api/v1/billing/subscriptions` | List Shopify subscriptions | Shopify Admin REST via session |
| `POST /api/v1/billing/cancel` | Cancel subscription | Shopify Admin REST via session |
| `GET /api/v1/meta/auth` | Start Meta OAuth | - |
| `GET /api/v1/meta/callback` | Finalize Meta OAuth | `api.integrations.meta.connectMeta`, `api.integrations.meta.fetchMetaAccountsAction`, `api.integrations.meta.storeAdAccountsFromCallback` |

### Key Convex mutations used by the client
- `api.core.onboarding.updateOnboardingState`
- `api.core.onboarding.joinDemoOrganization`
- `api.core.onboarding.saveInitialCosts`
- `api.core.onboarding.completeOnboarding`
- `api.integrations.meta.setPrimaryAdAccount`
- `api.core.costs.saveVariantCosts` / `api.core.costs.upsertVariantCosts`
- `api.billing.organizationHelpers.updateOrganizationPlan` (free plan immediate update)

### Background jobs & internals kicked off automatically
- `api.agent.firecrawlSeed.seedDocsFromFirecrawl`, `api.agent.brandSummary.upsertBrandSummary` (after Shopify connect).
- `api.engine.syncJobs.triggerInitialSync` (Shopify) and Meta sync jobs scheduled from `setPrimaryAdAccount`.
- `internal.core.onboarding.monitorInitialSyncs` (kickstarted during completion and cron).
- `internal.core.status.refreshIntegrationStatus` keeps the status snapshot fresh.
- Shopify webhooks (`app_subscriptions/update`) update billing + onboarding flags.

---

## Editing Tips
- Any new onboarding step should:
  - Read status via `api.core.onboarding.getOnboardingStatus`.
  - Persist progress with `api.core.onboarding.updateOnboardingState`.
  - Ensure server-side guards (in `/onboarding/page.tsx`) understand its numeric position.
- When touching Convex code that references onboarding, consult `apps/backend/convex/core/onboarding.ts` and keep helper order intact (`app.use(workpool)`, `actionRetrier`, `rag`, `agent`, `resend`) per repository rules.

This flow description should give you the full picture when refactoring steps, updating analytics triggers, or adding integrations to the onboarding journey.
