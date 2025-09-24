'use node';

import Firecrawl, {
  type Document as FirecrawlDocument,
} from '@mendable/firecrawl-js';
import { action } from '../_generated/server';
import { v } from 'convex/values';
import { rag } from '../rag';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { resolveOrgIdForContext } from '../utils/org';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const DEFAULT_MAX_PAGES = 10;
const SUMMARY_PAGE_LIMIT = 5;
const SUMMARY_SNIPPET_LENGTH = 600;

function createFirecrawlClient(): Firecrawl {
  if (!FIRECRAWL_API_KEY) {
    throw new Error(
      'FIRECRAWL_API_KEY is not configured. Set it in the Convex environment before seeding docs.',
    );
  }

  return new Firecrawl({
    apiKey: FIRECRAWL_API_KEY,
  });
}

function buildSnippet(markdown: string): string {
  if (!markdown.trim()) {
    return '';
  }

  const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, ' ');
  const withoutLinks = withoutCodeBlocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
  const simplified = withoutLinks
    .replace(/[>#*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!simplified) {
    return '';
  }

  if (simplified.length <= SUMMARY_SNIPPET_LENGTH) {
    return simplified;
  }

  return `${simplified.slice(0, SUMMARY_SNIPPET_LENGTH).trim()}…`;
}

function resolvePageUrl(page: FirecrawlDocument, fallback: string): string {
  const metadata = page.metadata ?? {};

  if (typeof metadata.sourceURL === 'string' && metadata.sourceURL.trim()) {
    return metadata.sourceURL;
  }

  const lowerCaseSourceUrl = (metadata as Record<string, unknown>).sourceUrl;
  if (typeof lowerCaseSourceUrl === 'string' && lowerCaseSourceUrl.trim()) {
    return lowerCaseSourceUrl;
  }

  if (typeof metadata.ogUrl === 'string' && metadata.ogUrl.trim()) {
    return metadata.ogUrl;
  }

  return fallback;
}

function buildSummary(rootUrl: string, pages: FirecrawlDocument[]): string {
  if (pages.length === 0) {
    return `No crawlable content was found at ${rootUrl}.`;
  }

  const parsedUrl = new URL(rootUrl);
  const sections = pages.slice(0, SUMMARY_PAGE_LIMIT).map((page, index) => {
    const pageUrl = resolvePageUrl(page, rootUrl);
    const title = page.metadata?.title ?? `Page ${index + 1}`;
    const description = page.metadata?.description?.trim();
    const snippet = buildSnippet(page.markdown ?? '');

    const lines: string[] = [`${index + 1}. ${title}`, `URL: ${pageUrl}`];

    if (description) {
      lines.push(description);
    }

    if (snippet) {
      lines.push(snippet);
    }

    return lines.join('\n');
  });

  return [
    `Website overview for ${parsedUrl.hostname}`,
    `Source: ${rootUrl}`,
    '',
    ...sections,
  ].join('\n\n');
}

export const seedDocsFromFirecrawl = action({
  args: {
    url: v.string(),
    includePaths: v.optional(v.array(v.string())),
    excludePaths: v.optional(v.array(v.string())),
    maxPages: v.optional(v.number()),
    force: v.optional(v.boolean()),
    organizationId: v.optional(v.id('organizations')),
    shopDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(args.url);
    } catch (error) {
      throw new Error(`Invalid URL provided: ${args.url}`);
    }

    const { orgId } = await resolveOrgIdForContext(ctx, {
      organizationId: args.organizationId ?? null,
      shopDomain: args.shopDomain ?? null,
      url: args.url,
    });

    const onboarding = await ctx.runQuery(
      internal.agent.firecrawl.getOnboardingForOrg,
      { orgId: orgId as Id<'organizations'> },
    );

    if (onboarding?.onboardingData?.firecrawlSeededAt && args.force !== true) {
      return {
        skipped: true,
        reason: 'Firecrawl docs already seeded for this organization.',
      };
    }

    const firecrawl = createFirecrawlClient();
    const maxPages = args.maxPages ?? DEFAULT_MAX_PAGES;

    console.log(
      `Starting Firecrawl crawl for ${args.url} with limit ${maxPages}`,
    );

    let crawlResult;
    try {
      crawlResult = await firecrawl.crawl(args.url, {
        limit: maxPages,
        includePaths: args.includePaths ?? undefined,
        excludePaths: args.excludePaths ?? undefined,
        scrapeOptions: {
          formats: ['markdown'],
        },
      });
    } catch (error) {
      console.error('Firecrawl crawl failed:', error);
      throw new Error(
        `Failed to crawl ${args.url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (crawlResult.status === 'failed' || crawlResult.status === 'cancelled') {
      console.error(`Crawl failed with status: ${crawlResult.status}`);
      throw new Error(
        `Firecrawl crawl did not complete successfully: ${crawlResult.status}`,
      );
    }

    console.log(
      `Crawl completed successfully. Processing ${crawlResult.data?.length ?? 0} pages...`,
    );

    const relevantPages: FirecrawlDocument[] =
      crawlResult.data?.filter((page) => (page.markdown ?? '').trim()) ?? [];
    const pageCount = relevantPages.length;
    const summary = buildSummary(args.url, relevantPages);
    const namespace = String(orgId);
    const hostname = parsedUrl.hostname;

    await rag.add(ctx, {
      namespace,
      key: 'firecrawl:summary',
      text: summary,
      title: `${hostname} website overview`,
      filterValues: [
        { name: 'type', value: 'firecrawl-summary' },
        { name: 'resourceId', value: hostname },
      ],
      metadata: {
        sourceUrl: args.url,
        pageCount,
      },
      importance: 2,
    });

    if (onboarding?._id) {
      await ctx.runMutation(internal.agent.firecrawl.markFirecrawlSeeded, {
        onboardingId: onboarding._id,
        url: args.url,
        summary,
        pageCount,
      });
    }

    console.log(`Stored Firecrawl summary for ${hostname} (${pageCount} pages)`);

    return {
      namespace,
      pageCount,
      summary,
    };
  },
});
