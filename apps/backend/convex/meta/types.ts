export interface MetaAdAccount {
  id: string;
  name?: string;
  business_id?: string;
  business_name?: string;
  business?: {
    id: string;
    name?: string;
  };
  timezone_name?: string;
  timezone_offset_hours_utc?: number;
  account_status?: number;
  disable_reason?: number;
  spend_cap?: number | string;
  amount_spent?: number | string;
  currency?: string;
  accountStatus?: number;
  spendCap?: number | string;
  amountSpent?: number | string;
  timezone?: string;
}

export interface MetaAction {
  action_type?: string;
  value?: string | number;
}

export interface MetaInsight {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  unique_clicks?: string;
  inline_link_clicks?: string;
  outbound_clicks?: Array<{ action_type?: string; value: string }>;
  video_play_actions?: Array<{ action_type?: string; value: string }>;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  website_purchase_roas?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ value: string }>;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  cost_per_thruplay?: string;
  cost_per_thru_play?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  created_time?: string;
  updated_time?: string;
}

