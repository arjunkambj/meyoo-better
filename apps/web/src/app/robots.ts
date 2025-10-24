import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // Optional: block common AI/LLM crawlers (training control, not SEO)
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "ChatGPT-User", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "Applebot-Extended", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}

