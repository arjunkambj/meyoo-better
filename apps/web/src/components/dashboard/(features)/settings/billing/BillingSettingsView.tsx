"use client";
import { Card, CardBody } from "@heroui/card";
import AvailablePlans from "./AvailablePlans";
import InvoicesList from "./InvoicesList";
import PlanOverview from "./PlanOverview";

export default function BillingSettingsView() {
  return (
    <div className="space-y-6 pb-8">
      {/* Current Plan - Moved to top */}
      <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
        <CardBody className="px-5 py-5">
          <PlanOverview />
        </CardBody>
      </Card>

      {/* Billing History */}
      <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
        <CardBody className="p-0">
          <InvoicesList />
        </CardBody>
      </Card>

      {/* Available Plans (Pricing) - Moved below invoices */}
      <div>
        <AvailablePlans />
      </div>
    </div>
  );
}
