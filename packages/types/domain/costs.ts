import type { Id } from "@repo/convex/dataModel";

// Cost type (based on costs table schema)
export interface Cost {
  _id: Id<"costs">;
  organizationId: string;
  userId: Id<"users">;
  type:
    | "product"
    | "shipping"
    | "payment"
    | "operational"
    | "tax"
    | "handling"
    | "marketing";
  name: string;
  description?: string;
  calculation:
    | "fixed"
    | "percentage"
    | "per_unit"
    | "tiered"
    | "weight_based"
    | "formula";
  value: number;
  frequency?:
    | "one_time"
    | "per_order"
    | "per_item"
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | "percentage";
  config?: {
    percentageFee?: number;
    fixedFee?: number;
    providerType?: string;
    [key: string]: unknown;
  };
  provider?: string;
  providerType?: string;
  applyTo?:
    | "all"
    | "specific_products"
    | "specific_categories"
    | "specific_orders"
    | "specific_channels";
  applyToIds?: string[];
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  effectiveFrom: number;
  effectiveTo?: number;
  createdAt?: number;
  updatedAt?: number;
}

// Expense types
export type ExpenseType = "fixed" | "variable" | "percentage" | "tiered";
export type ExpenseFrequency =
  | "one_time"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";
export type ExpenseCategoryType =
  | "cogs"
  | "shipping"
  | "marketing"
  | "operations"
  | "taxes"
  | "fees"
  | "other";

export interface ExpenseCategory {
  _id: Id<"costCategories">;
  organizationId: string;

  // Category info
  name: string;
  description?: string;
  icon?: string;
  color?: string;

  // Type
  type: ExpenseCategoryType;

  // Parent category for hierarchy
  parentId?: Id<"costCategories">;

  // Budget
  monthlyBudget?: number;
  yearlyBudget?: number;

  // Status
  isActive: boolean;
  isDefault: boolean;

  // Metadata
  updatedAt?: string;
}

export interface Expense {
  _id: Id<"costs">;
  organizationId: string;

  // Expense details
  name: string;
  description?: string;
  categoryId: Id<"costCategories">;

  // Amount
  amount: number;
  currency: string;

  // Type
  expenseType: ExpenseType;

  // Frequency
  frequency?: ExpenseFrequency;

  // Variable cost configuration
  variableConfig?: {
    perUnit?: number;
    percentage?: number;
    minimumCharge?: number;
    maximumCharge?: number;
  };

  // Date range
  effectiveFrom: number;
  effectiveTo?: number;

  // Application
  applyTo:
    | "all"
    | "specific_products"
    | "specific_orders"
    | "specific_channels";
  applyToIds?: string[];

  // Invoice/receipt
  invoiceNumber?: string;
  receiptUrl?: string;

  // Payment
  paymentStatus: "pending" | "paid" | "overdue" | "cancelled";
  paidAt?: string;
  dueDate?: string;

  // Vendor
  vendorName?: string;
  vendorId?: string;

  // Status
  isActive: boolean;
  isRecurring: boolean;

  // Metadata
  createdBy: Id<"users">;
  updatedAt?: string;
}

// Transaction fee types
export interface TransactionFee {
  _id: Id<"costs">;
  organizationId: string;

  // Provider info
  provider: string;
  providerType: "payment_processor" | "marketplace" | "platform";

  // Fee structure
  percentageFee: number;
  fixedFee: number;
  currency: string;

  // International fees
  internationalPercentageFee?: number;
  internationalFixedFee?: number;

  // Additional fees
  chargebackFee?: number;
  refundFee?: number;
  disputeFee?: number;

  // Volume discounts
  volumeTiers?: VolumeTier[];

  // Application
  paymentMethods?: string[];

  // Status
  isActive: boolean;
  effectiveFrom: number;
  effectiveTo?: number;

  // Metadata
  updatedAt?: string;
}

export interface VolumeTier {
  minVolume: number;
  maxVolume?: number;
  percentageFee: number;
  fixedFee: number;
}

export interface CostBreakdown {
  materials?: number;
  labor?: number;
  overhead?: number;
  packaging?: number;
  other?: number;
}
