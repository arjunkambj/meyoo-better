import actionRetrier from "@convex-dev/action-retrier/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import rag from "@convex-dev/rag/convex.config";
import resend from "@convex-dev/resend/convex.config";

const app: ReturnType<typeof defineApp> = defineApp();

// Main workpool for all async operations with priority levels
app.use(workpool, { name: "mainWorkpool" });

// Action retrier for resilient external API calls
app.use(actionRetrier);
app.use(rag);
app.use(agent);
app.use(resend);

export default app;
