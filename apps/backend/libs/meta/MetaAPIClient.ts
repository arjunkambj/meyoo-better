import { META_CONFIG } from "./meta.config.js";
import { createSimpleLogger } from "../logging/simple";

const logger = createSimpleLogger("MetaAPIClient");

export interface MetaAPIClientConfig {
  apiVersion?: string;
  baseURL?: string;
}

export interface MetaInsight {
  date_start?: string;
  date_stop?: string;
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  cpp?: string;
  conversions?: string;
  conversion_value?: string;
  cost_per_conversion?: string;
  purchase_roas?: Array<{ action_type: string; value: string }>;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  [key: string]: unknown;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  created_time?: string;
  updated_time?: string;
  start_time?: string;
  stop_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  [key: string]: unknown;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  created_time?: string;
  updated_time?: string;
  start_time?: string;
  end_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  [key: string]: unknown;
}

export interface MetaAd {
  id: string;
  name: string;
  adset_id?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  created_time?: string;
  updated_time?: string;
  creative?: {
    id: string;
    name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency?: string;
  timezone_name?: string;
  business?: {
    id: string;
    name: string;
  };
  spend_cap?: string;
  amount_spent?: string;
  balance?: string;
  account_status?: number;
  disable_reason?: number;
  timezone_offset_hours_utc?: number;
  [key: string]: unknown;
}

export interface InsightsParams {
  level: string;
  datePreset?: string;
  timeRange?: { since: string; until: string };
  breakdowns?: string;
  actionBreakdowns?: string;
  timeIncrement?: string;
  filtering?: Array<{
    field: string;
    operator: string;
    value: string | number | boolean;
  }>;
}

export interface CampaignFilters {
  effectiveStatus?: string[];
  limit?: number;
}

export interface APIResponse<T> {
  data: T;
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

export class MetaAPIClient {
  private readonly baseURL: string;
  private readonly apiVersion: string;

  constructor(
    private accessToken: string,
    config: MetaAPIClientConfig = {}
  ) {
    this.apiVersion = config.apiVersion || META_CONFIG.API_VERSION;
    this.baseURL =
      config.baseURL || `${META_CONFIG.BASE_URL}/${this.apiVersion}`;
  }

  /**
   * Get account insights
   */
  async getAccountInsights(
    accountId: string,
    params: InsightsParams,
    fields?: string[]
  ): Promise<APIResponse<MetaInsight[]>> {
    const endpoint = `${accountId}/insights`;
    const urlParams = this.buildInsightsParams(params);

    // Add fields parameter if provided
    if (fields && fields.length > 0) {
      urlParams.append("fields", fields.join(","));
    }

    const url = this.buildURL(endpoint, urlParams);

    return this.makeRequest<MetaInsight[]>(url);
  }

  /**
   * Get account insights with pagination support
   * Returns all pages of results
   */
  async getAccountInsightsPaginated(
    accountId: string,
    params: InsightsParams,
    fields?: string[]
  ): Promise<MetaInsight[]> {
    const endpoint = `${accountId}/insights`;
    const urlParams = this.buildInsightsParams(params);

    // Add fields parameter if provided
    if (fields && fields.length > 0) {
      urlParams.append("fields", fields.join(","));
    }

    const url = this.buildURL(endpoint, urlParams);
    const allResults: MetaInsight[] = [];

    // Log initial request with full details
    logger.info("Fetching paginated insights", {
      accountId,
      params,
      fieldsCount: fields?.length || 0,
      fullUrl: url,
      dateRange: params.timeRange || params.datePreset || "no date specified",
    });

    let pageCount = 0;
    let hasData = false;

    // Use the paginated data generator
    try {
      for await (const batch of this.getPaginatedData<MetaInsight>(url)) {
        pageCount++;
        allResults.push(...batch);
        hasData = true;

        logger.info("Fetched insights batch", {
          pageNumber: pageCount,
          batchSize: batch.length,
          totalSoFar: allResults.length,
          firstRecordDate: batch[0]?.date_start ?? "no data",
          lastRecordDate: batch[batch.length - 1]?.date_start ?? "no data",
        });
      }
    } catch (error) {
      logger.error("Error during pagination", error as Error, {
        accountId,
        pagesProcessed: pageCount,
        recordsCollected: allResults.length,
      });
      throw error;
    }

    // Log completion with diagnostic info
    logger.info("Completed paginated insights fetch", {
      accountId,
      totalResults: allResults.length,
      totalPages: pageCount,
      hasData,
      dateRangeRequested:
        params.timeRange || params.datePreset || "no date specified",
      firstResultDate: allResults[0]?.date_start ?? "no results",
      lastResultDate: allResults[allResults.length - 1]?.date_start ?? "no results",
    });

    return allResults;
  }

