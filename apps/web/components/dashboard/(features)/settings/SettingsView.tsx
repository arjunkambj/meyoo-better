"use client";

import { Spacer } from "@heroui/react";
import { Tab, Tabs } from "@heroui/tabs";
import { Icon } from "@iconify/react";

import SettingsLayoutClient from "./SettingsLayoutClient";
import BillingSettingsView from "./billing/BillingSettingsView";
import GeneralSettingsView from "./general/GeneralSettingsView";
import HelpSettingsView from "./help/HelpSettingsView";
import TeamSettingsView from "./team/TeamSettingsView";
import SecuritySettingsView from "./security/SecuritySettingsView";

export default function SettingsView() {
  return (
    <SettingsLayoutClient>
      <div className="flex flex-col space-y-6 pb-20">
        <Spacer y={0.5} />

        <Tabs
          aria-label="Settings sections"
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
            key="general"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:user-bold" width={18} />
                <span>General</span>
              </div>
            }
          >
            <GeneralSettingsView />
          </Tab>

          <Tab
            key="billing"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:card-bold" width={18} />
                <span>Billing &amp; Invoices</span>
              </div>
            }
          >
            <BillingSettingsView />
          </Tab>

          <Tab
            key="team"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:users-group-rounded-bold" width={18} />
                <span>Team</span>
              </div>
            }
          >
            <TeamSettingsView />
          </Tab>

          <Tab
            key="security"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:lock-keyhole-bold" width={18} />
                <span>MCP &amp; Security</span>
              </div>
            }
          >
            <SecuritySettingsView />
          </Tab>

          <Tab
            key="support"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:question-circle-bold" width={18} />
                <span>Help &amp; Support</span>
              </div>
            }
          >
            <HelpSettingsView />
          </Tab>
        </Tabs>
      </div>
    </SettingsLayoutClient>
  );
}
