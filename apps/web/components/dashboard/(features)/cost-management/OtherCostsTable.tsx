"use client";

import {
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  addToast,
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Skeleton,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";
import { ConfirmationModal } from "@/components/shared/ConfirmationModal";
import type { GenericId as Id } from "convex/values";
import {
  useCreateExpense,
  useDeleteExpense as useDeleteOtherCost,
  useExpenses as useOtherCosts,
  useUpdateExpense,
} from "@/hooks";
import { useUserContext } from "@/contexts/UserContext";
import { createLogger } from "@/libs/logging";
import { getCurrencySymbol } from "@/libs/utils/format";
import { TableSkeleton } from "@/components/shared/skeletons";
import {
  DATA_TABLE_HEADER_CLASS,
  DATA_TABLE_SIMPLE_ROW_STRIPE_CLASS,
  DATA_TABLE_TABLE_CLASS,
} from "@/components/shared/table/DataTableCard";
import { getLocalTimeZone, parseDate, today, type CalendarDate } from "@internationalized/date";

const logger = createLogger("OtherCostsTable");

// Type definitions based on the costs schema
interface Cost {
  _id: Id<"globalCosts">;
  organizationId: string;
  userId: Id<"users">;
  type: "shipping" | "payment" | "operational";
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
  isActive: boolean;
  isDefault: boolean;
  effectiveFrom: number;
  effectiveTo?: number;
  createdAt?: number;
  updatedAt?: number;
  // Additional UI-specific properties
  expenseType?: string;
  amount?: number;
  paymentStatus?: "paid" | "pending" | "overdue";
  status?: string;
}

interface FormData {
  _id?: Id<"globalCosts">;
  name: string;
  // description, category, expenseType removed from UI
  amount: number;
  value?: number;
  frequency: CostFrequency;
  effectiveFrom?: string;
  effectiveTo?: string;
  paymentStatus?: "paid" | "pending" | "overdue";
  vendorName?: string;
  isActive?: boolean;
}
const columns = [
  { name: "Name", uid: "name" },
  { name: "Amount", uid: "amount" },
  { name: "Frequency", uid: "frequency" },
  { name: "Actions", uid: "actions" },
];

type CostFrequency = NonNullable<Cost["frequency"]>;
type CostFrequencyKey =
  | "ONE_TIME"
  | "PER_ORDER"
  | "PER_ITEM"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY"
  | "PERCENTAGE";

// Expense types removed from UI

const frequencies: Array<{ key: CostFrequency; label: string }> = [
  { key: "monthly", label: "Monthly" },
  { key: "weekly", label: "Weekly" },
  { key: "one_time", label: "One Time" },
];

const FREQUENCY_VALUE_TO_KEY: Record<CostFrequency, CostFrequencyKey> = {
  one_time: "ONE_TIME",
  per_order: "PER_ORDER",
  per_item: "PER_ITEM",
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  yearly: "YEARLY",
  percentage: "PERCENTAGE",
};

// Payment status options removed from Other Expenses

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const calendarDateToString = (date: CalendarDate): string => {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
};

const getEffectiveFromCalendarValue = (value?: string): CalendarDate => {
  if (value) {
    try {
      return parseDate(value);
    } catch {
      // fall through to today
    }
  }

  return today(getLocalTimeZone());
};

const formatEffectiveFromLabel = (value?: string): string => {
  if (!value) {
    return "Select date";
  }

  const jsDate = new Date(value);

  if (Number.isNaN(jsDate.getTime())) {
    return value;
  }

  return dateFormatter.format(jsDate);
};

export default function OtherCostsTable() {
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    amount: 0,
    frequency: "monthly",
  });
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEffectiveFromOpen, setIsEffectiveFromOpen] = useState(false);

  const { primaryCurrency } = useUserContext();
  const currency = primaryCurrency;
  const { expenses: allOtherCosts, loading: expensesLoading } = useOtherCosts();
  const otherCosts = allOtherCosts as Cost[] | undefined;
  const addCompleteExpense = useCreateExpense();
  const deleteOtherCost = useDeleteOtherCost();
  const updateExpense = useUpdateExpense();
  const isLoading = Boolean(expensesLoading);

  // Categories are not used in this simplified UI

  const handleEdit = (item: Cost) => {
    setFormData({
      _id: item._id,
      name: item.name,
      amount: item.value || 0,
      value: item.value,
      frequency: item.frequency || "monthly",
      effectiveFrom: item.effectiveFrom
        ? new Date(item.effectiveFrom).toISOString().split("T")[0]
        : undefined,
      effectiveTo: item.effectiveTo
        ? new Date(item.effectiveTo).toISOString().split("T")[0]
        : undefined,
      isActive: typeof item.isActive === "boolean" ? item.isActive : true,
    });
    onOpen();
  };

  const handleAdd = async () => {
    setFormData({
      name: "",
      amount: 0,
      frequency: "monthly",
      effectiveFrom: new Date().toISOString().split("T")[0],
      isActive: true,
    });
    onOpen();
  };

  const handleSave = async () => {
    try {
      if (formData._id) {
        // Update existing expense
        const frequencyKey = formData.frequency
          ? FREQUENCY_VALUE_TO_KEY[formData.frequency]
          : undefined;
        const result = await updateExpense({
          costId: formData._id,
          name: formData.name,
          value:
            typeof formData.amount === "number"
              ? formData.amount
              : formData.value || 0,
          frequency: frequencyKey,
          isActive: formData.isActive,
        });

        if (result.success) {
          addToast({
            title: "Operating cost updated",
            color: "default",
            timeout: 3000,
          });
          onOpenChange();
        } else {
          addToast({
            title: "Failed to update cost",
            description: result.error || "Please try again",
            color: "danger",
            timeout: 5000,
          });
        }
      } else {
        // For new expense, use addCompleteExpense
        const newFrequency = FREQUENCY_VALUE_TO_KEY[formData.frequency];
        await addCompleteExpense({
          type: "OPERATIONAL",
          name: formData.name,
          value: formData.amount,
          calculation: "FIXED",
          effectiveFrom: formData.effectiveFrom
            ? new Date(formData.effectiveFrom).toISOString()
            : new Date().toISOString(),
          frequency: newFrequency,
        });
        addToast({
          title: "Operating cost added successfully",
          color: "default",
          timeout: 3000,
        });
        onOpenChange();
      }
    } catch (_error) {
      logger.error("Error saving expense:", _error);
      addToast({
        title: "Failed to save cost",
        description: _error instanceof Error ? _error.message : "Unknown error",
        color: "danger",
        timeout: 5000,
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      await deleteOtherCost(itemToDelete as Id<"globalCosts">);
      addToast({
        title: "Operating cost deleted",
        color: "default",
        timeout: 3000,
      });
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (_error) {
      addToast({
        title: "Failed to delete",
        color: "danger",
        timeout: 3000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const effectiveFromCalendarValue = useMemo(
    () => getEffectiveFromCalendarValue(formData.effectiveFrom),
    [formData.effectiveFrom],
  );

  const renderCell = (item: Cost, columnKey: React.Key) => {
    switch (columnKey) {
      case "name":
        return <p className="font-medium">{item.name}</p>;

      // expenseType column removed

      case "amount":
        return (
          <span>
            {getCurrencySymbol(currency)}
            {(item.value || 0).toFixed(2)}
          </span>
        );

      case "frequency": {
        const effectiveFreq = item.frequency || "monthly";
        const freq =
          frequencies.find((f) => f.key === effectiveFreq) ||
          frequencies.find((f) => f.key === "monthly");

        return (
          <Chip size="sm" variant="flat">
            {freq?.label || "Monthly"}
          </Chip>
        );
      }

      

      // status column removed

      case "actions":
        return (
          <div className="flex gap-2">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => handleEdit(item)}
            >
              <Icon icon="solar:pen-linear" width={16} />
            </Button>
            <Button
              isIconOnly
              color="danger"
              size="sm"
              variant="light"
              onPress={() => handleDeleteClick(item._id as string)}
            >
              <Icon icon="solar:trash-bin-trash-linear" width={16} />
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const topContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Operating Costs</h2>
        <Button
          color="primary"
          startContent={<Icon icon="solar:add-square-bold" width={16} />}
          isDisabled={isLoading}
          onPress={handleAdd}
        >
          Add Operating Cost
        </Button>
      </div>
      {isLoading ? <Skeleton className="h-10 w-64 rounded-lg" /> : null}
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        {topContent}
        {isLoading ? (
          <div className={DATA_TABLE_TABLE_CLASS}>
            <TableSkeleton
              rows={6}
              columns={4}
              showHeader={false}
              showPagination={false}
              className="border border-default-200/60"
            />
          </div>
        ) : (
          <Table
            removeWrapper
            aria-label="Operating costs table"
            className={DATA_TABLE_TABLE_CLASS}
            classNames={{
              th: DATA_TABLE_HEADER_CLASS,
              td: "py-2.5 px-3 text-sm text-default-800 align-middle",
              table: "text-sm",
            }}
          >
            <TableHeader columns={columns}>
              {(column) => <TableColumn key={column.uid}>{column.name}</TableColumn>}
            </TableHeader>
            <TableBody
              emptyContent={
                <div className="py-10 text-center">
                  <Icon
                    className="mx-auto mb-4 text-default-300"
                    icon="solar:wallet-bold-duotone"
                    width={48}
                  />
                  <p className="mb-2 text-default-500">
                    No operating costs added yet
                  </p>
                  <p className="text-small text-default-400">
                    Add operational costs to track business performance
                  </p>
                </div>
              }
              items={(otherCosts || []) as Cost[]}
            >
              {(item: Cost) => (
                <TableRow
                  key={item._id as string}
                  className={DATA_TABLE_SIMPLE_ROW_STRIPE_CLASS}
                >
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        classNames={{
          backdrop: "backdrop-blur-sm",
          base: "max-h-[85vh] overflow-hidden",
          body: "overflow-y-auto scrollbar-hide",
          wrapper: "items-center",
        }}
        isOpen={isOpen}
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 border-b border-divider pb-3">
                <h2 className="text-lg font-semibold">
                  {formData._id ? "Edit Operating Cost" : "Add Operating Cost"}
                </h2>
                <p className="text-sm text-default-500">
                  Track operational costs for better P&L visibility
                </p>
              </ModalHeader>
              <ModalBody className="bg-default-50 gap-6 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Cost Name"
                    size="sm"
                    labelPlacement="outside"
                    placeholder="e.g., Office Rent, Software Subscription"
                    value={formData.name || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, name: value })
                    }
                  />

                  
                </div>

                

                {/* Amount + Frequency/Apply To aligned in one row */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    size="sm"
                    label="Amount"
                    labelPlacement="outside"
                    startContent={getCurrencySymbol(currency)}
                    step="0.01"
                    type="number"
                    value={formData.amount.toString()}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        amount: parseFloat(value) || 0,
                      })
                    }
                  />

                  <Select
                    label="Frequency"
                    size="sm"
                    labelPlacement="outside"
                    selectedKeys={[formData.frequency]}
                    onSelectionChange={(keys) => {
                      if (keys === 'all') return;
                      const [nextFrequency] = Array.from(keys) as (CostFrequency | undefined)[];
                      if (!nextFrequency) return;
                      setFormData((prev) => ({
                        ...prev,
                        frequency: nextFrequency,
                      }));
                    }}
                  >
                    {frequencies.map((freq) => (
                      <SelectItem key={freq.key}>{freq.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-default-600">
                      Effective From
                    </span>
                    <Popover
                      isOpen={isEffectiveFromOpen}
                      placement="bottom-start"
                      onOpenChange={setIsEffectiveFromOpen}
                    >
                      <PopoverTrigger>
                        <Button
                          className="w-full justify-between text-left"
                          size="sm"
                          variant="bordered"
                        >
                          <span className="flex items-center gap-2">
                            <Icon icon="solar:calendar-linear" width={16} />
                            {formatEffectiveFromLabel(formData.effectiveFrom)}
                          </span>
                          <Icon icon="solar:alt-arrow-down-bold" width={14} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-2">
                        <Calendar
                          aria-label="Effective from date"
                          className="w-full"
                          value={effectiveFromCalendarValue}
                          onChange={(date) => {
                            if (!date) return;
                            setFormData((prev) => ({
                              ...prev,
                              effectiveFrom: calendarDateToString(date),
                            }));
                            setIsEffectiveFromOpen(false);
                          }}
                          weekdayStyle="short"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isDisabled={!formData.name || !formData.amount}
                  onPress={handleSave}
                >
                  {formData._id ? "Update" : "Add"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        cancelText="Cancel"
        confirmColor="danger"
        confirmText="Delete"
        icon="solar:trash-bin-bold-duotone"
        iconColor="text-danger"
        isLoading={isDeleting}
        isOpen={deleteModalOpen}
        message="Are you sure you want to delete this operating cost? This action cannot be undone."
        title="Delete Operating Cost"
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
