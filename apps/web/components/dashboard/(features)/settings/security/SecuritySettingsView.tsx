"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Switch } from "@heroui/switch";
import { Icon } from "@iconify/react";
import { useAtom } from "jotai";
import { devToolsVisibleAtom } from "@/store/atoms";
import ApiKeyManagement from "./ApiKeyManagement";

export default function SecuritySettingsView() {
  const [devToolsVisible, setDevToolsVisible] = useAtom(devToolsVisibleAtom);

  return (
    <div className="space-y-6">
      <Card className="bg-content2 dark:bg-content1 rounded-xl border border-default-200/50 shadow-none">
        <CardHeader className="flex items-center gap-2">
          <Icon icon="solar:code-bold" width={20} />
          <h3 className="text-lg font-semibold">Developer Tools</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Show Developer Tools</span>
              <span className="text-xs text-default-500">
                Display developer tools and debugging information on the overview page
              </span>
            </div>
            <Switch
              isSelected={devToolsVisible}
              onValueChange={setDevToolsVisible}
              size="sm"
            />
          </div>
        </CardBody>
      </Card>

      <ApiKeyManagement />
    </div>
  );
}
