export const META_CONFIG = {
  API_VERSION: process.env.NEXT_PUBLIC_META_API_VERSION || "v21.0",
  BASE_URL: "https://graph.facebook.com",

  // Valid sync types
  SYNC_TYPES: {
    FULL: "full",
    INCREMENTAL: "incremental",
    INSIGHTS: "insights",
  } as const,

  // Insights fields grouped by category
  INSIGHTS_FIELDS: {
    BASIC: [
      "account_id",
      "account_name",
      "spend",
      "impressions",
      "reach",
      "frequency",
    ],
    ENGAGEMENT: ["clicks", "unique_clicks", "ctr", "cpc", "cpm", "cpp"],
    CONVERSIONS: [
      "conversions",
      "conversion_values",
      "cost_per_conversion",
      "purchase_roas",
      "website_purchase_roas",
      "mobile_app_purchase_roas",
    ],
    ACTIONS: [
      "action_values",
      "actions",
      "cost_per_action_type",
      "inline_link_clicks",
      "inline_link_click_ctr",
      "cost_per_inline_link_click",
    ],
    VIDEO: [
      "cost_per_thruplay",
      "video_play_actions",
      "video_thruplay_watched_actions",
      "video_30_sec_watched_actions",
      "video_p25_watched_actions",
      "video_p50_watched_actions",
      "video_p75_watched_actions",
      "video_p95_watched_actions",
      "video_p100_watched_actions",
      "video_avg_time_watched_actions",
      "video_play_curve_actions",
    ],
    CATALOG: [
      "catalog_segment_actions",
      "catalog_segment_value",
      "catalog_segment_value_mobile_purchase_roas",
      "catalog_segment_value_omni_purchase_roas",
      "catalog_segment_value_website_purchase_roas",
    ],
    QUALITY: [
      "conversion_rate_ranking",
      "quality_ranking",
      "engagement_rate_ranking",
    ],
    OTHER: [
      "cost_per_unique_click",
      "outbound_clicks",
      "outbound_clicks_ctr",
      "instant_experience_clicks_to_open",
      "instant_experience_clicks_to_start",
      "instant_experience_outbound_clicks",
      "dda_results",
      "estimated_ad_recall_rate",
      "estimated_ad_recallers",
      "full_view_impressions",
      "full_view_reach",
    ],
  },

  // Effective status values
  EFFECTIVE_STATUS: [
    "ACTIVE",
    "PAUSED",
    "DELETED",
    "PENDING_REVIEW",
    "DISAPPROVED",
    "PREAPPROVED",
    "PENDING_BILLING_INFO",
    "CAMPAIGN_PAUSED",
    "ARCHIVED",
    "ADSET_PAUSED",
    "IN_PROCESS",
    "WITH_ISSUES",
  ],

  // Date presets
  DATE_PRESETS: {
    TODAY: "today",
    YESTERDAY: "yesterday",
    THIS_WEEK: "this_week_mon_today",
    LAST_WEEK: "last_week_mon_sun",
    THIS_MONTH: "this_month",
    LAST_MONTH: "last_month",
    LAST_3_MONTHS: "last_3_months",
    LAST_7_DAYS: "last_7d",
    LAST_14_DAYS: "last_14d",
    LAST_28_DAYS: "last_28d",
    LAST_30_DAYS: "last_30d",
    LAST_90_DAYS: "last_90d",
    LAST_365_DAYS: "last_365d",
    LIFETIME: "lifetime",
    // Note: We limit initial sync data to 60 days for new users
    MAX_DAYS: 60,
  },

  // Breakdowns
  BREAKDOWNS: {
    AGE_GENDER: "age,gender",
    COUNTRY: "country",
    REGION: "region",
    DMA: "dma",
    DEVICE_PLATFORM: "device_platform",
    PUBLISHER_PLATFORM: "publisher_platform",
    IMPRESSION_DEVICE: "impression_device",
  },

  // Action breakdowns
  ACTION_BREAKDOWNS: {
    TYPE: "action_type",
    TARGET: "action_target_id",
    DESTINATION: "action_destination",
    DEVICE: "action_device",
  },

  // Rate limits (requests per hour)
  RATE_LIMITS: {
    USER_CALLS: 200,
    APP_CALLS: 200,
    BATCH_SIZE: 50,
  },

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 100,
    MAX_LIMIT: 500,
  },
} as const;

// Type exports
export type MetaSyncType =
  (typeof META_CONFIG.SYNC_TYPES)[keyof typeof META_CONFIG.SYNC_TYPES];
export type MetaDatePreset =
  (typeof META_CONFIG.DATE_PRESETS)[keyof typeof META_CONFIG.DATE_PRESETS];
export type MetaEffectiveStatus = (typeof META_CONFIG.EFFECTIVE_STATUS)[number];

// Helper function to get all insights fields
export function getAllInsightsFields(): string[] {
  return [
    ...META_CONFIG.INSIGHTS_FIELDS.BASIC,
    ...META_CONFIG.INSIGHTS_FIELDS.ENGAGEMENT,
    ...META_CONFIG.INSIGHTS_FIELDS.CONVERSIONS,
    ...META_CONFIG.INSIGHTS_FIELDS.ACTIONS,
    ...META_CONFIG.INSIGHTS_FIELDS.VIDEO,
    ...META_CONFIG.INSIGHTS_FIELDS.CATALOG,
    ...META_CONFIG.INSIGHTS_FIELDS.QUALITY,
    ...META_CONFIG.INSIGHTS_FIELDS.OTHER,
  ];
}
