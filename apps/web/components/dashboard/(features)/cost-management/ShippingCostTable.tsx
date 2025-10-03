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
// Delete flow removed; only edit/set single shipping cost
import type { GenericId as Id } from "convex/values";
import {
  useShippingCosts,
  useCreateShippingCost as useUpsertShippingCost,
} from "@/hooks";
import { useUserContext } from "@/contexts/UserContext";
import { getCurrencySymbol } from "@/libs/utils/format";
import { TableSkeleton } from "@/components/shared/skeletons";
import {
  DATA_TABLE_HEADER_CLASS,
  DATA_TABLE_SIMPLE_ROW_STRIPE_CLASS,
  DATA_TABLE_TABLE_CLASS,
} from "@/components/shared/table/DataTableCard";

const columns = [
  { name: "Name", uid: "name" },
  { name: "Shipping Price", uid: "baseRate" },
  { name: "Actions", uid: "actions" },
];

// Simplified: single flat shipping amount

interface ShippingFormData {
  _id?: Id<"globalCosts">;
  name?: string;
  baseRate?: number;
}

interface ShippingCostItem {
  _id: Id<"globalCosts">;
  name: string;
  type: "shipping";
  baseRate?: number;
  value?: number;
}

export default function ShippingCostTable() {
  
  const [formData, setFormData] = useState<ShippingFormData>({});
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const { primaryCurrency } = useUserContext();
  const currency = primaryCurrency;
  const { shippingCosts: allShippingCosts, loading } = useShippingCosts();
  const baseCosts = (allShippingCosts || []) as ShippingCostItem[];
  const shippingCosts: ShippingCostItem[] = baseCosts.slice(0, 1);
  const upsertShippingCost = useUpsertShippingCost();

  const handleEdit = (item: ShippingCostItem) => {
    setFormData(item);
    onOpen();
  };

  const handleAdd = () => {
    setFormData({
      name: "",
      baseRate: 0,
    });
    onOpen();
  };

  const handleSave = async () => {
    try {
      await upsertShippingCost({
        name: formData.name || "Shipping",
        value: formData.baseRate || 0,
        calculation: "FIXED",
      });
      addToast({
        title: formData._id ? "Shipping cost updated" : "Shipping cost added",
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

  // Weight tiers and delete flow removed for simplified single-price shipping

  const renderCell = (item: ShippingCostItem, columnKey: React.Key) => {
    switch (columnKey) {
      case "name":
        return <span className="font-medium">{item.name}</span>;

      case "baseRate":
        return (
          <span>
            {typeof item.value === "number"
              ? `${getCurrencySymbol(currency)}${(item.value || 0).toFixed(2)}`
              : "-"}
          </span>
        );

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
        <h2 className="text-xl font-semibold">Shipping Costs</h2>
        {shippingCosts.length === 0 ? (
          <Button
            color="primary"
            startContent={<Icon icon="solar:add-square-bold" width={16} />}
            isDisabled={loading}
            onPress={handleAdd}
          >
            Set Shipping Cost
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
            aria-label="Shipping costs table"
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
                    icon="solar:delivery-bold-duotone"
                    width={48}
                  />
                  <p className="mb-2 text-default-500">No shipping costs added yet</p>
                  <p className="text-small text-default-400">
                    Add shipping costs to track delivery expenses
                  </p>
                </div>
              }
              items={shippingCosts || []}
            >
              {(item: ShippingCostItem) => (
                <TableRow
                  key={item._id}
                  className={DATA_TABLE_SIMPLE_ROW_STRIPE_CLASS}
                >
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal isOpen={isOpen} size="2xl" onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {formData._id ? "Edit Shipping Cost" : "Set Shipping Cost"}
              </ModalHeader>
              <ModalBody className="bg-default-50 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Name"
                    labelPlacement="outside"
                    size="sm"
                    value={formData.name || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, name: value })
                    }
                  />
                  <Input
                    isRequired
                    label="Shipping Price"
                    labelPlacement="outside"
                    size="sm"
                    startContent={getCurrencySymbol(currency)}
                    type="number"
                    value={formData.baseRate?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        baseRate: parseFloat(value) || 0,
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
                  isDisabled={!formData.name}
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
