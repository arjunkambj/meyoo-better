"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import ApiKeyManagement from "./ApiKeyManagement";

export default function SecuritySettingsView() {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
        <CardHeader className="flex items-center gap-2">
          <Icon icon="solar:code-bold-duotone" width={20} />
          <h3 className="text-lg font-semibold text-default-800">
            Developer Tools
          </h3>
        </CardHeader>
        <CardBody className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-default-800">
                Show Developer Tools
              </span>
              <span className="text-xs text-default-500">
                Display developer tools and debugging information on the
                overview page
              </span>
            </div>
            {/* <Switch
              isSelected={devToolsVisible}
              onValueChange={setDevToolsVisible}
              size="sm"
            /> */}
          </div>
        </CardBody>
      </Card>

      <ApiKeyManagement />
    </div>
  );
}
