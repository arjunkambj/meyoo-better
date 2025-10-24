import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const toUrl = (path: string) => (base ? `${base}${path}` : path);
  const lastModified = new Date();

  return [
    { url: toUrl("/"), lastModified },
    { url: toUrl("/pricing"), lastModified },
    { url: toUrl("/about"), lastModified },
    { url: toUrl("/contact"), lastModified },
    { url: toUrl("/careers"), lastModified },
    { url: toUrl("/cookies"), lastModified },
    { url: toUrl("/data-protection"), lastModified },
    { url: toUrl("/privacy/policy"), lastModified },
    { url: toUrl("/privacy/data-deletion"), lastModified },
  ];
}

