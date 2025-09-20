import actionRetrier from "@convex-dev/action-retrier/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";

const app: ReturnType<typeof defineApp> = defineApp();

/**
 * Convex Components Configuration
 * Using official Convex components for robust async operations
 *
 * Documentation:
 * - Workpool: https://www.convex.dev/components/workpool
 * - Rate Limiter: https://www.convex.dev/components/rate-limiter
 * - Action Retrier: https://www.convex.dev/components/retrier
 */

// Main workpool for all async operations with priority levels
app.use(workpool, { name: "mainWorkpool" });

// Rate limiter for API throttling and preventing abuse
app.use(rateLimiter);

// Action retrier for resilient external API calls
app.use(actionRetrier);

// Resend for email sending
app.use(resend);

export default app;
