"use client";

import { Button, Card, CardBody, Chip, cn, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";


interface SimpleIntegrationCardProps {
  name: string;
  description: string;
  icon: string;
  isConnected?: boolean;
  isLoading?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  required?: boolean;
  showDisconnect?: boolean;
  comingSoon?: boolean;
  comingSoonLabel?: string;
}

const SimpleIntegrationCard = React.memo(function SimpleIntegrationCard({
  name,
  description,
  icon,
  isConnected = false,
  isLoading = false,
  onConnect,
  onDisconnect,
  required = false,
  showDisconnect = false,
  comingSoon = false,
  comingSoonLabel,
}: SimpleIntegrationCardProps) {
  return (
    <Card
        className={cn(
          "bg-content1 border border-divider/50 rounded-2xl transition-all",
          isConnected ? "border-success" : "hover:border-primary  "
        )}
      >
        <CardBody className="p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Left side - Logo and info */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center overflow-hidden bg-content2 shrink-0 ring-1 ring-default-200">
                <Icon className="text-foreground" icon={icon} width={28} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-base text-default-900">
                    {name}
                  </h3>
                  {required && (
                    <Chip color="danger" size="sm">
                      Required
                    </Chip>
                  )}
                  {comingSoon && (
                    <Chip color="warning" size="sm" variant="flat">
                      Coming soon
                    </Chip>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-default-600 line-clamp-1 sm:line-clamp-2">
                  {description}
                </p>
              </div>
            </div>

            {/* Right side - Status/Action */}
            <div className="shrink-0 w-full sm:w-auto">
              {isLoading ? (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-default-600 bg-default-100 px-3 sm:px-4 py-2 rounded-lg">
                  <Spinner color="primary" />
                  <span className="text-xs sm:text-sm font-medium">
                    Connecting...
                  </span>
                </div>
              ) : isConnected ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    color="success"
                    startContent={
                      <Icon icon="solar:check-circle-bold" width={18} />
                    }
                  >
                    Connected
                  </Button>
                  {showDisconnect && onDisconnect && (
                    <Button
                      color="danger"
                      startContent={
                        <Icon icon="solar:unlink-outline" width={16} />
                      }
                      onPress={onDisconnect}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              ) : comingSoon ? (
                <Button
                  className="w-full sm:w-auto"
                  color="default"
                  isDisabled
                  variant="flat"
                >
                  {comingSoonLabel ?? "Coming soon"}
                </Button>
              ) : (
                <div className="flex flex-col items-stretch sm:items-end">
                  <Button
                    className="w-full sm:w-auto"
                    color="primary"
                    endContent={
                      <Icon icon="solar:arrow-right-outline" width={16} />
                    }
                    onPress={onConnect}
                  >
                    Connect
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
  );
});

export default SimpleIntegrationCard;
