import actionRetrier from "@convex-dev/action-retrier/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";

const app: ReturnType<typeof defineApp> = defineApp();

// Main workpool for all async operations with priority levels
app.use(workpool, { name: "mainWorkpool" });

// Action retrier for resilient external API calls
app.use(actionRetrier);

export default app;
