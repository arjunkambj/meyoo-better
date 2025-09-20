export default {
  providers: [
    {
      // IMPORTANT: This should be your Next.js app origin (e.g. https://localhost:3000 or https://app.example.com),
      // not the Convex deployment URL.
      domain: process.env.CONVEX_SITE_URL || "http://localhost:3001",
      applicationID: "convex",
    },
  ],
};
