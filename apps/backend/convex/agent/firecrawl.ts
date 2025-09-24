import { action, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { rag } from "../rag";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { resolveOrgIdForContext } from "../utils/org";

const FIRECRAWL_API_BASE =
  process.env.FIRECRAWL_API_BASE_URL ?? "https://api.firecrawl.dev";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const DEFAULT_MAX_PAGES = 20;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

function assertFirecrawlConfigured() {
  if (!FIRECRAWL_API_KEY) {
    throw new Error(
      "FIRECRAWL_API_KEY is not configured. Set it in the Convex environment before seeding docs.",
    );
  }
}

async function firecrawlRequest<T>(
  path: string,
  options: RequestInit & { searchParams?: Record<string, string> } = {},
): Promise<T> {
  assertFirecrawlConfigured();

  const url = new URL(path, FIRECRAWL_API_BASE);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(url.toString(), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Firecrawl request to ${url.pathname} failed (${response.status}): ${body}`,
    );
  }

  return (await response.json()) as T;
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FirecrawlPage = {
  url?: string;
  markdown?: string;
  html?: string;
  metadata?: Record<string, any> & { title?: string };
};

type FirecrawlJobResult = {
  status?: string;
  success?: boolean;
  data?: FirecrawlPage[];
  message?: string;
};

async function pollFirecrawlJob(jobId: string): Promise<FirecrawlPage[]> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const status = await firecrawlRequest<FirecrawlJobResult>(
      `/v1/crawl/${jobId}`,
      { method: "GET" },
    );

    if (status.status === "completed" || status.success === true) {
      return status.data ?? [];
    }

    if (status.status === "failed") {
      throw new Error(status.message || "Firecrawl crawl failed.");
    }

    await wait(POLL_INTERVAL_MS);
  }

  throw new Error(
    "Timed out waiting for Firecrawl to finish. Try a smaller crawl or increase the polling window.",
  );
}

export const getOnboardingForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    return await ctx.db
      .query("onboarding")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
  },
});

export const markFirecrawlSeeded = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
    url: v.string(),
  },
  handler: async (ctx, { onboardingId, url }) => {
    const existing = await ctx.db.get(onboardingId);
    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...(existing?.onboardingData || {}),
        firecrawlSeededAt: new Date().toISOString(),
        firecrawlSeededUrl: url,
      },
      updatedAt: Date.now(),
    });
  },
});

export const seedDocsFromFirecrawl = action({
  args: {
    url: v.string(),
    includePaths: v.optional(v.array(v.string())),
    excludePaths: v.optional(v.array(v.string())),
    maxPages: v.optional(v.number()),
    force: v.optional(v.boolean()),
    organizationId: v.optional(v.id("organizations")),
    shopDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrgIdForContext(ctx, {
      organizationId: args.organizationId ?? null,
      shopDomain: args.shopDomain ?? null,
      url: args.url,
    });

    const onboarding = await ctx.runQuery(
      internal.agent.firecrawl.getOnboardingForOrg,
      { orgId: orgId as Id<"organizations"> },
    );

    if (
      onboarding?.onboardingData?.firecrawlSeededAt &&
      args.force !== true
    ) {
      return {
        skipped: true,
        reason: "Firecrawl docs already seeded for this organization.",
      };
    }

    assertFirecrawlConfigured();

    const crawlPayload: Record<string, any> = {
      url: args.url,
      limit: args.maxPages ?? DEFAULT_MAX_PAGES,
      scrapeOptions: { formats: ["markdown"] },
    };

    if (args.includePaths) crawlPayload.includePaths = args.includePaths;
    if (args.excludePaths) crawlPayload.excludePaths = args.excludePaths;

    const startJob = await firecrawlRequest<{ id?: string; jobId?: string; data?: FirecrawlPage[]; success?: boolean }>(
      "/v1/crawl",
      {
        method: "POST",
        body: JSON.stringify(crawlPayload),
      },
    );

    let pages: FirecrawlPage[] = [];

    if (Array.isArray(startJob.data) && startJob.success) {
      pages = startJob.data;
    } else {
      const jobId = startJob.jobId ?? startJob.id;
      if (!jobId) {
        throw new Error("Firecrawl did not return a job id or data payload.");
      }
      pages = await pollFirecrawlJob(jobId);
    }

    const namespace = String(orgId);
    let indexed = 0;

    for (const page of pages) {
      const markdown = page.markdown ?? "";
      if (!markdown.trim()) continue;

      const pageUrl = page.url ?? args.url;
      const title = page.metadata?.title ?? pageUrl;

      await rag.add(ctx as any, {
        namespace,
        key: `firecrawl:${pageUrl}`,
        text: markdown,
        title,
        filterValues: [
          { name: "type", value: "firecrawl-doc" },
          { name: "resourceId", value: pageUrl },
        ],
        metadata: {
          sourceUrl: pageUrl,
          title,
        },
        importance: 1,
      });

      indexed += 1;
    }

    if (onboarding?._id) {
      await ctx.runMutation(internal.agent.firecrawl.markFirecrawlSeeded, {
        onboardingId: onboarding._id,
        url: args.url,
      });
    }

    return {
      indexed,
      namespace,
    };
  },
});
