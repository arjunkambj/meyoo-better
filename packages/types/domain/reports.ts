// Report types
export type ReportType =
  | "sales_summary"
  | "profit_analysis"
  | "inventory_status"
  | "customer_insights"
  | "marketing_performance"
  | "product_performance"
  | "channel_analysis"
  | "expense_breakdown"
  | "tax_summary"
  | "custom";

export type ReportFormat = "pdf" | "excel" | "csv" | "dashboard";
export type ReportFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

// Note: Report-related interfaces have been removed as the report tables
// are not currently being used in the application. If reports feature
// is needed in the future, appropriate interfaces can be added back.
// The following types are kept for potential future use.