  /**
   * Get campaign insights
   */
  async getCampaignInsights(
    campaignId: string,
    params: InsightsParams,
    fields?: string[]
  ): Promise<APIResponse<MetaInsight[]>> {
    const endpoint = `${campaignId}/insights`;
    const urlParams = this.buildInsightsParams(params);

    // Add fields parameter if provided
    if (fields && fields.length > 0) {
      urlParams.append("fields", fields.join(","));
    }

    const url = this.buildURL(endpoint, urlParams);

    return this.makeRequest<MetaInsight[]>(url);
  }

  /**
   * Get campaigns
   */
  async getCampaigns(
    accountId: string,
    fields: string[],
    filters?: CampaignFilters
  ): Promise<APIResponse<MetaCampaign[]>> {
    const endpoint = `${accountId}/campaigns`;
    const params = new URLSearchParams({
      fields: fields.join(","),
      limit: (filters?.limit || 100).toString(),
    });

    if (filters?.effectiveStatus) {
      params.append(
        "filtering",
        JSON.stringify([
          {
            field: "effective_status",
            operator: "IN",
            value: filters.effectiveStatus,
          },
        ])
      );
    }

    const url = this.buildURL(endpoint, params);

    return this.makeRequest<MetaCampaign[]>(url);
  }

  /**
   * Get ad sets for a campaign
   */
  async getAdSets(
    campaignId: string,
    fields: string[],
    filters?: CampaignFilters
  ): Promise<APIResponse<MetaAdSet[]>> {
    const endpoint = `${campaignId}/adsets`;
    const params = new URLSearchParams({
      fields: fields.join(","),
      limit: (filters?.limit || 100).toString(),
    });

    if (filters?.effectiveStatus) {
      params.append(
        "filtering",
        JSON.stringify([
          {
            field: "effective_status",
            operator: "IN",
            value: filters.effectiveStatus,
          },
        ])
      );
    }

    const url = this.buildURL(endpoint, params);

    return this.makeRequest<MetaAdSet[]>(url);
  }

  /**
   * Get ads for an ad set
   */
  async getAds(
    adSetId: string,
    fields: string[],
    filters?: CampaignFilters
  ): Promise<APIResponse<MetaAd[]>> {
    const endpoint = `${adSetId}/ads`;
    const params = new URLSearchParams({
      fields: fields.join(","),
      limit: (filters?.limit || 100).toString(),
    });

    if (filters?.effectiveStatus) {
      params.append(
        "filtering",
        JSON.stringify([
          {
            field: "effective_status",
            operator: "IN",
            value: filters.effectiveStatus,
          },
        ])
      );
    }

    const url = this.buildURL(endpoint, params);

    return this.makeRequest<MetaAd[]>(url);
  }

  /**
   * Get ad accounts
   */
  async getAdAccounts(
    userId: string = "me",
    fields: string[] = ["id", "name", "currency", "timezone_name", "business"]
  ): Promise<APIResponse<MetaAdAccount[]>> {
    const endpoint = `${userId}/adaccounts`;
    const params = new URLSearchParams({
      fields: fields.join(","),
      limit: "100",
    });

    const url = this.buildURL(endpoint, params);

    return this.makeRequest<MetaAdAccount[]>(url);
  }

  /**
   * Get account details with budget information
   */
  async getAccountDetails(
    accountId: string
  ): Promise<APIResponse<MetaAdAccount>> {
    // Ensure account ID is in the correct format
    const formattedAccountId = accountId.startsWith("act_")
      ? accountId
      : `act_${accountId}`;

    const fields = [
      "id",
      "name",
      "spend_cap",
      "amount_spent",
      "balance",
      "currency",
      "account_status",
      "disable_reason",
      "timezone_name",
      "timezone_offset_hours_utc",
    ];
    const params = new URLSearchParams({
      fields: fields.join(","),
    });

    const url = this.buildURL(formattedAccountId, params);

    logger.info("Getting account details", {
      originalAccountId: accountId,
      formattedAccountId,
      url,
      fields: fields.join(","),
    });

    try {
      const response = await this.makeRequest<MetaAdAccount>(url);

      logger.info("Account details API response", {
        accountId: formattedAccountId,
        hasData: !!response.data,
        error: response.error,
      });

      return response;
    } catch (error) {
      logger.error("Account details API error", error as Error, {
        accountId: formattedAccountId,
        originalAccountId: accountId,
      });
      throw error;
    }
  }

