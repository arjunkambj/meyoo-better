"use client";

import { TableCell } from "@heroui/table";
import { Icon } from "@iconify/react";
import React from "react";

export function ProductGroupFirstCell({
  productImage,
  productName,
  variantCount,
  isOpen,
  onToggle,
}: {
  productImage?: string;
  productName: string;
  variantCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <TableCell>
      <div className="min-w-0 flex items-center gap-3 py-1">
        <button
          type="button"
          className="flex-none text-default-500 hover:text-default-900 transition"
          onClick={onToggle}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <Icon icon={isOpen ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} width={18} />
        </button>
        {productImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={productImage} alt={productName} className="w-8 h-8 rounded object-cover flex-none" />
        ) : (
          <div className="w-8 h-8 rounded bg-default-100 flex items-center justify-center text-default-400 flex-none">
            <Icon icon="solar:box-outline" width={16} />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-default-900">{productName}</div>
          <div className="text-xs text-default-500">{variantCount} variant{variantCount === 1 ? "" : "s"}</div>
        </div>
      </div>
    </TableCell>
  );
}
