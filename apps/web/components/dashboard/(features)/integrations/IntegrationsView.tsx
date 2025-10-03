"use client";

import { Button, Skeleton, Tab, Tabs } from "@heroui/react";
import { Spacer } from "@heroui/spacer";
import { Icon } from "@iconify/react";
import { useCallback, useState } from "react";
import { INTEGRATIONS } from "@/constants/features/integrations";
import { useIntegration } from "@/hooks";

import { IntegrationCard } from "./components/IntegrationCard";
import { RequestIntegrationModal } from "./components/RequestIntegrationModal";
import { UpcomingIntegrations } from "./components/UpcomingIntegrations";

type IntegrationItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  required?: boolean;
  features: string[];
  status: unknown;
  isConnected?: boolean;
};

export function IntegrationsView() {
  const [selectedTab, setSelectedTab] = useState("all");
  // Settings modal is disabled for now; hide unused state
  const [showRequestModal, setShowRequestModal] = useState(false);

  const { shopify, meta, loading } = useIntegration();
  // const { requests, hasRequestedPlatform } = useIntegrationRequests();

  const connectedIntegrations: IntegrationItem[] = [
    ...(shopify.connected
      ? [{ ...INTEGRATIONS.SHOPIFY, status: shopify }]
      : []),
    ...(meta.connected ? [{ ...INTEGRATIONS.META, status: meta }] : []),
  ];

  const availableIntegrations: IntegrationItem[] = [
    ...(!shopify.connected
      ? [{ ...INTEGRATIONS.SHOPIFY, status: shopify }]
      : []),
    ...(!meta.connected ? [{ ...INTEGRATIONS.META, status: meta }] : []),
  ];

  const allIntegrations: IntegrationItem[] = [
    {
      ...INTEGRATIONS.SHOPIFY,
      status: shopify,
      isConnected: shopify.connected,
    },
    { ...INTEGRATIONS.META, status: meta, isConnected: meta.connected },
  ];

  const handleConnect = useCallback((platform: string) => {
    // Redirect to OAuth flow
    switch (platform) {
      case "shopify":
        window.location.href = "/api/v1/shopify/auth";
        break;
      case "meta":
        window.location.href = "/api/v1/meta/auth";
        break;
    }
  }, []);

  const handleDisconnect = useCallback(
    async (platform: string) => {
      // Handle disconnection
      switch (platform) {
        case "meta":
          await meta.disconnect();
          break;
        // Shopify disconnection handled differently
      }
    },
    [meta],
  );

  const handleRequestSuccess = useCallback(() => {
    // Optionally refresh requests or show success message
    setShowRequestModal(false);
  }, []);

  const renderLoadingState = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50 p-5"
        >
          <div className="flex items-start gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-5 w-24 mb-2 rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <Spacer y={0.5} />
      {/* Integration Tabs */}
      <div>
        <Tabs
          aria-label="Integration tabs"
          classNames={{
            base: "w-full",
            tabList:
              "gap-0 w-full relative rounded-none p-0 border-b border-divider bg-transparent",
            tab: "max-w-fit px-6 h-12 rounded-none border-b-2 border-transparent data-[selected=true]:border-primary data-[selected=true]:text-primary font-medium text-default-600 hover:text-default-900 transition-colors",
            tabContent: "group-data-[selected=true]:text-primary",
            cursor: "w-full bg-transparent",
            panel: "pt-6 px-0",
          }}
          selectedKey={selectedTab}
          variant="underlined"
          onSelectionChange={(key) => setSelectedTab(String(key))}
        >
          <Tab
            key="all"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:widget-2-bold-duotone" width={18} />
                <span>All ({allIntegrations.length})</span>
              </div>
            }
          >
            {loading ? (
              renderLoadingState()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    category={integration.category}
                    color={integration.color}
                    description={integration.description}
                    features={integration.features}
                    icon={integration.icon}
                    isConnected={Boolean(integration.isConnected)}
                    name={integration.name}
                    platform={integration.id}
                    required={integration.required}
                    status={integration.status}
                    onConnect={() => handleConnect(integration.id)}
                    onDisconnect={() => handleDisconnect(integration.id)}
                    // Settings modal disabled
                  />
                ))}
              </div>
            )}
          </Tab>

          <Tab
            key="connected"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:link-circle-bold-duotone" width={18} />
                <span>Connected ({connectedIntegrations.length})</span>
              </div>
            }
          >
            {loading ? (
              renderLoadingState()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {connectedIntegrations.length > 0 ? (
                  connectedIntegrations.map((integration) => (
                    <IntegrationCard
                      key={integration.id}
                      category={integration.category}
                      color={integration.color}
                      description={integration.description}
                      features={integration.features}
                      icon={integration.icon}
                      isConnected={true}
                      name={integration.name}
                      platform={integration.id}
                      status={integration.status}
                      onConnect={() => handleConnect(integration.id)}
                      onDisconnect={() => handleDisconnect(integration.id)}
                      // Settings modal disabled
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <Icon
                      className="text-default-300 mx-auto mb-4"
                      icon="solar:link-broken-bold-duotone"
                      width={64}
                    />
                    <p className="text-default-500 mb-4">
                      No integrations connected yet
                    </p>
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={() => setSelectedTab("available")}
                    >
                      Browse Available Integrations
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Tab>

          <Tab
            key="available"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:add-square-bold-duotone" width={18} />
                <span>Available ({availableIntegrations.length})</span>
              </div>
            }
          >
            {loading ? (
              renderLoadingState()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {availableIntegrations.length > 0 ? (
                  availableIntegrations.map((integration) => (
                    <IntegrationCard
                      key={integration.id}
                      category={integration.category}
                      color={integration.color}
                      description={integration.description}
                      features={integration.features}
                      icon={integration.icon}
                      isConnected={false}
                      name={integration.name}
                      platform={integration.id}
                      required={integration.required}
                      status={integration.status}
                      onConnect={() => handleConnect(integration.id)}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-12">
                    <Icon
                      className="text-success mx-auto mb-4"
                      icon="solar:check-circle-bold-duotone"
                      width={64}
                    />
                    <p className="text-default-500">
                      All available integrations are connected!
                    </p>
                    <p className="text-sm text-default-400 mt-2">
                      Use the button below to request new integrations
                    </p>
                  </div>
                )}
              </div>
            )}
          </Tab>

          <Tab
            key="upcoming"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="solar:hourglass-bold-duotone" width={18} />
                <span>Upcoming</span>
              </div>
            }
          >
            <UpcomingIntegrations />
          </Tab>
        </Tabs>

        {/* Request Integration Button */}
        <div className="md:mt-20 mt-8 flex flex-col items-center gap-3">
          <div className="text-center">
            <p className="text-sm text-default-600 ">
              Can&apos;t find the integration you need?
            </p>
          </div>
          <Button
            color="primary"
            radius="full"
            size="lg"
            startContent={
              <Icon icon="solar:add-square-bold-duotone" width={22} />
            }
            variant="shadow"
            onPress={() => setShowRequestModal(true)}
          >
            Request New Integration
          </Button>
        </div>
      </div>

      {/* Integration Settings Modal removed */}

      {/* Request Integration Modal */}
      <RequestIntegrationModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={handleRequestSuccess}
      />
    </div>
  );
}
