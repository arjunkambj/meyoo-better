import { requireEnv } from "./utils/env";

const CONVEX_SITE_URL = requireEnv("CONVEX_SITE_URL");
const CONVEX_ADMIN_SITE_URL = requireEnv("CONVEX_ADMIN_SITE_URL");

export default {
  providers: [
    {
      // IMPORTANT: This should be your Next.js app origin (e.g. https://localhost:3000 or https://app.example.com),
      // not the Convex deployment URL.
      domain: CONVEX_SITE_URL,
      applicationID: "convex",
    },
    {
      // Admin dashboard origin (Next.js on port 3001 in development).
      domain: CONVEX_ADMIN_SITE_URL,
      applicationID: "convex",
    },
  ],
};
