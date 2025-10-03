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
import { requireEnv } from '../utils/env';

type CrawlOptions = Parameters<Firecrawl['crawl']>[1];

const FIRECRAWL_API_KEY = requireEnv('FIRECRAWL_API_KEY');
const DEFAULT_MAX_PAGES: number | undefined = undefined;
const FALLBACK_PAGE_LIMITS: number[] = [120, 80, 40, 20, 10];
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

function extractFirecrawlErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const withMessage = error as { message?: unknown; error?: unknown };
    if (withMessage.message) {
      return String(withMessage.message);
    }
    if (withMessage.error) {
      return String(withMessage.error);
    }

    const details = (error as { details?: { error?: unknown } }).details;
    if (details?.error) {
      return String(details.error);
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isInsufficientCreditsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status === 402) {
    return true;
  }

  const message = extractFirecrawlErrorMessage(error).toLowerCase();
  return message.includes('insufficient credits');
}

function formatFirecrawlError(
  url: string,
  error: unknown,
  limit: number | undefined,
): string {
  const baseMessage = `Failed to crawl ${url}`;
  const errorMessage = extractFirecrawlErrorMessage(error);

  if (isInsufficientCreditsError(error)) {
    const limitMessage =
      limit !== undefined ? ` with page limit ${limit}` : '';
    return (
      `${baseMessage}${limitMessage}: ${errorMessage}. ` +
      'Try lowering the page limit or ensure your Firecrawl plan has enough credits.'
    );
  }

  return `${baseMessage}: ${errorMessage}`;
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
    } catch (_error) {
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

    const onboardingData = onboarding?.onboardingData || {};
    const lastAttemptAt = onboardingData.firecrawlLastAttemptAt;
    const firecrawlStatus = onboardingData.firecrawlSeedingStatus;
    const alreadySeeded = Boolean(onboardingData.firecrawlSeededAt);
    const hasAttemptedFirecrawl = Boolean(lastAttemptAt);
    const isScheduledRetry = firecrawlStatus?.status === 'scheduled';

    if (hasAttemptedFirecrawl && !isScheduledRetry && args.force !== true) {
      const lastAttemptIso =
        typeof lastAttemptAt === 'number'
          ? new Date(lastAttemptAt).toISOString()
          : 'unknown time';
      console.log(
        `Skipping Firecrawl crawl for ${args.url} because an attempt already ran at ${lastAttemptIso}.`,
      );
      return {
        skipped: true,
        reason:
          'Firecrawl seeding already attempted for this organization. Use force=true to rerun.',
      };
    }

    if (alreadySeeded && args.force !== true) {
      return {
        skipped: true,
        reason: 'Firecrawl docs already seeded for this organization.',
      };
    }

    if (firecrawlStatus?.status === 'in_progress' && args.force !== true) {
      return {
        skipped: true,
        reason: 'Firecrawl seeding is already in progress for this organization.',
      };
    }

    if (firecrawlStatus?.status === 'scheduled' || firecrawlStatus?.status === 'in_progress') {
      // No-op; continue execution but ensure we record that we're in progress
    }

    const onboardingId: Id<'onboarding'> | null = onboarding?._id ?? null;

    if (onboardingId) {
      await ctx.runMutation(
        internal.agent.firecrawl.markFirecrawlSeedingInProgress,
        {
          onboardingId,
        },
      );
    }

    const firecrawl = createFirecrawlClient();
    const initialLimit = args.maxPages ?? DEFAULT_MAX_PAGES;
    const fallbackLimits =
      args.maxPages === undefined ? FALLBACK_PAGE_LIMITS : [];

    const limitsToTry: Array<number | undefined> = [];
    const ensureLimit = (limit: number | undefined) => {
      if (limit === undefined) {
        if (!limitsToTry.includes(undefined)) {
          limitsToTry.push(undefined);
        }
        return;
      }

      if (!Number.isFinite(limit) || limit <= 0) {
        return;
      }

      if (!limitsToTry.includes(limit)) {
        limitsToTry.push(limit);
      }
    };

    ensureLimit(initialLimit);
    for (const limit of fallbackLimits) {
      ensureLimit(limit);
    }

    if (limitsToTry.length === 0) {
      limitsToTry.push(undefined);
    }

    const formatLimitLogValue = (limit: number | undefined): string =>
      limit === undefined ? 'unbounded' : String(limit);

    console.log(
      `Starting Firecrawl crawl for ${args.url} with limit ${formatLimitLogValue(limitsToTry[0])}`,
    );

    try {
      let crawlResult: Awaited<ReturnType<typeof firecrawl.crawl>> | null = null;
      let usedLimit: number | undefined = limitsToTry[0];
      let lastError: unknown;

      for (let attemptIndex = 0; attemptIndex < limitsToTry.length; attemptIndex += 1) {
        const limit = limitsToTry[attemptIndex];
        usedLimit = limit;

        const crawlOptions: CrawlOptions = {
          scrapeOptions: {
            formats: ['markdown'],
          },
        };

        if (limit !== undefined) {
          crawlOptions.limit = limit;
        }

        if (args.includePaths && args.includePaths.length > 0) {
          crawlOptions.includePaths = args.includePaths;
        }

        if (args.excludePaths && args.excludePaths.length > 0) {
          crawlOptions.excludePaths = args.excludePaths;
        }

        try {
          crawlResult = await firecrawl.crawl(args.url, crawlOptions);
          break;
        } catch (error) {
          const hasMoreAttempts = attemptIndex < limitsToTry.length - 1;
          if (isInsufficientCreditsError(error) && hasMoreAttempts) {
            const nextLimit = limitsToTry[attemptIndex + 1];
            console.warn(
              `Firecrawl reported insufficient credits for ${args.url} with page limit ${formatLimitLogValue(limit)}. Retrying with ${formatLimitLogValue(nextLimit)}.`,
            );
            lastError = error;
            continue;
          }

          const status = (error as { status?: number }).status;
          if (status === 429) {
            const resetAtText = (() => {
              const details = (error as { details?: { resetAt?: string; error?: string } }).details;
              if (details?.resetAt) {
                return details.resetAt;
              }

              const message = extractFirecrawlErrorMessage(error);
              const match = message.match(/resets at ([^.]+)/i);
              return match?.[1];
            })();

            const resetInfo = resetAtText ? ` (retry after ${resetAtText})` : '';
            console.warn(
              `Firecrawl rate limited for ${args.url}. Not retrying automatically.${resetInfo}`,
            );

            throw new Error(
              `Firecrawl rate limited for ${args.url}. Try again later or rerun with force=true.`,
            );
          }

          console.error('Firecrawl crawl failed:', error);
          throw new Error(formatFirecrawlError(args.url, error, limit));
        }
      }

      if (!crawlResult) {
        const errorToReport =
          lastError ?? new Error('Firecrawl crawl failed for an unknown reason.');
        console.error(
          'Firecrawl crawl failed after applying all fallback limits:',
          errorToReport,
        );
        throw new Error(
          formatFirecrawlError(args.url, errorToReport, limitsToTry.at(-1)),
        );
      }

      if (crawlResult.status === 'failed' || crawlResult.status === 'cancelled') {
        console.error(`Crawl failed with status: ${crawlResult.status}`);
        throw new Error(
          `Firecrawl crawl did not complete successfully: ${crawlResult.status}`,
        );
      }

      console.log(
        `Crawl completed successfully with limit ${formatLimitLogValue(usedLimit)}. Processing ${crawlResult.data?.length ?? 0} pages...`,
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

      if (onboardingId) {
        await ctx.runMutation(internal.agent.firecrawl.markFirecrawlSeeded, {
          onboardingId,
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
    } catch (error) {
      if (onboardingId) {
        await ctx.runMutation(
          internal.agent.firecrawl.markFirecrawlSeedingFailed,
          {
            onboardingId,
            errorMessage: extractFirecrawlErrorMessage(error),
          },
        );
      }
      throw error;
    }
  },
});
