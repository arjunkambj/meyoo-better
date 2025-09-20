import type { BaseResponseDTO, DateRangeDTO, SyncSessionDTO } from "./common";

/**
 * Meta Sync Request DTOs
 */
export interface MetaSyncRequestDTO {
  adAccountId?: string;
  syncType: "full" | "incremental" | "campaigns" | "insights";
}

export interface MetaSyncResponseDTO extends BaseResponseDTO {
  syncSessionId: string;
  message: string;
}

/**
 * Meta Sync Status DTOs
 */
export interface MetaSyncStatusRequestDTO {
  sessionId: string;
}

export interface MetaSyncStatusResponseDTO extends BaseResponseDTO {
  status: SyncSessionDTO;
}

/**
 * Meta Account DTOs
 */
export interface MetaAdAccountDTO {
  id: string;
  accountId: string;
  accountName: string;
  currency: string;
  timezone?: string;
  status?: string;
  isPrimary?: boolean;
  isActive: boolean;
  totalSpend?: number;
  totalRevenue?: number;
  accountRoas?: number;
  lastSyncAt?: string;
}

export interface MetaAccountInsightsDTO {
  accountId: string;
  date: string;
  spend: number;
  impressions: number;
  reach?: number;
  frequency?: number;
  clicks: number;
  uniqueClicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  cpp?: number;
  conversions?: number;
  conversionValue?: number;
  costPerConversion?: number;
  purchaseRoas?: number;
  actions?: Array<{
    actionType: string;
    value: number;
  }>;
  actionValues?: Array<{
    actionType: string;
    value: number;
  }>;
}

/**
 * Meta Campaign DTOs
 */
export interface MetaCampaignDTO {
  id: string;
  campaignId: string;
  campaignName: string;
  objective?: string;
  status: string;
  effectiveStatus: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  startTime?: string;
  stopTime?: string;
  createdTime: string;
  updatedTime?: string;
}

/**
 * Meta Ad Set DTOs
 */
export interface MetaAdSetDTO {
  id: string;
  adSetId: string;
  adSetName: string;
  campaignId: string;
  status: string;
  effectiveStatus: string;
  optimizationGoal?: string;
  billingEvent?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  startTime?: string;
  endTime?: string;
  createdTime: string;
  updatedTime?: string;
}

/**
 * Meta Ad DTOs
 */
export interface MetaAdDTO {
  id: string;
  adId: string;
  adName: string;
  adSetId: string;
  status: string;
  effectiveStatus: string;
  creativeId?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  createdTime: string;
  updatedTime?: string;
}

/**
 * Meta Insights DTOs
 */
export interface MetaInsightsRequestDTO {
  accountId: string;
  dateRange:
    | {
        startDate: string;
        endDate: string;
      }
    | {
        preset: string;
      };
  level: "account" | "campaign" | "adset" | "ad";
  breakdowns?: string[];
  fields?: string[];
}

export interface MetaInsightsResponseDTO extends BaseResponseDTO {
  insights: MetaAccountInsightsDTO[];
  summary?: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCtr: number;
    averageCpc: number;
    averageRoas: number;
  };
}

/**
 * Meta sync options
 */
export interface MetaSyncOptions {
  /**
   * Date range for the sync
   */
  dateRange?: DateRangeDTO;

  /**
   * Metrics to sync
   */
  metrics?: string[];

  /**
   * Breakdowns for data segmentation
   */
  breakdowns?: string[];

  /**
   * Sync types to execute
   */
  syncTypes?: {
    insights?: boolean;
    campaigns?: boolean;
    adSets?: boolean;
    ads?: boolean;
  };

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}
