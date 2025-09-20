"use client";

import { Card, CardBody, Spacer } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function ReportView() {
  return (
    <div className="flex flex-col space-y-6 pb-20">
      <Spacer y={0.5} />
      <div className="h-full w-full">
        <Card className="w-full px-4 py-3 bg-content2 dark:bg-content1 border border-default-200/50 rounded-2xl">
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-warning/10 text-warning">
                  <Icon icon="solar:chart-square-bold" width={24} />
                </div>
                <div>
                  <p className="text-md font-semibold">Coming Soon</p>
                  <p className="text-small text-default-500">
                    Custom report builder in development
                  </p>
                </div>
              </div>
              <p className="text-default-600">Report builder coming soon.</p>
              <ul className="list-disc list-inside space-y-2 text-default-500">
                <li>Custom reports</li>
                <li>Scheduled delivery</li>
                <li>Export to PDF, Excel, CSV</li>
                <li>Team sharing</li>
              </ul>
              <div className="mt-6 p-4 bg-content2 rounded-xl">
                <p className="text-sm text-default-600 flex items-center gap-2">
                  <Icon icon="solar:info-circle-bold" width={16} />
                  Available Q4 2025.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
