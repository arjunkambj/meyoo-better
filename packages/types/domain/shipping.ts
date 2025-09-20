import type { Id } from "@repo/convex/dataModel";

// Shipping types
export type ShippingCalculationType =
  | "flat_rate"
  | "weight_based"
  | "price_based"
  | "distance_based"
  | "carrier_calculated";

export interface ShippingCost {
  _id: Id<"costs">;
  organizationId: string;

  // Configuration name
  name: string;
  description?: string;

  // Calculation method
  calculationType: ShippingCalculationType;

  // Base configuration
  baseRate?: number;
  freeShippingThreshold?: number;

  // Weight-based tiers
  weightTiers?: WeightTier[];

  // Price-based tiers
  priceTiers?: PriceTier[];

  // Geographic zones
  zones?: ShippingZone[];

  // Carrier integration
  carrier?: string;
  serviceLevel?: string;

  // Priority
  priority: number;

  // Status
  isActive: boolean;
  isDefault: boolean;

  // Metadata
  updatedAt?: string;
}

export interface WeightTier {
  minWeight: number;
  maxWeight?: number;
  cost: number;
  unit: string;
}

export interface PriceTier {
  minPrice: number;
  maxPrice?: number;
  cost: number;
  costType: "flat" | "percentage";
}

export interface ShippingZone {
  name: string;
  countries: string[];
  multiplier: number;
}
