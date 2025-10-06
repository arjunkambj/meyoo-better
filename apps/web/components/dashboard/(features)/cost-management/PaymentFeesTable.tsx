"use client";

import {
  addToast,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
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
import { useCreateTransactionFee, useTransactionFees } from "@/hooks";
import { TableSkeleton } from "@/components/shared/skeletons";
import {
  DATA_TABLE_HEADER_CLASS,
  DATA_TABLE_SIMPLE_ROW_STRIPE_CLASS,
  DATA_TABLE_TABLE_CLASS,
} from "@/components/shared/table/DataTableCard";
// Local types to avoid tight coupling to domain Cost
type TransactionCost = {
  _id?: string;
  name?: string;
  description?: string;
  calculation?: string;
  value?: number;
  isActive?: boolean;
  effectiveFrom?: number;
};
// Note: using loose runtime typing from Convex, but state uses TransactionCost

const columns = [
  { name: "Name", uid: "name" },
  { name: "Processing Fee", uid: "fees" },
  { name: "Actions", uid: "actions" },
];

// Simplified: a single provider name and a single percentage fee

type PaymentFormData = Partial<TransactionCost>;

export default function PaymentFeesTable() {
  const [formData, setFormData] = useState<PaymentFormData>({});
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  // Delete disabled: single processing fee only

  const { fees: allTransactionCosts, loading } = useTransactionFees();
  const transactionCosts = (
    allTransactionCosts as TransactionCost[] | undefined
  )?.slice(0, 1);
  const upsertTransactionCost = useCreateTransactionFee();

  const handleEdit = (item: TransactionCost) => {
    setFormData({
      ...item,
      value: item.value ?? 0,
    });
    onOpen();
  };

  const handleAdd = () => {
    setFormData({ name: "Stripe", value: 2.9 });
    onOpen();
  };

  const handleSave = async () => {
    try {
      await upsertTransactionCost({
        name: formData.name || "",
        value: formData.value || 0,
        calculation: "PERCENTAGE",
        description: formData.description,
      });
      addToast({
        title: formData._id ? "Payment fee updated" : "Payment fee added",
        color: "default",
        timeout: 3000,
      });
      onOpenChange();
    } catch (_error) {
      addToast({
        title: "Failed to save",
        color: "danger",
        timeout: 3000,
      });
    }
  };

  // Delete flow removed in simplified UI

  const renderCell = (item: TransactionCost, columnKey: React.Key) => {
    switch (columnKey) {
      case "name":
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-default-900">
              {item.name || "Payment Processor"}
            </p>
            {item.description ? (
              <p className="truncate text-xs text-default-500">
                {item.description}
              </p>
            ) : null}
          </div>
        );

      case "fees": {
        const percentageFee =
          item.calculation?.toLowerCase() === "percentage"
            ? item.value
            : undefined;
        return (
          <span className="font-medium">
            {percentageFee != null ? `${percentageFee}%` : "-"}
          </span>
        );
      }

      case "actions":
        return (
          <div className="flex gap-2">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              onPress={() => handleEdit(item)}
            >
              <Icon icon="solar:pen-linear" width={16} />
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
        <h2 className="text-xl font-semibold">Payment Processing Fee</h2>
        {(transactionCosts?.length || 0) === 0 ? (
          <Button
            color="primary"
            startContent={<Icon icon="solar:add-square-bold" width={16} />}
            isDisabled={loading}
            onPress={handleAdd}
          >
            Set Fee
          </Button>
        ) : null}
      </div>
      {loading ? <Skeleton className="h-10 w-64 rounded-lg" /> : null}
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        {topContent}
        {loading ? (
          <div className={DATA_TABLE_TABLE_CLASS}>
            <TableSkeleton
              rows={3}
              columns={3}
              showHeader={false}
              showPagination={false}
              className="border border-default-200/60"
            />
          </div>
        ) : (
          <Table
            removeWrapper
            aria-label="Payment fees table"
            className={DATA_TABLE_TABLE_CLASS}
            classNames={{
              th: DATA_TABLE_HEADER_CLASS,
              td: "py-2.5 px-3 text-sm text-default-800 align-middle",
              table: "text-sm",
            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.uid}>{column.name}</TableColumn>
              )}
            </TableHeader>
            <TableBody
              emptyContent={
                <div className="py-10 text-center">
                  <Icon
                    className="mx-auto mb-4 text-default-300"
                    icon="solar:card-bold-duotone"
                    width={48}
                  />
                  <p className="mb-2 text-default-500">
                    No payment fee configured yet
                  </p>
                  <p className="text-small text-default-400">
                    Set a single processing fee for all transactions
                  </p>
                </div>
              }
              items={(transactionCosts as TransactionCost[]) || []}
            >
              {(item: TransactionCost) => (
                <TableRow
                  key={item._id}
                  className={DATA_TABLE_SIMPLE_ROW_STRIPE_CLASS}
                >
                  {(columnKey) => (
                    <TableCell>{renderCell(item, columnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal isOpen={isOpen} size="lg" onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="dark:bg-default-50">
                {formData._id ? "Edit Payment Fee" : "Set Payment Fee"}
              </ModalHeader>
              <ModalBody className="dark:bg-default-50 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Provider Name"
                    labelPlacement="outside"
                    value={formData.name || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, name: value })
                    }
                  />
                  <Input
                    isRequired
                    endContent="%"
                    label="Processing Fee (%)"
                    labelPlacement="outside"
                    step="0.01"
                    type="number"
                    value={
                      formData.value != null ? formData.value.toString() : ""
                    }
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        value: parseFloat(value) || 0,
                      })
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter className="dark:bg-default-50">
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isDisabled={!formData.name || !((formData.value ?? 0) > 0)}
                  onPress={handleSave}
                >
                  {formData._id ? "Update" : "Add"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
