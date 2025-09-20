"use client";

import {
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
  useDisclosure,
  Skeleton,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { ConfirmationModal } from "@/components/shared/ConfirmationModal";
import type { GenericId as Id } from "convex/values";
import {
  useCreateExpense,
  useCurrentUser,
  useDeleteExpense as useDeleteOtherCost,
  useExpenses as useOtherCosts,
  useUpdateExpense,
} from "@/hooks";
import { createLogger } from "@/libs/logging";
import { getCurrencySymbol } from "@/libs/utils/format";
import { TableSkeleton } from "@/components/shared/skeletons";

const logger = createLogger("OtherCostsTable");

// Type definitions based on the costs schema
interface Cost {
  _id: Id<"costs">;
  organizationId: string;
  userId: Id<"users">;
  type:
    | "product"
    | "shipping"
    | "payment"
    | "operational"
    | "tax"
    | "handling"
    | "marketing";
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
  config?: unknown;
  provider?: string;
  providerType?: string;
  applyTo?:
    | "all"
    | "specific_products"
    | "specific_categories"
    | "specific_orders"
    | "specific_channels";
  applyToIds?: string[];
  isActive: boolean;
  isDefault: boolean;
  priority: number;
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

// Category model removed from this UI

interface ExpenseConfig {
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
  paymentStatus?: "paid" | "pending" | "overdue";
  vendorName?: string;
  categoryId?: Id<"costCategories">;
  applyTo?: string;
  isRecurring?: boolean;
}

interface FormData {
  _id?: Id<"costs">;
  name: string;
  // description, category, expenseType removed from UI
  amount: number;
  value?: number;
  frequency: string;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string;
  paymentStatus?: "paid" | "pending" | "overdue";
  isRecurring?: boolean;
  vendorName?: string;
  isActive?: boolean;
}
const columns = [
  { name: "Name", uid: "name" },
  { name: "Amount", uid: "amount" },
  { name: "Frequency", uid: "frequency" },
  { name: "Actions", uid: "actions" },
];

// Expense types removed from UI

const frequencies = [
  { key: "monthly", label: "Monthly" },
  { key: "weekly", label: "Weekly" },
  { key: "one_time", label: "One Time" },
];

// Payment status options removed from Other Expenses

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

  const user = useCurrentUser();
  const currency = user?.primaryCurrency || "USD";
  const { expenses: allOtherCosts, loading: expensesLoading } = useOtherCosts();
  const otherCosts = allOtherCosts as Cost[] | undefined;
  const addCompleteExpense = useCreateExpense();
  const deleteOtherCost = useDeleteOtherCost();
  const updateExpense = useUpdateExpense();
  const isLoading = Boolean(expensesLoading);

  // Categories are not used in this simplified UI

  const handleEdit = (item: Cost) => {
    const cfg = (item.config as ExpenseConfig) || {};
    setFormData({
      _id: item._id,
      name: item.name,
      amount: item.value || 0,
      value: item.value,
      frequency: (cfg.frequency as string) || item.frequency || "monthly",
      effectiveFrom: item.effectiveFrom
        ? new Date(item.effectiveFrom)
        : undefined,
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : undefined,
      isActive: typeof item.isActive === "boolean" ? item.isActive : true,
      isRecurring: cfg.isRecurring ?? true,
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
      isRecurring: true,
    });
    onOpen();
  };

  const handleSave = async () => {
    try {
      if (formData._id) {
        // Update existing expense
        const result = await updateExpense({
          costId: formData._id,
          value:
            typeof formData.amount === "number"
              ? formData.amount
              : formData.value || 0,
          config: {
            isRecurring: formData.isRecurring ?? true,
            // Persist UI frequency hint in config (engine reads this if top-level is unchanged)
            frequency: formData.frequency,
          },
        });

        if (result.success) {
          addToast({
            title: "Expense updated",
            color: "success",
            timeout: 3000,
          });
          onOpenChange();
        } else {
          addToast({
            title: "Failed to update expense",
            description: result.error || "Please try again",
            color: "danger",
            timeout: 5000,
          });
        }
      } else {
        // For new expense, use addCompleteExpense
        await addCompleteExpense({
          type: "OPERATIONAL",
          name: formData.name,
          value: formData.amount,
          calculation: "FIXED",
          effectiveFrom: formData.effectiveFrom || new Date().toISOString(),
          frequency:
            formData.frequency === "monthly"
              ? "MONTHLY"
              : formData.frequency === "weekly"
                ? "WEEKLY"
                : "ONE_TIME",
          config: {
            isRecurring: formData.isRecurring ?? true,
          },
        });
        addToast({
          title: "Expense added successfully",
          color: "success",
          timeout: 3000,
        });
        onOpenChange();
      }
    } catch (_error) {
      logger.error("Error saving expense:", _error);
      addToast({
        title: "Failed to save expense",
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
      await deleteOtherCost(itemToDelete as Id<"costs">);
      addToast({
        title: "Expense deleted",
        color: "success",
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
        const cfg = (item.config as ExpenseConfig) || {};
        const cfgFreq = cfg.frequency as string | undefined;
        const effectiveFreq = cfgFreq || item.frequency || "monthly";
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
              <Icon icon="solar:pen-2-linear" width={16} />
            </Button>
            <Button
              isIconOnly
              color="danger"
              size="sm"
              variant="light"
              onPress={() => handleDeleteClick(item._id as string)}
            >
              <Icon icon="solar:trash-bin-linear" width={16} />
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Other Expenses</h2>
          <Button
            color="primary"
            startContent={<Icon icon="solar:add-square-bold" width={16} />}
            isDisabled={isLoading}
            onPress={handleAdd}
          >
            Add Expense
          </Button>
        </div>

        {isLoading ? <Skeleton className="h-10 w-64 rounded-lg" /> : null}
      </div>

      <div>
        {isLoading ? (
          <TableSkeleton
            rows={6}
            columns={4}
            showHeader={false}
            showPagination={false}
            className="border border-divider"
          />
        ) : (
          <Table
            removeWrapper
            aria-label="Other costs table"
            className="rounded-xl border border-divider overflow-hidden"
            classNames={{
              th: "bg-default-100 text-default-600 font-medium",
            }}
            shadow="none"
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.uid}>{column.name}</TableColumn>
              )}
            </TableHeader>
            <TableBody
              emptyContent={
                <div className="text-center py-10">
                  <Icon
                    className="mx-auto text-default-300 mb-4"
                    icon="solar:wallet-bold-duotone"
                    width={48}
                  />
                  <p className="text-default-500 mb-2">
                    No other expenses added yet
                  </p>
                  <p className="text-small text-default-400">
                    Add operational expenses to track business costs
                  </p>
                </div>
              }
              items={(otherCosts || []) as Cost[]}
            >
              {(item: Cost) => (
                <TableRow key={item._id as string} className="odd:bg-default-50/40">
                  {(columnKey) => (
                    <TableCell>{renderCell(item, columnKey)}</TableCell>
                  )}
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
                  {formData._id ? "Edit Expense" : "Add Expense"}
                </h2>
                <p className="text-sm text-default-500">
                  Track operational costs for better P&L visibility
                </p>
              </ModalHeader>
              <ModalBody className="bg-default-50 gap-6 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Expense Name"
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
                    onSelectionChange={(keys) =>
                      setFormData({
                        ...formData,
                        frequency: Array.from(keys)[0] as string,
                      })
                    }
                  >
                    {frequencies.map((freq) => (
                      <SelectItem key={freq.key}>{freq.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Effective From"
                    size="sm"
                    labelPlacement="outside"
                    type="date"
                    value={
                      (typeof formData.effectiveFrom === "string"
                        ? formData.effectiveFrom
                        : formData.effectiveFrom
                            ?.toISOString()
                            .split("T")[0]) ||
                      new Date().toISOString().split("T")[0]
                    }
                    onValueChange={(value) =>
                      setFormData({ ...formData, effectiveFrom: value })
                    }
                  />
                  
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
        message="Are you sure you want to delete this expense? This action cannot be undone."
        title="Delete Expense"
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
