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
import {
  useCreateTransactionFee,
  useCurrentUser,
  useTransactionFees,
} from "@/hooks";
import { TableSkeleton } from "@/components/shared/skeletons";
import { DATA_TABLE_HEADER_CLASS, DATA_TABLE_TABLE_CLASS } from "@/components/shared/table/DataTableCard";
// Local types to avoid tight coupling to domain Cost
type TransactionCost = {
  _id?: string;
  name?: string;
  provider?: string;
  description?: string;
  calculation?: string;
  value?: number;
  isActive?: boolean;
  effectiveFrom?: number;
  config?: {
    percentageFee?: number;
    fixedFee?: number;
    chargebackFee?: number;
    refundFee?: number;
    disputeFee?: number;
    volumeTiers?: Array<{
      minVolume: number;
      maxVolume?: number;
      percentageFee: number;
      fixedFee: number;
    }>;
  };
};
// Note: using loose runtime typing from Convex, but state uses TransactionCost

const columns = [
  { name: "Name", uid: "provider" },
  { name: "Processing Fee", uid: "fees" },
  { name: "Actions", uid: "actions" },
];

// Simplified: a single provider name and a single percentage fee

interface PaymentFormData extends Partial<TransactionCost> {
  percentageFee?: number;
  fixedFee?: number;
}

export default function PaymentFeesTable() {
  
  const [formData, setFormData] = useState<PaymentFormData>({});
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  // Delete disabled: single processing fee only

  const _user = useCurrentUser();

  const { fees: allTransactionCosts, loading } = useTransactionFees();
  const transactionCosts = (allTransactionCosts as TransactionCost[] | undefined)?.slice(0, 1);
  const upsertTransactionCost = useCreateTransactionFee();

  const handleEdit = (item: TransactionCost) => {
    // Extract data from item including config
    const formDataToSet: PaymentFormData = {
      ...item,
      config: {
        ...item.config,
        percentageFee: item.config?.percentageFee || item.value || 0,
        fixedFee: item.config?.fixedFee || 0,
      },
    };

    setFormData(formDataToSet);
    onOpen();
  };

  const handleAdd = () => {
    setFormData({ provider: "Stripe", config: { percentageFee: 2.9 } });
    onOpen();
  };

  const handleSave = async () => {
    try {
      await upsertTransactionCost({
        name: formData.provider || "",
        value: formData.config?.percentageFee || formData.percentageFee || 0,
        calculation: "PERCENTAGE",
        provider: formData.provider,
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
      case "provider":
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-default-900">
              {item.provider || item.name || "Payment Processor"}
            </p>
            <p className="truncate text-xs text-default-500">{item.name}</p>
          </div>
        );

      case "fees": {
        const percentageFee =
          item.config?.percentageFee ??
          (item.calculation?.toLowerCase() === "percentage" ? item.value : undefined);
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
              variant="light"
              onPress={() => handleEdit(item)}
            >
              <Icon icon="lucide:edit" width={16} />
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
              td: "py-2.5 px-3 text-sm text-default-700 align-middle",
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
                <TableRow key={item._id} className="odd:bg-default-50/40">
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
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
              <ModalHeader>
                {formData._id ? "Edit Payment Fee" : "Set Payment Fee"}
              </ModalHeader>
              <ModalBody className="bg-default-50 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Provider Name"
                    labelPlacement="outside"
                    size="sm"
                    value={formData.provider || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, provider: value })
                    }
                  />
                  <Input
                    isRequired
                    endContent="%"
                    label="Processing Fee (%)"
                    labelPlacement="outside"
                    step="0.01"
                    type="number"
                    value={(formData.config?.percentageFee || "").toString()}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        config: {
                          ...formData.config,
                          percentageFee: parseFloat(value) || 0,
                        },
                      })
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
                  isDisabled={!formData.provider || !((formData.config?.percentageFee ?? 0) > 0)}
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
