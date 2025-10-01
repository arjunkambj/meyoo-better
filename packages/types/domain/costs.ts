import type { Id } from '@repo/convex/dataModel';

export type CostType = 'shipping' | 'payment' | 'operational';

export type CostCalculation =
  | 'fixed'
  | 'percentage'
  | 'per_unit'
  | 'tiered'
  | 'weight_based'
  | 'formula';

export type CostFrequency =
  | 'one_time'
  | 'per_order'
  | 'per_item'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'percentage';

export interface Cost {
  _id: Id<'globalCosts'>;
  organizationId: string;
  userId?: Id<'users'>;
  type: CostType;
  name: string;
  description?: string;
  calculation: CostCalculation;
  value: number;
  frequency?: CostFrequency;
  isActive: boolean;
  isDefault: boolean;
  effectiveFrom: number;
  effectiveTo?: number;
  createdAt?: number;
  updatedAt?: number;
}

export type ShippingCost = Cost & {
  type: 'shipping';
};

export type PaymentFee = Cost & {
  type: 'payment';
};

export type OperationalExpense = Cost & {
  type: 'operational';
};
