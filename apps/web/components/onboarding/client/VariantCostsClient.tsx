"use client";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Pagination } from "@heroui/pagination";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { Spinner } from "@heroui/spinner";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/table";
import { Icon } from "@iconify/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";
import type { RowElement } from "@react-types/table";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  useShopifyProductVariantsPaginated,
  useUpsertVariantCosts,
  useSaveVariantCosts,
  useCurrentUser,
  useOnboarding,
} from "@/hooks";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import NavigationButtons from "@/components/onboarding/NavigationButtons";
import { getCurrencySymbol } from "@/libs/utils/format";
import { sanitizeDecimal } from "@/components/shared/table/sanitize";
import { NumericInput } from "@/components/shared/table/NumericInput";
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
  imageUrl?: string;
  image?: string;
  title?: string;
  sku?: string;
  price?: number;
  cogsPerUnit?: number;
  taxRate?: number;
  handlingPerUnit?: number;
};

type VariantGroup = {
  key: string;
  productName: string;
  productImage?: string;
  productStatus?: string;
  items: VariantRow[];
};

type VirtualRow =
  | { type: "group"; group: VariantGroup; stripe: boolean }
  | { type: "variant"; variant: VariantRow; stripe: boolean };

export default function VariantCostsClient({
  hideNavigation = false,
  hideHandling = false,
  hideSearch = false,
  hideRowSave = false,
  compact = true,
  hideTitle = false,
}: {
  hideNavigation?: boolean;
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
  const [bulkValue, setBulkValue] = useState<string>("10");
  const [bulkType, setBulkType] = useState<"percent" | "flat">("percent");
  const { data, totalPages, currentPage, loading } = useShopifyProductVariantsPaginated(
    page,
    pageSize,
    hideSearch ? undefined : search
  );

  useEffect(() => {
    if (currentPage !== page) {
      setPage(currentPage);
    }
  }, [currentPage, page, setPage]);
  const upsert = useUpsertVariantCosts();
  const saveAll = useSaveVariantCosts();

  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  const currency = user?.primaryCurrency || "USD";
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);
  const {
    status,
    isShopifySyncing,
    hasShopifySyncError,
    isShopifyProductsSynced,
    isShopifyInventorySynced,
  } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupEdits, setGroupEdits] = useState<Record<string, RowEdit>>({});
  const [appliedBulkOperations, setAppliedBulkOperations] = useState<{
    cogs?: { value: number; type: "percent" | "flat" };
    tax?: { value: number; type: "percent" | "flat" };
    handling?: { value: number; type: "percent" | "flat" };
  }>({});

  const isProductDataReady =
    (isShopifyProductsSynced ?? false) || (isShopifyInventorySynced ?? false);
  const syncStateLabel = hasShopifySyncError
    ? "needs attention"
    : isShopifySyncing
      ? "syncing"
      : "queued";

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
    cols.push({ key: "price", label: "Price" });
    if (!hideRowSave) cols.push({ key: "save", label: "Save" });
    return cols;
  }, [hideRowSave, hideHandling]);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("products");
  }, []);

  // Auto-apply bulk operations to new data when page changes
  useEffect(() => {
    if (!data || Object.keys(appliedBulkOperations).length === 0) return;

    const dataToProcess = data as VariantRow[];
    let hasChanges = false;
    const updates: Record<string, RowEdit> = {};

    for (const v of dataToProcess) {
      const id = String(v._id);

      // Skip if this variant already has edits applied
      if (edits[id]) continue;

      const variantEdit: RowEdit = {};

      // Apply COGS if bulk operation is set
      if (appliedBulkOperations.cogs) {
        const { value, type } = appliedBulkOperations.cogs;

        if (type === "percent") {
          const original = v.cogsPerUnit ?? 0;
          // Only apply to empty values when using percentage
          if (!isFinite(original) || original === 0) {
            const price = Number(v.price ?? 0) || 0;
            const computed = (price * value) / 100;
            variantEdit.cogs = isFinite(computed) ? computed.toFixed(2) : "0.00";
          }
        } else {
          variantEdit.cogs = value.toFixed(2);
        }
      }

      // Apply Tax if bulk operation is set
      if (appliedBulkOperations.tax) {
        variantEdit.tax = String(appliedBulkOperations.tax.value);
      }

      // Apply Handling if bulk operation is set
      if (appliedBulkOperations.handling) {
        const { value, type } = appliedBulkOperations.handling;

        if (type === "percent") {
          const price = Number(v.price ?? 0) || 0;
          const computed = (price * value) / 100;
          variantEdit.handling = isFinite(computed) ? computed.toFixed(2) : "0.00";
        } else {
          variantEdit.handling = value.toFixed(2);
        }
      }

      if (Object.keys(variantEdit).length > 0) {
        updates[id] = variantEdit;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setEdits((prev) => ({ ...prev, ...updates }));
    }
  }, [data, appliedBulkOperations, edits]);

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
    const map = new Map<string, VariantGroup>();
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

  // Flatten groups and variants into virtual rows
  const virtualRows = useMemo<VirtualRow[]>(() => {
    const rows: VirtualRow[] = [];
    grouped.forEach((grp, grpIndex) => {
      const stripe = grpIndex % 2 === 1;
      rows.push({ type: "group", group: grp, stripe });
      if (expandedGroups.has(grp.key)) {
        grp.items.forEach((variant) => {
          rows.push({ type: "variant", variant, stripe });
        });
      }
    });
    return rows;
  }, [grouped, expandedGroups]);

  // Set up virtualizer (prepared for future virtualization implementation)
  const _parentRef = useRef<HTMLDivElement>(null);
  const _rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => _parentRef.current,
    estimateSize: (index) => {
      const row = virtualRows[index];
      return row?.type === "group" ? 60 : 70;
    },
    overscan: 10,
  });

  const handleSaveRow = useCallback(
    async (variantId: string) => {
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
          // Payment and Shipping are global (single) and edited elsewhere
        });
        // No per-row toast; aggregate feedback on Continue
      } catch (_error) {
        // swallow; navigation will be prevented by onNext if save fails
      }
    },
    [edits, upsert, hideHandling]
  );

  const handleApplyCogs = useCallback(() => {
    if (!bulkValue || !data) return;
    const value = Number(bulkValue);

    // Store bulk operation to auto-apply to all pages
    setAppliedBulkOperations((prev) => ({
      ...prev,
      cogs: { value, type: bulkType },
    }));

    // Apply to current page data
    const dataToProcess = data as VariantRow[];

    setEdits((prev) => {
      const next = { ...prev } as Record<string, RowEdit>;
      dataToProcess.forEach((v) => {
        const id = String(v._id);
        const original = (
          prev[id]?.cogs ??
          v.cogsPerUnit ??
          ""
        ).toString();
        const originalVal = Number(original || 0);

        let computed: number;
        if (bulkType === "percent") {
          // Only apply to empty values when using percentage
          if (!isFinite(originalVal) || originalVal === 0) {
            const price = Number(v.price ?? 0) || 0;
            computed = (price * value) / 100;
          } else {
            return; // Skip if already has value
          }
        } else {
          // Flat value - always apply
          computed = value;
        }

        const fixed = isFinite(computed) ? computed.toFixed(2) : "0.00";
        next[id] = { ...(next[id] || {}), cogs: fixed };
      });
      return next;
    });
    trackOnboardingAction("products", "apply_cogs", {
      value,
      type: bulkType,
    });
  }, [bulkValue, data, bulkType]);

  const handleApplyTax = useCallback(() => {
    if (!bulkValue || !data) return;
    const value = Number(bulkValue);

    // Store bulk operation to auto-apply to all pages
    setAppliedBulkOperations((prev) => ({
      ...prev,
      tax: { value, type: bulkType },
    }));

    const dataToProcess = data as VariantRow[];

    setEdits((prev) => {
      const next = { ...prev } as Record<string, RowEdit>;
      dataToProcess.forEach((v) => {
        const id = String(v._id);
        // Tax is always treated as percentage regardless of bulkType
        next[id] = { ...(next[id] || {}), tax: String(value) };
      });
      return next;
    });
    trackOnboardingAction("products", "apply_tax", {
      value,
      type: bulkType,
    });
  }, [bulkValue, data, bulkType]);

  const handleApplyHandling = useCallback(() => {
    if (!bulkValue || !data) return;
    const value = Number(bulkValue);

    // Store bulk operation to auto-apply to all pages
    setAppliedBulkOperations((prev) => ({
      ...prev,
      handling: { value, type: bulkType },
    }));

    const dataToProcess = data as VariantRow[];

    setEdits((prev) => {
      const next = { ...prev } as Record<string, RowEdit>;
      dataToProcess.forEach((v) => {
        const id = String(v._id);

        let computed: number;
        if (bulkType === "percent") {
          const price = Number(v.price ?? 0) || 0;
          computed = (price * value) / 100;
        } else {
          computed = value;
        }

        const fixed = isFinite(computed) ? computed.toFixed(2) : "0.00";
        next[id] = { ...(next[id] || {}), handling: fixed };
      });
      return next;
    });
    trackOnboardingAction("products", "apply_handling", {
      value,
      type: bulkType,
    });
  }, [bulkValue, data, bulkType]);

  const handleClearAll = useCallback(() => {
    // Clear all edits and bulk operations
    setEdits({});
    setAppliedBulkOperations({});
    trackOnboardingAction("products", "clear_all");
  }, []);

  if (!isProductDataReady) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-16 text-center">
        <Card className="w-full border-warning bg-warning-50/40">
          <CardBody className="space-y-3 text-default-700">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-warning-500">
                <Icon icon="solar:refresh-circle-line-duotone" width={28} />
              </div>
              <div className="text-start space-y-1">
                <p className="font-semibold text-warning-600">
                  Shopify sync {hasShopifySyncError ? "needs attention" : "is still in progress"}
                </p>
                <p className="text-sm leading-relaxed">
                  {hasShopifySyncError
                    ? "We couldn\u2019t finish importing your products. Please return to the Shopify step to restart the sync."
                    : "We\u2019re importing your products and variants from Shopify. Once the sync finishes you\u2019ll be able to set costs."}
                </p>
                <p className="text-xs uppercase tracking-wide text-warning-500">
                  Shopify sync status: {syncStateLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-start gap-2 text-warning-500">
              <Spinner size="sm" color="warning" />
              <span className="text-xs">
                {hasShopifySyncError
                  ? "Head back to the Shopify step to retry the sync."
                  : "Feel free to grab a coffee—this only needs to finish once."}
              </span>
            </div>
          </CardBody>
        </Card>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            color="primary"
            onPress={() => router.refresh()}
            isDisabled={isShopifySyncing}
          >
            Refresh status
          </Button>
          {hasShopifySyncError && (
            <Button
              variant="solid"
              size="sm"
              color="warning"
              onPress={() => router.push("/onboarding/shopify")}
            >
              Retry Shopify sync
            </Button>
          )}
        </div>
      </div>
    );
  }

  const headerContent = hideTitle ? null : (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-start gap-2">
        <Icon icon="solar:box-minimalistic-bold-duotone" className="mt-1 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Variant Costs</h2>
          <p className="text-xs text-default-500">
            Set COGS for accurate profit calculation.
          </p>
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap items-center gap-2">
        {!hideSearch &&
          (loading ? (
            <Skeleton className="h-9 w-48 rounded-lg" />
          ) : (
            <Input
              size={compact ? "sm" : "md"}
              className="max-w-[12rem]"
              classNames={{
                inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
                input: DATA_TABLE_INPUT_CLASS,
              }}
              placeholder="Search..."
              startContent={<Icon icon="solar:search-bold-duotone" width={16} />}
              value={search}
              onValueChange={setSearch}
            />
          ))}
        <Input
          size={compact ? "sm" : "md"}
          className="w-32"
          classNames={{
            inputWrapper: DATA_TABLE_INPUT_WRAPPER_CLASS,
            input: DATA_TABLE_INPUT_CLASS,
          }}
          type="number"
          placeholder="10"
          value={bulkValue}
          onValueChange={setBulkValue}
        />
        <Select
          size={compact ? "sm" : "md"}
          className="w-32"
          classNames={{
            trigger: DATA_TABLE_INPUT_WRAPPER_CLASS,
          }}
          selectedKeys={new Set([bulkType])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0] as "percent" | "flat";
            setBulkType(value);
          }}
          aria-label="Bulk operation type"
        >
          <SelectItem key="percent">
            Percent
          </SelectItem>
          <SelectItem key="flat">
            Flat
          </SelectItem>
        </Select>
        <Button
          size={compact ? "sm" : "md"}
          color="primary"
          isDisabled={!bulkValue || isNaN(Number(bulkValue))}
          onPress={handleApplyCogs}
        >
          Apply COGS
        </Button>
        <Button
          size={compact ? "sm" : "md"}
          color="primary"
          isDisabled={!bulkValue || isNaN(Number(bulkValue))}
          onPress={handleApplyTax}
        >
          Apply Tax
        </Button>
        <Button
          size={compact ? "sm" : "md"}
          color="primary"
          isDisabled={!bulkValue || isNaN(Number(bulkValue))}
          onPress={handleApplyHandling}
        >
          Apply Handling
        </Button>
        <Button
          size={compact ? "sm" : "md"}
          color="danger"
          onPress={handleClearAll}
        >
          Clear All
        </Button>
      </div>
    </div>
  );

  const paginationContent =
    totalPages > 1 ? (
      <div className="flex justify-center pt-2">
        <Pagination
          page={currentPage}
          total={totalPages}
          size="sm"
          showControls
          onChange={setPage}
        />
      </div>
    ) : undefined;

  return (
    <div className="space-y-6">
      {headerContent}
      {(() => {
        const columnCount = columns.length;
        if (loading) {
          return (
            <div className={DATA_TABLE_TABLE_CLASS}>
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton
                    key={`variant-loading-${index}`}
                    className="h-8 w-full rounded-lg"
                  />
                ))}
              </div>
            </div>
          );
        }

        return (
          <Table
            removeWrapper
            aria-label="Variant costs table"
            className={DATA_TABLE_TABLE_CLASS}
            classNames={{
              table: compact ? "text-xs" : "",
              th: DATA_TABLE_HEADER_CLASS,
              td: "py-2.5 px-3 text-sm text-default-700 align-middle",
            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.key}>{column.label}</TableColumn>
              )}
            </TableHeader>
            <TableBody>
              {(() => {
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

                const rows: RowElement<VariantRow>[] = [];
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
                      if (typeof v.cogsPerUnit === "number")
                        return Number(v.cogsPerUnit);
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
                  // Product header row renders the same columns
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
                            <Icon icon="solar:box-bold-duotone" width={16} />
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
                        size={compact ? "sm" : "md"}
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
                      className={cn(
                        stripe ? DATA_TABLE_ROW_STRIPE_BG : DATA_TABLE_ROW_BASE_BG,
                        DATA_TABLE_GROUP_ROW_BORDER_CLASS,
                      )}
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
                        className={cn(
                          DATA_TABLE_ROW_BASE_BG,
                          stripe && DATA_TABLE_ROW_STRIPE_CHILD_BG,
                        )}
                      >
                        {(() => {
                          const cells: TableCellElement[] = [];
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
                                  (typeof v.cogsPerUnit === "number"
                                    ? String(v.cogsPerUnit)
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
                                  color="primary"
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

      {paginationContent}

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
