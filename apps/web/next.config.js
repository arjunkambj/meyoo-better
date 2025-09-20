// @ts-check
import path from "path";
import { fileURLToPath } from "url";

// Construct __dirname in ESM context
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow importing/transpiling files from outside this app directory
    externalDir: true,
  },
  // Ensure workspace packages are transpiled by Next
  transpilePackages: ["@repo/ui", "@repo/types"],
  // Explicitly set the monorepo root to avoid Next inferring a wrong workspace root
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Configure allowed image domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
