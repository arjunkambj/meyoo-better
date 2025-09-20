import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

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

export default crons;

// ===== Meta Batch Ticking =====
// Fixed-interval Meta tick (default 6 minutes) with batch size controlled in handler
crons.interval(
  "meta batch tick",
  { minutes: Number(process.env.META_TICK_MINUTES || 6) },
  internal.engine.metaScheduler.tick,
  {},
);
