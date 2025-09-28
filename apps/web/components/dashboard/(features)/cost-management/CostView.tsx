"use client";
import { Spacer } from "@heroui/react";
import { Tab, Tabs } from "@heroui/tabs";
import { Icon } from "@iconify/react";
import OtherCostsTable from "./OtherCostsTable";
import PaymentFeesTable from "./PaymentFeesTable";
import ProductCostTable from "./ProductCostTable";
import ShippingCostTable from "./ShippingCostTable";

export default function CostView() {
  return (
    <div className="flex flex-col space-y-6 pb-20">
      {/* Header */}
      <Spacer y={0.5} />

      {/* Tabs Section */}
      <div>
        <Tabs
          aria-label="Cost management tabs"
          classNames={{
            base: "w-full",
            tabList:
              "gap-0 w-full relative rounded-none p-0 border-b border-divider bg-transparent",
            tab: "max-w-fit px-6 h-12 rounded-none border-b-2 border-transparent data-[selected=true]:border-primary data-[selected=true]:text-primary font-medium text-default-600 hover:text-default-900 transition-colors",
            tabContent: "group-data-[selected=true]:text-primary",
            cursor: "w-full bg-transparent",
            panel: "pt-6 px-0",
          }}
          variant="underlined"
        >
          <Tab
            key="products"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:box-bold" width={18} />
                <span>Products</span>
              </div>
            }
          >
            <ProductCostTable />
          </Tab>

          <Tab
            key="shipping"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:delivery-bold" width={18} />
                <span>Shipping</span>
              </div>
            }
          >
            <ShippingCostTable />
          </Tab>

          <Tab
            key="payment"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:card-bold" width={18} />
                <span>Payment Fees</span>
              </div>
            }
          >
            <PaymentFeesTable />
          </Tab>

          {/* Tax & Fees tab removed: manage tax per product instead */}

          <Tab
            key="operating"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:wallet-bold" width={18} />
                <span>Operating Costs</span>
              </div>
            }
          >
            <OtherCostsTable />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
