/**
 * Common DTO interfaces shared across integrations
 */

export interface BaseResponseDTO {
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface ErrorResponseDTO extends BaseResponseDTO {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponseDTO<T> extends BaseResponseDTO {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface SyncSessionDTO {
  sessionId: string;
  platform: "meta" | "shopify";
  status: "pending" | "processing" | "syncing" | "completed" | "failed";
  type: string;
  startedAt: string;
  completedAt?: string;
  recordsProcessed?: number;
  recordsFailed?: number;
  error?: string;
}

export interface DateRangeDTO {
  startDate: string;
  endDate: string;
}

export interface MetricsDTO {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerConversion: number;
  roas: number;
}

export interface CurrencyAmountDTO {
  amount: number;
  currency: string;
}
