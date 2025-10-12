import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";
import { requireEnv } from "./utils/env";

const META_TICK_MINUTES = Number(requireEnv("META_TICK_MINUTES"));
if (Number.isNaN(META_TICK_MINUTES) || META_TICK_MINUTES <= 0) {
  throw new Error("META_TICK_MINUTES must be a positive number");
}

const crons = cronJobs();

// Webhook processing is now handled directly via workpool
// No need for cron-based fallback processing

// Clean up old data every 6 hours for more aggressive cleanup
crons.interval(
  "cleanup old data",
  { hours: 6 },
  internal.jobs.maintenance.cleanupOldData,
  {
    daysToKeep: 90,
  },
);

// Webhook cleanup/health crons removed: fast-path handler no longer logs payloads

// Check for expired trials every hour
crons.interval(
  "check expired trials",
  { hours: 1 },
  internal.jobs.maintenance.checkExpiredTrials,
  {},
);

// Refresh expiring integration tokens daily (Meta long‑lived & Google refresh)
crons.interval(
  "refresh integration tokens",
  { hours: 24 },
  internal.integrations.tokenManager.refreshExpiring,
  {},
);

// NOTE: Global onboarding monitoring disabled - now using per-org self-scheduling
// Monitoring is automatically started when completeOnboarding() is called
// and will reschedule itself every 10 seconds until analytics are calculated
// See completeOnboarding() in core/onboarding.ts for implementation
//
// crons.interval(
//   "monitor onboarding sync completion",
//   { seconds: 10 },
//   internal.core.onboarding.monitorInitialSyncs,
//   { limit: 25 },
// );

export default crons;

// ===== Meta Batch Ticking =====
// Fixed-interval Meta tick with interval defined by META_TICK_MINUTES env
crons.interval(
  "meta batch tick",
  { minutes: META_TICK_MINUTES },
  internal.engine.metaScheduler.tick,
  {},
);
