import type { Doc } from "../_generated/dataModel";

import type { MetaAdAccount, MetaInsight } from "./types";

export type MetaClient = {
  getMe: () => Promise<{ id: string; name: string }>;
  getAdAccounts: () => Promise<MetaAdAccount[]>;
  getCampaigns: (accountId: string) => Promise<unknown[]>;
  getInsights: (
    accountId: string,
    params: Record<string, unknown>,
  ) => Promise<MetaInsight[]>;
};

export async function initializeMetaClient(
  _session: Doc<"integrationSessions">,
): Promise<MetaClient> {
  // TODO: Replace with real Meta Graph API client wiring
  return {
    getMe: async () => ({ id: "123", name: "User" }),
    getAdAccounts: async () => [],
    getCampaigns: async (_accountId: string) => [],
    getInsights: async (
      _accountId: string,
      _params: Record<string, unknown>,
    ) => [],
  } satisfies MetaClient;
}

export async function fetchAdAccounts(
  client: MetaClient,
): Promise<MetaAdAccount[]> {
  return client.getAdAccounts();
}

export async function fetchCampaigns(
  client: MetaClient,
  accountId: string,
  _dateRange: { startDate: string; endDate: string },
): Promise<unknown[]> {
  return client.getCampaigns(accountId);
}

export async function fetchInsights(
  client: MetaClient,
  accountId: string,
  dateRange: { startDate: string; endDate: string },
): Promise<MetaInsight[]> {
  const params = {
    time_range: {
      since: dateRange.startDate,
      until: dateRange.endDate,
    },
    level: "account",
    fields: [
      "spend",
      "impressions",
      "clicks",
      "cpm",
      "cpc",
      "ctr",
      "conversions",
      "conversion_rate",
      "cost_per_conversion",
      "reach",
      "frequency",
    ].join(","),
  } satisfies Record<string, unknown>;

  return client.getInsights(accountId, params);
}

export async function fetchInsightsSince(
  client: MetaClient,
  accountId: string,
  _since: string,
): Promise<MetaInsight[]> {
  // TODO: Include since parameter when real client is wired
  return client.getInsights(accountId, {});
}

