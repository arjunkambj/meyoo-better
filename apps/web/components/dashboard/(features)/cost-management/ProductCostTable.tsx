"use client";

import {
  Button,
  Chip,
  Input,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState, type ComponentProps, type ReactElement } from "react";
import { sanitizeDecimal } from "@/components/shared/table/sanitize";

import {
  useCurrentUser,
  useSaveVariantCosts,
  useShopifyProductVariantsPaginated,
} from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";
import {
  DATA_TABLE_GROUP_ROW_BORDER_CLASS,
  DATA_TABLE_HEADER_CLASS,
  DATA_TABLE_INPUT_CLASS,
  DATA_TABLE_INPUT_WRAPPER_CLASS,
  DATA_TABLE_ROW_BASE_BG,
  DATA_TABLE_ROW_STRIPE_BG,
  DATA_TABLE_ROW_STRIPE_CHILD_BG,
  DATA_TABLE_TABLE_CLASS,
} from "@/components/shared/table/DataTableCard";
import { cn } from "@/libs/utils";

type TableCellElement = ReactElement<ComponentProps<typeof TableCell>>;

type RowEdit = {
  cogs?: string;
  handling?: string;
  tax?: string;
};

type VariantRow = {
  _id: string;
  productName?: string;
  productStatus?: string;
  productImage?: string;
  title?: string;
  sku?: string;
  price?: number;
  costPerItem?: number;
  taxRate?: number;
  handlingPerUnit?: number;
};

