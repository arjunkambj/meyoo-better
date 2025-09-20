import type { BaseResponseDTO } from "./common";

/**
 * Meta Connection DTOs
 */
export interface MetaConnectionStatusDTO {
  isConnected: boolean;
  businessId?: string;
  metaBusinessName?: string;
  userId?: string;
  userName?: string;
  lastSyncAt?: string;
  adAccountsCount?: number;
}

export interface MetaConnectionResponseDTO extends BaseResponseDTO {
  connection: MetaConnectionStatusDTO;
}

/**
 * Meta OAuth DTOs
 */
export interface MetaAuthRequestDTO {
  redirectUri?: string;
  state?: string;
}

export interface MetaAuthResponseDTO extends BaseResponseDTO {
  authUrl: string;
  state: string;
}

export interface MetaCallbackRequestDTO {
  code: string;
  state?: string;
  error?: string;
  errorReason?: string;
  errorDescription?: string;
}

export interface MetaCallbackResponseDTO extends BaseResponseDTO {
  success: boolean;
  redirectUrl: string;
}

/**
 * Meta Disconnect DTOs
 */
export interface MetaDisconnectResponseDTO extends BaseResponseDTO {
  success: boolean;
  message: string;
}

/**
 * Meta Ad Accounts List DTOs
 */
export interface MetaAdAccountsRequestDTO {
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface MetaAdAccountsResponseDTO extends BaseResponseDTO {
  accounts: Array<{
    id: string;
    accountId: string;
    accountName: string;
    currency: string;
    status: string;
    isPrimary: boolean;
    isActive: boolean;
  }>;
  total: number;
}

/**
 * Meta Set Primary Account DTOs
 */
export interface MetaSetPrimaryAccountRequestDTO {
  accountId: string;
}

export interface MetaSetPrimaryAccountResponseDTO extends BaseResponseDTO {
  success: boolean;
  message: string;
}
