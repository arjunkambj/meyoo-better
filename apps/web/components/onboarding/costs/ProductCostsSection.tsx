"use client";

import { Accordion, AccordionItem } from "@heroui/accordion";
import { Input } from "@heroui/input";
import { Skeleton } from "@heroui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Button } from "@heroui/react";
import { Tooltip } from "@heroui/tooltip";
import { Icon } from "@iconify/react";
import Image from "next/image";
import React, { useMemo } from "react";

type Product = {
  id: string;
  shopifyId: string;
  title: string;
  price: number;
  imageUrl?: string;
  sku?: string;
};

interface ProductCostsSectionProps {
  products: Product[];
  productCosts: Record<string, number>;
  onChangeById: (id: string, value: number) => void;
  currencySymbol: string;
  isLoading: boolean;
  productsOpen: boolean;
  setProductsOpen: (open: boolean) => void;
  onApplyPercentageToAll: (pct: number) => void;
}

export default function ProductCostsSection({
  products,
  productCosts,
  onChangeById,
  currencySymbol,
  isLoading,
  productsOpen,
  setProductsOpen,
  onApplyPercentageToAll,
}: ProductCostsSectionProps) {
  const skeletonIndexes = useMemo(
    () => Array.from({ length: 8 }, (_, i) => i),
    []
  );

  return (
    <Accordion
      isCompact
      className="border border-default-200 px-4 py-2 mb-2 rounded-2xl"
      selectedKeys={productsOpen ? ["products"] : []}
      onSelectionChange={(keys) => {
        // HeroUI provides a Set<string> for selected keys in single mode
        const open = Array.from(keys as Set<string>).includes("products");
        setProductsOpen(open);
      }}
    >
      <AccordionItem
        aria-label="Products"
        classNames={{ content: "px-0" }}
        key="products"
        subtitle={
          <span className="text-default-500 text-xs">
            Optional: fine-tune specific product costs
          </span>
        }
        title={
          <div className="flex items-center gap-2">
            <Icon
              className="text-primary text-base"
              icon="solar:box-bold-duotone"
            />
            <span className="text-sm font-medium">Product-level Overrides</span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-default-500">
              Set per-product cost to improve accuracy
            </div>
            <div className="flex items-center gap-2">
              <Tooltip
                content="Apply percentage of price as cost to all products"
                placement="top"
              >
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => onApplyPercentageToAll(30)}
                >
                  Quick apply: 30%
                </Button>
              </Tooltip>
            </div>
          </div>

          <div className="rounded-xl border border-default-100 overflow-hidden">
            <Table aria-label="Products cost table" removeWrapper>
              <TableHeader>
                <TableColumn>Product</TableColumn>
                <TableColumn>Price</TableColumn>
                <TableColumn>Cost</TableColumn>
              </TableHeader>
              <TableBody emptyContent={isLoading ? undefined : "No products"}>
                {isLoading
                  ? skeletonIndexes.map((i) => (
                      <TableRow key={`sk-${i}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="w-6 h-6 rounded" />
                            <div className="space-y-1">
                              <Skeleton className="h-3 w-40 rounded" />
                              <Skeleton className="h-3 w-24 rounded" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3 w-14 rounded" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-28 rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  : products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.imageUrl && (
                              <Image
                                alt={product.title}
                                className="w-6 h-6 rounded object-cover"
                                width={24}
                                height={24}
                                src={product.imageUrl}
                              />
                            )}
                            <div>
                              <p className="font-medium text-xs">
                                {product.title}
                              </p>
                              {product.sku && (
                                <p className="text-xs text-default-500">
                                  SKU: {product.sku}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">
                            {currencySymbol}
                            {product.price.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            classNames={{
                              inputWrapper: "h-8",
                              input: "text-xs",
                            }}
                            placeholder={`${(product.price * 0.3).toFixed(2)}`}
                            size="sm"
                            startContent={
                              <span className="text-default-400 text-xs">
                                {currencySymbol}
                              </span>
                            }
                            value={productCosts[product.id]?.toString() || ""}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value) || 0;
                              onChangeById(product.id, parsed);
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