export default function ProductCostTable() {
  const user = useCurrentUser();
  const currency = user?.primaryCurrency || "USD";
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const [page, setPage] = useState(1);
  const pageSize = 200; // smaller page keeps DOM manageable while grouping
  const {
    data: variantData,
    totalPages,
    loading,
  } = useShopifyProductVariantsPaginated(
    page,
    pageSize,
    undefined
  );

  const variants = useMemo<VariantRow[]>(
    () => (Array.isArray(variantData) ? (variantData as VariantRow[]) : []),
    [variantData],
  );

  const variantGroups = useMemo(() => {
    if (!variants.length) {
      return [] as Array<{
        key: string;
        productName: string;
        productImage?: string;
        productStatus?: string;
        items: VariantRow[];
      }>;
    }

    const map = new Map<
      string,
      {
        key: string;
        productName: string;
        productImage?: string;
        productStatus?: string;
        items: VariantRow[];
      }
    >();

    variants.forEach((variant) => {
      const productName = variant.productName || "Product";
      const productImage = variant.productImage || "";
      const key = `${productName}__${productImage}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          productName,
          productImage,
          productStatus: variant.productStatus,
          items: [],
        });
      }

      map.get(key)!.items.push(variant);
    });

    return Array.from(map.values());
  }, [variants]);

  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupEdits, setGroupEdits] = useState<Record<string, RowEdit>>({});
  const [bulkPct, setBulkPct] = useState<string>("10");
  const saveAll = useSaveVariantCosts();
  const [savingAll, setSavingAll] = useState(false);

  // sanitizeDecimal shared via components/shared/table/sanitize

  // Row-level save removed; use bulk save instead

  const handleSaveAll = async () => {
    const variantIds = Object.keys(edits);
    if (variantIds.length === 0) return;
    setSavingAll(true);
    try {
      const costs = variantIds.map((id) => {
        const e = edits[id];
        return {
          variantId: id,
          cogsPerUnit:
            e?.cogs !== undefined && e.cogs !== "" ? Number(e.cogs) : undefined,
          taxPercent:
            e?.tax !== undefined && e.tax !== "" ? Number(e.tax) : undefined,
          handlingPerUnit:
            e?.handling !== undefined && e.handling !== ""
              ? Number(e.handling)
              : undefined,
        };
      });
      const filtered = costs.filter(
        (c) =>
          c.cogsPerUnit !== undefined ||
          c.taxPercent !== undefined ||
          c.handlingPerUnit !== undefined
      );
      if (filtered.length > 0) {
        await saveAll(filtered);
      }
    } finally {
      setSavingAll(false);
    }
  };

  const topContent = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-xl font-semibold">Product Costs</h2>
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="md"
          className="w-36"
          classNames={{
            inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
            input: DATA_TABLE_INPUT_CLASS,
          }}
          type="number"
          placeholder="10"
          endContent={<span className="text-default-500">%</span>}
          value={bulkPct}
          onValueChange={setBulkPct}
        />
        <Button
          variant="flat"
          color="primary"
          isDisabled={!bulkPct || isNaN(Number(bulkPct))}
          onPress={() => {
            if (!variants.length || !bulkPct) return;
            const pct = Number(bulkPct);
            setEdits((prev) => {
              const next = { ...prev } as Record<string, RowEdit>;
              variants.forEach((v) => {
                const id = String(v._id);
                const original = (
                  prev[id]?.cogs ??
                  v.costPerItem ??
                  ""
                ).toString();
                const originalVal = Number(original || 0);
                if (!isFinite(originalVal) || originalVal === 0) {
                  const price = Number(v.price ?? 0) || 0;
                  const computed = (price * pct) / 100;
                  const fixed = isFinite(computed)
                    ? computed.toFixed(2)
                    : "0.00";
                  next[id] = { ...(next[id] || {}), cogs: fixed };
                }
              });
              return next;
            });
          }}
        >
          Apply COGS
        </Button>
        <Button
          variant="flat"
          color="secondary"
          isDisabled={!bulkPct || isNaN(Number(bulkPct))}
          onPress={() => {
            if (!variants.length || !bulkPct) return;
            const pct = Number(bulkPct);
            setEdits((prev) => {
              const next = { ...prev } as Record<string, RowEdit>;
              variants.forEach((v) => {
                const id = String(v._id);
                next[id] = { ...(next[id] || {}), tax: String(pct) };
              });
              return next;
            });
          }}
        >
          Apply Tax
        </Button>
        <Button
          variant="flat"
          isDisabled={!bulkPct || isNaN(Number(bulkPct))}
          onPress={() => {
            if (!variants.length || !bulkPct) return;
            const pct = Number(bulkPct);
            setEdits((prev) => {
              const next = { ...prev } as Record<string, RowEdit>;
              variants.forEach((v) => {
                const id = String(v._id);
                const price = Number(v.price ?? 0) || 0;
                const computed = (price * pct) / 100;
                const fixed = isFinite(computed)
                  ? computed.toFixed(2)
                  : "0.00";
                next[id] = { ...(next[id] || {}), handling: fixed };
              });
              return next;
            });
          }}
        >
          Apply Handling
        </Button>
        <Button
          color="primary"
          isLoading={savingAll}
          onPress={handleSaveAll}
        >
          Save All Changes
        </Button>
      </div>
    </div>
  );

  const paginationContent =
    !loading && totalPages > 1 ? (
      <div className="flex justify-center">
        <Pagination
          page={page}
          total={totalPages}
          showControls
          onChange={setPage}
        />
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {topContent}
      <Table
        removeWrapper
        aria-label="Product costs table"
        className={DATA_TABLE_TABLE_CLASS}
        classNames={{
          th: DATA_TABLE_HEADER_CLASS,
          td: "py-2.5 px-3 text-sm text-default-700 align-middle",
          table: "text-xs",
        }}
      >
        <TableHeader>
          <TableColumn>Variant</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>COGS</TableColumn>
          <TableColumn>Tax</TableColumn>
          <TableColumn>Handling</TableColumn>
          <TableColumn>Price</TableColumn>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 rounded-md" />
                </TableCell>
              </TableRow>
            ))
          ) : variants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="p-4 text-center text-default-500 text-sm">
                  No variants found
                </div>
              </TableCell>
            </TableRow>
          ) : (
            // Group by product with collapsible sections
            (() => {
              return variantGroups.flatMap((grp, grpIndex) => {
                const count = grp.items.length;
                const isOpen = expandedGroups.has(grp.key);
                const s = String(grp.productStatus || "").toLowerCase();
                const statusChipColor: "default" | "success" | "warning" =
                  s === "active" ? "success" : s ? "warning" : "default";
                const img = grp.productImage || "";
                const avgPrice =
                  count > 0
                    ? grp.items.reduce(
                        (sum, v) => sum + (Number(v.price ?? 0) || 0),
                        0
                      ) / count
                    : 0;
                const stripe = grpIndex % 2 === 1;

                // Averages for default product-level inputs (respect pending edits)
                const avgFrom = (vals: Array<number | undefined>) => {
                  const nums = vals.filter(
                    (n): n is number => typeof n === "number" && isFinite(n)
                  );
                  if (nums.length === 0) return "";
                  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
                  return avg.toFixed(2);
                };
                const avgCogsStr = avgFrom(
                  grp.items.map((v) => {
                    const id = String(v._id);
                    const e = edits[id];
                    if (e && e.cogs !== undefined && e.cogs !== "")
                      return Number(e.cogs);
                    if (typeof v.costPerItem === "number")
                      return Number(v.costPerItem);
                    return undefined;
                  })
                );
                const avgTaxStr = avgFrom(
                  grp.items.map((v) => {
                    const id = String(v._id);
                    const e = edits[id];
                    if (e && e.tax !== undefined && e.tax !== "")
                      return Number(e.tax);
                    if (typeof v.taxRate === "number") return Number(v.taxRate);
                    return undefined;
                  })
                );
                const avgHandlingStr = avgFrom(
                  grp.items.map((v) => {
                    const id = String(v._id);
                    const e = edits[id];
                    if (e && e.handling !== undefined && e.handling !== "")
                      return Number(e.handling);
                    if (typeof v.handlingPerUnit === "number")
                      return Number(v.handlingPerUnit);
                    return undefined;
                  })
                );

                // Header cells aligned to table columns
                const headerCells: TableCellElement[] = [];
                headerCells.push(
                  <TableCell key="variant">
                    <div className="min-w-0 flex items-center gap-3 py-1">
                      <button
                        type="button"
                        className="flex-none text-default-500 hover:text-default-900 transition"
                        onClick={() => {
                          setExpandedGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(grp.key)) next.delete(grp.key);
                            else next.add(grp.key);
                            return next;
                          });
                        }}
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        <Icon
                          icon={
                            isOpen
                              ? "solar:alt-arrow-up-bold"
                              : "solar:alt-arrow-down-bold"
                          }
                          width={18}
                        />
                      </button>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={grp.productName}
                          className="w-8 h-8 rounded object-cover flex-none"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-default-100 flex items-center justify-center text-default-400 flex-none">
                          <Icon icon="solar:box-outline" width={16} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-default-900">
                          {grp.productName}
                        </div>
                        <div className="text-xs text-default-500">
                          {count} variant{count === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                );
                headerCells.push(
                  <TableCell key="status">
                    <Chip color={statusChipColor} size="sm" variant="flat">
                      {s ? s.charAt(0).toUpperCase() + s.slice(1) : "-"}
                    </Chip>
                  </TableCell>
                );
                headerCells.push(
                  <TableCell key="cogs">
                    <Input
                      aria-label="COGS (apply to all variants in product)"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      size="sm"
                      classNames={{
                        inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
                        input: DATA_TABLE_INPUT_CLASS,
                      }}
                      startContent={
                        <span className="text-default-500">
                          {currencySymbol}
                        </span>
                      }
                      placeholder="0.00"
                      value={groupEdits[grp.key]?.cogs ?? avgCogsStr}
                      onValueChange={(val) => {
                        const nextVal = sanitizeDecimal(val);
                        setGroupEdits((prev) => ({
                          ...prev,
                          [grp.key]: {
                            ...(prev[grp.key] || {}),
                            cogs: nextVal,
                          },
                        }));
                        setEdits((prev) => {
                          const next = { ...prev } as Record<string, RowEdit>;
                          grp.items.forEach((v) => {
                            const id = String(v._id);
                            next[id] = { ...(next[id] || {}), cogs: nextVal };
                          });
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                );
                headerCells.push(
                  <TableCell key="tax">
                    <Input
                      aria-label="Tax (apply to all variants in product)"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.01"
                      size="sm"
                      classNames={{
                        inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
                        input: DATA_TABLE_INPUT_CLASS,
                      }}
                      endContent={<span className="text-default-500">%</span>}
                      placeholder="0"
                      value={groupEdits[grp.key]?.tax ?? avgTaxStr}
                      onValueChange={(val) => {
                        const nextVal = sanitizeDecimal(val);
                        setGroupEdits((prev) => ({
                          ...prev,
                          [grp.key]: { ...(prev[grp.key] || {}), tax: nextVal },
                        }));
                        setEdits((prev) => {
                          const next = { ...prev } as Record<string, RowEdit>;
                          grp.items.forEach((v) => {
                            const id = String(v._id);
                            next[id] = { ...(next[id] || {}), tax: nextVal };
                          });
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                );
                headerCells.push(
                  <TableCell key="handling">
                    <Input
                      aria-label="Handling & Overheads (apply to all variants in product)"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      size="sm"
                      classNames={{
                        inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
                        input: DATA_TABLE_INPUT_CLASS,
                      }}
                      startContent={
                        <span className="text-default-500">
                          {currencySymbol}
                        </span>
                      }
                      placeholder="0"
                      value={groupEdits[grp.key]?.handling ?? avgHandlingStr}
                      onValueChange={(val) => {
                        const nextVal = sanitizeDecimal(val);
                        setGroupEdits((prev) => ({
                          ...prev,
                          [grp.key]: {
                            ...(prev[grp.key] || {}),
                            handling: nextVal,
                          },
                        }));
                        setEdits((prev) => {
                          const next = { ...prev } as Record<string, RowEdit>;
                          grp.items.forEach((v) => {
                            const id = String(v._id);
                            next[id] = {
                              ...(next[id] || {}),
                              handling: nextVal,
                            };
                          });
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                );
                headerCells.push(
                  <TableCell key="price">
                    {currencySymbol}
                    {avgPrice.toFixed(2)}
                  </TableCell>
                );

                const header = (
                  <TableRow
                    key={`grp-h-${grp.key}`}
                    className={cn(
                      stripe ? DATA_TABLE_ROW_STRIPE_BG : DATA_TABLE_ROW_BASE_BG,
                      DATA_TABLE_GROUP_ROW_BORDER_CLASS,
                    )}
                  >
                    {headerCells}
                  </TableRow>
                );
                if (!isOpen) return [header];

                const children = grp.items.map((v) => {
                  const e = edits[String(v._id)] || {};
                  return (
                    <TableRow
                      key={String(v._id)}
                      className={cn(
                        DATA_TABLE_ROW_BASE_BG,
                        stripe && DATA_TABLE_ROW_STRIPE_CHILD_BG,
                      )}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate text-sm text-default-900">
                            {v.title || "Variant"}
                          </div>
                          <div className="text-xs text-default-500 truncate">
                            {v.sku || ""}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip color={statusChipColor} size="sm" variant="flat">
                          {s ? s.charAt(0).toUpperCase() + s.slice(1) : "-"}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label="COGS"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          size="sm"
                          classNames={{
                            inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
                            input: DATA_TABLE_INPUT_CLASS,
                          }}
                          startContent={
                            <span className="text-default-500">
                              {currencySymbol}
                            </span>
                          }
                          placeholder="0.00"
                          value={
                            e.cogs ??
                            (typeof v.costPerItem === "number"
                              ? String(v.costPerItem)
                              : "")
                          }
                          onValueChange={(val) => {
                            const nextVal = sanitizeDecimal(val);
                            setEdits((prev) => ({
                              ...prev,
                              [String(v._id)]: {
                                ...prev[String(v._id)],
                                cogs: nextVal,
                              },
                            }));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label="Tax"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.01"
                          size="sm"
                          classNames={{
                            inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
                            input: DATA_TABLE_INPUT_CLASS,
                          }}
                          endContent={
                            <span className="text-default-500">%</span>
                          }
                          placeholder="0"
                          value={
                            e.tax ??
                            (typeof v.taxRate === "number"
                              ? String(v.taxRate)
                              : "")
                          }
                          onValueChange={(val) => {
                            const nextVal = sanitizeDecimal(val);
                            setEdits((prev) => ({
                              ...prev,
                              [String(v._id)]: {
                                ...prev[String(v._id)],
                                tax: nextVal,
                              },
                            }));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label="Handling"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          size="sm"
                          classNames={{
                            inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
                            input: DATA_TABLE_INPUT_CLASS,
                          }}
                          startContent={
                            <span className="text-default-500">
                              {currencySymbol}
                            </span>
                          }
                          placeholder="0"
                          value={
                            e.handling ??
                            (typeof v.handlingPerUnit === "number"
                              ? String(v.handlingPerUnit)
                              : "")
                          }
                          onValueChange={(val) => {
                            const nextVal = sanitizeDecimal(val);
                            setEdits((prev) => ({
                              ...prev,
                              [String(v._id)]: {
                                ...prev[String(v._id)],
                                handling: nextVal,
                              },
                            }));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {currencySymbol}
                        {Number(v.price || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                });
                return [header, ...children];
              });
            })()
          )}
        </TableBody>
      </Table>
      {paginationContent}
      {/* CSV Import removed for this view */}
    </div>
  );
}
