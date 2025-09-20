"use client";

import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import React from "react";

type CostsState = {
  cogsPercent: string;
  shippingCost: string; // per order
  shippingMode?: 'per_order' | 'per_item';
  shippingPerItem?: string;
  handlingPerItem?: string;
  paymentFeePercent: string;
  paymentFixedFee?: string;
  taxPercent: string;
  operatingCosts: string;
  salary?: string;
  monthlyExpenses?: string;
  gatewayFeePercent?: string;
};

interface CostsInputsProps {
  costs: CostsState;
  onCostsChange: (patch: Partial<CostsState>) => void;
  currencySymbol: string;
  hideCOGS?: boolean;
  hideShippingPerItem?: boolean;
  hideHandlingPerItem?: boolean;
  hideTax?: boolean;
}

export default function CostsInputs({ costs, onCostsChange, currencySymbol, hideCOGS, hideShippingPerItem, hideHandlingPerItem, hideTax }: CostsInputsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      {!hideCOGS && (
        <div>
          <Input
            isRequired
            endContent={
              <div className="flex items-center gap-1">
                <span className="text-default-400 text-small">%</span>
                <Tooltip
                  content="What percentage of your selling price is your cost? Typical: 20-40% for retail, 40-60% for wholesale"
                  placement="top"
                >
                  <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
                </Tooltip>
              </div>
            }
            label="Product Cost (COGS)"
            labelPlacement="outside"
            placeholder="25"
            value={costs.cogsPercent}
            onChange={(e) => onCostsChange({ cogsPercent: e.target.value })}
          />
        </div>
      )}

      {/* Shipping Defaults - Optional */}
      <div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            endContent={
              <Tooltip content="Average cost to ship one order to your customer" placement="top">
                <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
              </Tooltip>
            }
            label="Shipping per Order (Optional)"
            labelPlacement="outside"
            placeholder="20"
            startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
            value={costs.shippingCost}
            onChange={(e) => onCostsChange({ shippingCost: e.target.value, shippingMode: 'per_order' })}
          />
          {!hideShippingPerItem && (
            <Input
              endContent={
                <Tooltip content="Average shipping per item if you prefer per-item model" placement="top">
                  <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
                </Tooltip>
              }
              label="Shipping per Item (Optional)"
              labelPlacement="outside"
              placeholder="2"
              startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
              value={costs.shippingPerItem || ''}
              onChange={(e) => onCostsChange({ shippingPerItem: e.target.value, shippingMode: 'per_item' })}
            />
          )}
        </div>
      </div>

      {/* Payment Processing - Required */}
      <div>
        <Input
          isRequired
          endContent={
            <div className="flex items-center gap-1">
              <span className="text-default-400 text-small">%</span>
              <Tooltip
                content="Transaction fee charged by your payment processor (Shopify Payments: 2.9%, PayPal: 2.99%)"
                placement="top"
              >
                <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
              </Tooltip>
            </div>
          }
          label="Payment Processing Fee"
          labelPlacement="outside"
          placeholder="2.9"
          value={costs.paymentFeePercent}
          onChange={(e) => onCostsChange({ paymentFeePercent: e.target.value })}
        />
      </div>
      <div>
        <Input
          endContent={
            <Tooltip content="Fixed fee per transaction (e.g. $0.30 for Stripe)" placement="top">
              <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
            </Tooltip>
          }
          label="Payment Fixed Fee (Optional)"
          labelPlacement="outside"
          placeholder="0.30"
          startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
          value={costs.paymentFixedFee || ''}
          onChange={(e) => onCostsChange({ paymentFixedFee: e.target.value })}
        />
      </div>

      {/* Tax Rate - Optional */}
      {!hideTax && (
        <div>
          <Input
            endContent={
              <div className="flex items-center gap-1">
                <span className="text-default-400 text-small">%</span>
                <Tooltip content="Average sales tax rate if you collect taxes" placement="top">
                  <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
                </Tooltip>
              </div>
            }
            label="Tax Rate (Optional)"
            labelPlacement="outside"
            placeholder="12"
            value={costs.taxPercent}
            onChange={(e) => onCostsChange({ taxPercent: e.target.value })}
          />
        </div>
      )}

      {/* Salary - Optional */}
      <div>
        <Input
          endContent={
            <Tooltip content="Monthly salary or owner's draw" placement="top">
              <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
            </Tooltip>
          }
          label="Monthly Salary (Optional)"
          labelPlacement="outside"
          placeholder="3000"
          startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
          value={costs.salary || ''}
          onChange={(e) => onCostsChange({ salary: e.target.value })}
        />
      </div>

      {/* Monthly Expenses - Optional */}
      <div>
        <Input
          endContent={
            <Tooltip content="Other monthly expenses (rent, utilities, software)" placement="top">
              <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
            </Tooltip>
          }
          label="Monthly Expenses (Optional)"
          labelPlacement="outside"
          placeholder="1500"
          startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
          value={costs.monthlyExpenses || ''}
          onChange={(e) => onCostsChange({ monthlyExpenses: e.target.value })}
        />
      </div>

      {/* Gateway Fee - Optional */}
      <div>
        <Input
          endContent={
            <div className="flex items-center gap-1">
              <span className="text-default-400 text-small">%</span>
              <Tooltip content="Additional gateway or platform fees" placement="top">
                <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
              </Tooltip>
            </div>
          }
          label="Gateway Fee (Optional)"
          labelPlacement="outside"
          placeholder="0.5"
          value={costs.gatewayFeePercent || ''}
          onChange={(e) => onCostsChange({ gatewayFeePercent: e.target.value })}
        />
      </div>

      {/* Operating Costs - Full Width - Optional */}
      <div className="sm:col-span-2">
        <Input
          endContent={
            <Tooltip content="Total fixed monthly operating costs (auto-calculated if salary and expenses are provided)" placement="top">
              <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
            </Tooltip>
          }
          label="Total Monthly Operating Costs (Optional)"
          labelPlacement="outside"
          placeholder="5000"
          startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
          value={costs.operatingCosts}
          onChange={(e) => onCostsChange({ operatingCosts: e.target.value })}
        />
      </div>

      {!hideHandlingPerItem && (
        <div className="sm:col-span-2">
          <Input
            endContent={
              <Tooltip content="Per item handling/overhead (packaging, pick/pack)" placement="top">
                <Icon className="text-default-400 text-sm cursor-help" icon="solar:info-circle-linear" />
              </Tooltip>
            }
            label="Handling per Item (Optional)"
            labelPlacement="outside"
            placeholder="0.50"
            startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
            value={costs.handlingPerItem || ''}
            onChange={(e) => onCostsChange({ handlingPerItem: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
