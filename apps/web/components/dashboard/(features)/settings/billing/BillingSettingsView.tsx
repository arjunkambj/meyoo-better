"use client";
import { Card, CardBody } from "@heroui/react";
import { PlanUsageAlert } from "@/components/shared/billing/PlanUsageAlert";
import AvailablePlans from "./AvailablePlans";
import InvoicesList from "./InvoicesList";
import PlanOverview from "./PlanOverview";

export default function BillingSettingsView() {
  return (
    <div className="space-y-6 pb-8">
      {/* Plan Usage Alert */}
      <PlanUsageAlert variant="full" />

      {/* Current Plan - Moved to top */}
      <Card className="bg-content2 dark:bg-content1 rounded-xl border border-default-200/50 shadow-none">
        <CardBody className="p-4">
          <PlanOverview />
        </CardBody>
      </Card>

      {/* Billing History */}
      <Card className="bg-content2 dark:bg-content1 rounded-xl border border-default-200/50 shadow-none">
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
