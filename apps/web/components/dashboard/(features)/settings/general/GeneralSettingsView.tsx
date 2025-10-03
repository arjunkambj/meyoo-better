"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useUser } from "@/hooks";
import LeaveOrganizationButton from "../team/LeaveOrganizationButton";
import ProfileSection from "./ProfileSection";

export default function GeneralSettingsView() {
  const { role } = useUser();
  const canLeaveOrganization = role !== "StoreOwner";

  return (
    <div className="space-y-6">
      <ProfileSection />

      {canLeaveOrganization && (
        <Card className="rounded-2xl border border-default-100 shadow-none bg-content2 dark:bg-content1">
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-danger">
              <Icon icon="solar:warning-triangle-bold" width={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Danger zone
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-default-800">
                Leave this organization
              </p>
              <p className="text-sm text-default-500">
                Leaving removes your access to this store. We will spin up a
                personal workspace so you can onboard a new store or accept a
                fresh invite later.
              </p>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-default-500">
              Your account stays active, but everything tied to this
              organization becomes inaccessible right away.
            </p>
            <div className="flex justify-start md:justify-end">
              <LeaveOrganizationButton />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