  /**
   * Build insights parameters
   */
  private buildInsightsParams(params: InsightsParams): URLSearchParams {
    const queryParams = new URLSearchParams({
      level: params.level,
      use_unified_attribution_setting: "true",
      default_summary: "true",
    });

    if (params.datePreset) {
      // For lifetime preset, don't use underscores
      const preset =
        params.datePreset === "lifetime" ? "lifetime" : params.datePreset;

      queryParams.append("date_preset", preset);
    } else if (params.timeRange) {
      queryParams.append(
        "time_range",
        JSON.stringify({
          since: params.timeRange.since,
          until: params.timeRange.until,
        })
      );
    }

    if (params.breakdowns) {
      queryParams.append("breakdowns", params.breakdowns);
    }

    if (params.actionBreakdowns) {
      queryParams.append("action_breakdowns", params.actionBreakdowns);
    }

    if (params.timeIncrement) {
      queryParams.append("time_increment", params.timeIncrement);
    }

    if (params.filtering && params.filtering.length > 0) {
      queryParams.append("filtering", JSON.stringify(params.filtering));
    } else {
      queryParams.append("filtering", JSON.stringify([]));
    }

    return queryParams;
  }

  /**
   * Build full URL
   */
  private buildURL(endpoint: string, params: URLSearchParams): string {
    return `${this.baseURL}/${endpoint}?${params.toString()}`;
  }

  /**
   * Make HTTP request
   */
  private async makeRequest<T>(url: string): Promise<APIResponse<T>> {
    // Log outgoing request
    logger.info("Making API request", {
      url: url.substring(0, 200), // Log first 200 chars to avoid huge logs
      hasAccessToken: !!this.accessToken,
    });

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    logger.info("API response received", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: {
        error: {
          message: string;
          type?: string;
          code?: number;
          fbtrace_id?: string;
        };
      };

      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      logger.error(
        `[MetaAPIClient] API Error:`,
        new Error(errorData.error?.message || "Unknown error"),
        errorData
      );

      throw new MetaAPIError(
        response.status,
        response.statusText,
        errorData.error || { message: "Unknown error" }
      );
    }

    const data = await response.json();

    // Log response structure
    logger.info("API response data structure", {
      hasData: !!data.data,
      dataType: Array.isArray(data.data) ? "array" : typeof data.data,
      dataLength: Array.isArray(data.data) ? data.data.length : undefined,
      hasPaging: !!data.paging,
      hasError: !!data.error,
    });

    // For single object responses (not wrapped in data property)
    if (!data.data && !data.error) {
      return { data } as APIResponse<T>;
    }

    return data;
  }

  /**
   * Handle paginated requests
   */
  async *getPaginatedData<T>(
    initialUrl: string
  ): AsyncGenerator<T[], void, unknown> {
    let url: string | undefined = initialUrl;
    let pageNumber = 0;

    logger.info("Starting pagination", { initialUrl });

    while (url) {
      pageNumber++;
      logger.info("Fetching page", { pageNumber, url });

      const response: APIResponse<T[]> = await this.makeRequest<T[]>(url);

      // Log response details
      logger.info("Page response received", {
        pageNumber,
        hasData: !!response.data,
        dataLength: response.data?.length || 0,
        hasPaging: !!response.paging,
        hasNext: !!response.paging?.next,
        nextUrl: response.paging?.next?.substring(0, 100) || "none",
      });

      if (response.data && response.data.length > 0) {
        yield response.data;
      } else {
        logger.warn("Empty page received", { pageNumber });
      }

      url = response.paging?.next;

      if (!url) {
        logger.info("Pagination complete - no more pages", {
          totalPages: pageNumber,
        });
      }
    }
  }
}

/**
 * Meta API Error
 */
export class MetaAPIError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    public errorData?: {
      message: string;
      type?: string;
      code?: number;
      fbtrace_id?: string;
    }
  ) {
    super(
      `Meta API error: ${statusCode} ${statusText}${errorData ? ` - ${errorData.message}` : ""}`
    );
    this.name = "MetaAPIError";
  }
}
