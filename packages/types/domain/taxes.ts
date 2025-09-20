import type { Id } from "@repo/convex/dataModel";

// Tax types
export type TaxType = "sales_tax" | "vat" | "gst" | "hst" | "pst" | "custom";

export interface TaxRate {
  _id: Id<"costs">;
  organizationId: string;

  // Tax info
  name: string;
  description?: string;

  // Jurisdiction
  country: string;
  state?: string;
  city?: string;
  postalCode?: string;

  // Tax type
  taxType: TaxType;

  // Rate
  rate: number;

  // Compound rates
  components?: TaxComponent[];

  // Product applicability
  appliesToAllProducts: boolean;
  productCategories?: string[];
  exemptCategories?: string[];

  // Thresholds
  nexusThreshold?: number;
  registrationRequired: boolean;

  // Auto-calculation
  useProvider: boolean;
  provider?: string;

  // Status
  isActive: boolean;
  effectiveFrom: number;
  effectiveTo?: number;

  // Metadata
  updatedAt?: string;
}

export interface TaxComponent {
  name: string;
  rate: number;
  order: number;
}
