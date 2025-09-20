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
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";

import {
  useShopifyProductVariantsPaginated,
  useUpsertProductCostComponents,
  useSaveProductCostComponents,
  useCurrentUser,
  useOnboarding,
} from "@/hooks";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import NavigationButtons from "@/components/onboarding/NavigationButtons";
import { getCurrencySymbol } from "@/libs/utils/format";
import { sanitizeDecimal } from "@/components/shared/table/sanitize";
import { NumericInput } from "@/components/shared/table/NumericInput";

type RowEdit = {
  cogs?: string;
  handling?: string;
  shipping?: string;
  tax?: string;
  paymentFeePercent?: string;
  paymentFixedPerItem?: string;
};

type VariantRow = {
  _id: string;
  productName?: string;
  productStatus?: string;
  productImage?: string;
  imageUrl?: string;
  image?: string;
  title?: string;
  sku?: string;
  price?: number;
  costPerItem?: number;
  taxRate?: number;
  handlingPerUnit?: number;
};

export default function VariantCostsClient({
  hideNavigation = false,
  hideShipping = false,
  hideHandling = false,
  hideSearch = false,
  hideRowSave = false,
  compact = true,
  hideTitle = false,
}: {
  hideNavigation?: boolean;
  hideShipping?: boolean;
  hideHandling?: boolean;
  hideSearch?: boolean;
  hideRowSave?: boolean;
  compact?: boolean;
  hideTitle?: boolean;
} = {}) {
  const router = useRouter();
  const user = useCurrentUser();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 1000;
  const [bulkPct, setBulkPct] = useState<string>("10");
  const { data, totalPages, loading } = useShopifyProductVariantsPaginated(
    page,
    pageSize,
    hideSearch ? undefined : search
  );
  const upsert = useUpsertProductCostComponents();
  const saveAll = useSaveProductCostComponents();

  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  const currency = user?.primaryCurrency || "USD";
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);
  const { status } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupEdits, setGroupEdits] = useState<Record<string, RowEdit>>({});

  // Build robust column list to avoid invalid children under TableHeader
  const columns = useMemo(() => {
    const cols: Array<{ key: string; label: string }> = [
      { key: "variant", label: "Variant" },
    ];
    if (hideRowSave) cols.push({ key: "channel", label: "Channel" });
    cols.push({ key: "status", label: "Status" });
    cols.push({ key: "cogs", label: "COGS" });
    cols.push({ key: "tax", label: "Tax" });
    if (!hideHandling)
      cols.push({ key: "handling", label: "Handling & Overheads" });
    if (!hideShipping) cols.push({ key: "shipping", label: "Shipping" });
    cols.push({ key: "price", label: "Price" });
    if (!hideRowSave) cols.push({ key: "save", label: "Save" });
    return cols;
  }, [hideRowSave, hideHandling, hideShipping]);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("products");
  }, []);

  // sanitizeDecimal shared via components/shared/table/sanitize

  // Guard: ensure Shopify is connected and subscription active; otherwise route to the proper step
  useEffect(() => {
    if (!status) return;
    if (!status.connections?.shopify) {
      router.replace("/onboarding/shopify");
    } else if (!status.hasShopifySubscription) {
      router.replace("/onboarding/billing");
    }
  }, [status, router]);

  // Grouping is always enabled; fetch a large page for smoother UX

  // Group variants by product (best-effort using productName + image)
  const grouped = useMemo(() => {
    const list = (data || []) as VariantRow[];
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
    for (const v of list) {
      const productName = v.productName || "Product";
      const productImage = v.productImage || v.imageUrl || v.image || "";
      const key = `${productName}__${productImage}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          productName,
          productImage,
          productStatus: v.productStatus,
          items: [],
        });
      }
      map.get(key)!.items.push(v);
    }
    return Array.from(map.values());
  }, [data]);

  const handleSaveRow = async (variantId: string) => {
    const e = edits[variantId];
    if (!e) return;
    try {
      await upsert({
        variantId,
        cogsPerUnit:
          e.cogs !== undefined && e.cogs !== "" ? Number(e.cogs) : undefined,
        taxPercent:
          e.tax !== undefined && e.tax !== "" ? Number(e.tax) : undefined,
        handlingPerUnit:
          !hideHandling && e.handling !== undefined && e.handling !== ""
            ? Number(e.handling)
            : undefined,
        shippingPerUnit:
          !hideShipping && e.shipping !== undefined && e.shipping !== ""
            ? Number(e.shipping)
            : undefined,
        // Payment and Shipping are global (single) and edited elsewhere
      });
      // No per-row toast; aggregate feedback on Continue
    } catch (_error) {
      // swallow; navigation will be prevented by onNext if save fails
    }
  };

  return (
    <div className="space-y-6">
      {!hideTitle ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-2">
            <Icon
              icon="solar:box-minimalistic-bold"
              className="text-primary mt-1"
            />
            <div>
              <h2 className="text-xl font-semibold">Variant Costs</h2>
              <p className="text-xs text-default-500">
                Set COGS for accurate profit calculation.
              </p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {!hideSearch &&
              (loading ? (
                <Skeleton className="h-9 w-48 rounded-lg" />
              ) : (
                <Input
                  size={compact ? "sm" : "md"}
                  className="max-w-[12rem]"
                  placeholder="Search..."
                  startContent={<Icon icon="solar:search-outline" width={16} />}
                  value={search}
                  onValueChange={setSearch}
                />
              ))}
            {/* Compact bulk % editor */}
            <Input
              size={compact ? "sm" : "md"}
              className="w-48"
              type="number"
              placeholder="10"
              endContent={<span className="text-default-500">%</span>}
              value={bulkPct}
              onValueChange={setBulkPct}
            />
            <Button
              size={compact ? "sm" : "md"}
              variant="flat"
              color="primary"
              isDisabled={!bulkPct || isNaN(Number(bulkPct))}
              onPress={() => {
                if (!data || !bulkPct) return;
                const pct = Number(bulkPct);
                setEdits((prev) => {
                  const next = { ...prev } as Record<string, RowEdit>;
                  (data as VariantRow[]).forEach((v) => {
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
                trackOnboardingAction("products", "apply_cogs", {
                  pct: Number(bulkPct),
                });
              }}
            >
              Apply COGS
            </Button>
            <Button
              size={compact ? "sm" : "md"}
              variant="flat"
              color="secondary"
              isDisabled={!bulkPct || isNaN(Number(bulkPct))}
              onPress={() => {
                if (!data || !bulkPct) return;
                const pct = Number(bulkPct);
                setEdits((prev) => {
                  const next = { ...prev } as Record<string, RowEdit>;
                  (data as VariantRow[]).forEach((v) => {
                    const id = String(v._id);
                    next[id] = { ...(next[id] || {}), tax: String(pct) };
                  });
                  return next;
                });
                trackOnboardingAction("products", "apply_tax", {
                  pct: Number(bulkPct),
                });
              }}
            >
              Apply Tax
            </Button>
            <Button
              size={compact ? "sm" : "md"}
              variant="flat"
              isDisabled={!bulkPct || isNaN(Number(bulkPct))}
              onPress={() => {
                if (!data || !bulkPct) return;
                const pct = Number(bulkPct);
                setEdits((prev) => {
                  const next = { ...prev } as Record<string, RowEdit>;
                  (data as VariantRow[]).forEach((v) => {
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
                trackOnboardingAction("products", "apply_handling", {
                  pct: Number(bulkPct),
                });
              }}
            >
              Apply Handling
            </Button>
            <Button
              size={compact ? "sm" : "md"}
              variant="flat"
              onPress={() => {
                // Clear all pending edits (COGS, Tax, Shipping, Handling) for current page
                if (!data) {
                  setEdits({});
                  return;
                }
                setEdits((prev) => {
                  const next: Record<string, RowEdit> = { ...prev };
                  (data as VariantRow[]).forEach((v) => {
                    const id = String(v._id);
                    next[id] = {
                      cogs: "",
                      tax: "",
                      shipping: "",
                      handling: "",
                    };
                  });
                  return next;
                });
                trackOnboardingAction("products", "clear_all");
              }}
            >
              Clear All
            </Button>
          </div>
        </div>
      ) : null}
      {(() => {
        const columnCount = columns.length;
        return (
          <Table
            aria-label="Variant costs table"
            classNames={{
              // Remove container-level scroll; use page-level scrolling
              wrapper: "shadow-none border border-divider rounded-xl",
              table: compact ? "text-xs" : "",
              th: "bg-default-100 text-default-600 font-medium",
            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody>
              {(() => {
                if (loading) {
                  return Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell colSpan={columnCount}>
                        <Skeleton className="h-8 rounded-md" />
                      </TableCell>
                    </TableRow>
                  ));
                }

                const list = (data || []) as VariantRow[];
                if (list.length === 0) {
                  return (
                    <TableRow key="empty">
                      <TableCell colSpan={columnCount}>
                        <div className="p-4 text-center text-default-500 text-sm">
                          No variants found
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                const rows: React.ReactElement[] = [];
                grouped.forEach((grp, grpIndex) => {
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
                  // Averages for default product-level inputs (respect pending edits if present)
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
                      if (typeof v.taxRate === "number")
                        return Number(v.taxRate);
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
                  const avgShippingStr = avgFrom(
                    grp.items.map((v) => {
                      const id = String(v._id);
                      const e = edits[id];
                      if (e && e.shipping !== undefined && e.shipping !== "")
                        return Number(e.shipping);
                      return undefined;
                    })
                  );

                  // Product header row renders the same columns
                  const headerCells: any[] = [];
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
                  if (hideRowSave) {
                    headerCells.push(
                      <TableCell key="channel">
                        <Chip size="sm" variant="flat" color="default">
                          Shopify
                        </Chip>
                      </TableCell>
                    );
                  }
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
                        size={compact ? "sm" : "md"}
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
                        size={compact ? "sm" : "md"}
                        endContent={<span className="text-default-500">%</span>}
                        placeholder="0"
                        value={groupEdits[grp.key]?.tax ?? avgTaxStr}
                        onValueChange={(val) => {
                          const nextVal = sanitizeDecimal(val);
                          setGroupEdits((prev) => ({
                            ...prev,
                            [grp.key]: {
                              ...(prev[grp.key] || {}),
                              tax: nextVal,
                            },
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
                  if (!hideHandling) {
                    headerCells.push(
                      <TableCell key="handling">
                        <Input
                          aria-label="Handling & Overheads (apply to all variants in product)"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          size={compact ? "sm" : "md"}
                          startContent={
                            <span className="text-default-500">
                              {currencySymbol}
                            </span>
                          }
                          placeholder="0"
                          value={
                            groupEdits[grp.key]?.handling ?? avgHandlingStr
                          }
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
                              const next = { ...prev } as Record<
                                string,
                                RowEdit
                              >;
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
                  }
                  if (!hideShipping) {
                    headerCells.push(
                      <TableCell key="shipping">
                        <NumericInput
                          aria-label="Shipping (apply to all variants in product)"
                          min={0}
                          step="0.01"
                          size={compact ? "sm" : "md"}
                          startContent={
                            <span className="text-default-500">
                              {currencySymbol}
                            </span>
                          }
                          placeholder="0"
                          value={
                            groupEdits[grp.key]?.shipping ?? avgShippingStr
                          }
                          onValueChange={(nextVal) => {
                            setGroupEdits((prev) => ({
                              ...prev,
                              [grp.key]: {
                                ...(prev[grp.key] || {}),
                                shipping: nextVal,
                              },
                            }));
                            setEdits((prev) => {
                              const next = { ...prev } as Record<
                                string,
                                RowEdit
                              >;
                              grp.items.forEach((v) => {
                                const id = String(v._id);
                                next[id] = {
                                  ...(next[id] || {}),
                                  shipping: nextVal,
                                };
                              });
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                    );
                  }
                  headerCells.push(
                    <TableCell key="price">
                      {currencySymbol}
                      {avgPrice.toFixed(2)}
                    </TableCell>
                  );
                  if (!hideRowSave)
                    headerCells.push(<TableCell key="save">—</TableCell>);

                  const stripe = grpIndex % 2 === 1;
                  const header = (
                    <TableRow
                      key={`grp-h-${grp.key}`}
                      className={
                        (stripe ? "bg-default-50/60" : "") +
                        " border-t border-default-200/70"
                      }
                    >
                      {headerCells}
                    </TableRow>
                  );

                  rows.push(header);

                  if (!isOpen) return;
                  grp.items.forEach((v) => {
                    const e = edits[String(v._id)] || {};
                    rows.push(
                      <TableRow
                        key={String(v._id)}
                        className={stripe ? "bg-default-50/40" : ""}
                      >
                        {(() => {
                          const cells: any[] = [];
                          // Variant (only variant-specific text since product info is in header)
                          cells.push(
                            <TableCell key="variant">
                              <div className="min-w-0">
                                <div className="truncate text-sm text-default-900">
                                  {v.title || "Variant"}
                                </div>
                                <div className="text-xs text-default-500 truncate">
                                  {v.sku || ""}
                                </div>
                              </div>
                            </TableCell>
                          );
                          if (hideRowSave) {
                            cells.push(
                              <TableCell key="channel">
                                <Chip size="sm" variant="flat" color="default">
                                  Shopify
                                </Chip>
                              </TableCell>
                            );
                          }
                          // Status follows product status
                          cells.push(
                            <TableCell key="status">
                              <Chip
                                color={statusChipColor}
                                size="sm"
                                variant="flat"
                              >
                                {s
                                  ? s.charAt(0).toUpperCase() + s.slice(1)
                                  : "-"}
                              </Chip>
                            </TableCell>
                          );
                          // COGS
                          cells.push(
                            <TableCell key="cogs">
                              <NumericInput
                                aria-label="COGS"
                                min={0}
                                step="0.01"
                                size={compact ? "sm" : "md"}
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
                                onValueChange={(nextVal) => {
                                  const id = String(v._id);
                                  setEdits((prev) => {
                                    if ((prev[id]?.cogs ?? "") === nextVal)
                                      return prev;
                                    return {
                                      ...prev,
                                      [id]: {
                                        ...prev[id],
                                        cogs: nextVal,
                                      },
                                    };
                                  });
                                }}
                              />
                            </TableCell>
                          );
                          // Tax
                          cells.push(
                            <TableCell key="tax">
                              <NumericInput
                                aria-label="Tax Percent"
                                min={0}
                                max={100}
                                step="0.01"
                                size={compact ? "sm" : "md"}
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
                                onValueChange={(nextVal) => {
                                  const id = String(v._id);
                                  setEdits((prev) => {
                                    if ((prev[id]?.tax ?? "") === nextVal)
                                      return prev;
                                    return {
                                      ...prev,
                                      [id]: {
                                        ...prev[id],
                                        tax: nextVal,
                                      },
                                    };
                                  });
                                }}
                              />
                            </TableCell>
                          );
                          // Handling
                          if (!hideHandling) {
                            cells.push(
                              <TableCell key="handling">
                                <NumericInput
                                  aria-label="Handling & Overheads"
                                  min={0}
                                  step="0.01"
                                  size={compact ? "sm" : "md"}
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
                                  onValueChange={(nextVal) => {
                                    const id = String(v._id);
                                    setEdits((prev) => {
                                      if (
                                        (prev[id]?.handling ?? "") === nextVal
                                      )
                                        return prev;
                                      return {
                                        ...prev,
                                        [id]: {
                                          ...prev[id],
                                          handling: nextVal,
                                        },
                                      };
                                    });
                                  }}
                                />
                              </TableCell>
                            );
                          }
                          // Shipping
                          if (!hideShipping) {
                            cells.push(
                              <TableCell key="shipping">
                                <NumericInput
                                  aria-label="Shipping"
                                  min={0}
                                  step="0.01"
                                  size={compact ? "sm" : "md"}
                                  startContent={
                                    <span className="text-default-500">
                                      {currencySymbol}
                                    </span>
                                  }
                                  placeholder="0"
                                  value={e.shipping ?? ""}
                                  onValueChange={(nextVal) => {
                                    const id = String(v._id);
                                    setEdits((prev) => {
                                      if (
                                        (prev[id]?.shipping ?? "") === nextVal
                                      )
                                        return prev;
                                      return {
                                        ...prev,
                                        [id]: {
                                          ...prev[id],
                                          shipping: nextVal,
                                        },
                                      };
                                    });
                                  }}
                                />
                              </TableCell>
                            );
                          }
                          // Price
                          cells.push(
                            <TableCell key="price">
                              {currencySymbol}
                              {Number(v.price || 0).toFixed(2)}
                            </TableCell>
                          );
                          // Row save
                          if (!hideRowSave) {
                            cells.push(
                              <TableCell key="save">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  onPress={() => handleSaveRow(String(v._id))}
                                >
                                  Save
                                </Button>
                              </TableCell>
                            );
                          }
                          return cells;
                        })()}
                      </TableRow>
                    );
                  });
                });
                return rows;
              })()}
            </TableBody>
          </Table>
        );
      })()}

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            page={page}
            total={totalPages}
            size="sm"
            showControls
            onChange={setPage}
          />
        </div>
      )}
      {!hideNavigation && (
        <NavigationButtons
          nextLabel="Save & Continue"
          isNextLoading={saving}
          onNext={async () => {
            trackOnboardingAction("products", "save_continue");
            const variantIds = Object.keys(edits);
            console.log(
              "[VariantCostsClient] onNext called, edits count:",
              variantIds.length
            );
            if (variantIds.length === 0) {
              console.log(
                "[VariantCostsClient] No edits to save, proceeding to next step"
              );
              return true;
            }
            setSaving(true);
            try {
              const costs = variantIds.map((id) => {
                const e = edits[id];
                return {
                  variantId: id,
                  cogsPerUnit:
                    e?.cogs !== undefined && e.cogs !== ""
                      ? Number(e.cogs)
                      : undefined,
                  taxPercent:
                    e?.tax !== undefined && e.tax !== ""
                      ? Number(e.tax)
                      : undefined,
                  shippingPerUnit:
                    !hideShipping &&
                    e?.shipping !== undefined &&
                    e.shipping !== ""
                      ? Number(e.shipping)
                      : undefined,
                  handlingPerUnit:
                    !hideHandling &&
                    e?.handling !== undefined &&
                    e.handling !== ""
                      ? Number(e.handling)
                      : undefined,
                  // Payment and Shipping are global (single) and edited elsewhere
                };
              });
              // Filter out rows with no values
              const filtered = costs.filter(
                (c) =>
                  c.cogsPerUnit !== undefined ||
                  c.taxPercent !== undefined ||
                  c.shippingPerUnit !== undefined ||
                  c.handlingPerUnit !== undefined
              );
              if (filtered.length > 0) {
                console.log(
                  "[VariantCostsClient] Saving",
                  filtered.length,
                  "cost updates"
                );
                const res = await saveAll(filtered);
                console.log("[VariantCostsClient] Save result:", res);
                if (!res.success) {
                  console.error("[VariantCostsClient] Save failed");
                  return false;
                }
              }
              console.log(
                "[VariantCostsClient] Save successful, proceeding to next step"
              );
              return true;
            } catch (error) {
              console.error("[VariantCostsClient] Error during save:", error);
              return false;
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
