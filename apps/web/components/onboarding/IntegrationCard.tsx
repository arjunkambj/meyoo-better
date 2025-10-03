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
        "bg-default-50 border border-default-200 rounded-2xl shadow-none transition-all duration-200",
        !isConnected && "hover:border-primary/50 hover:bg-default-100"
      )}
    >
      <CardBody className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
          {/* Left side - Logo and info */}
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center shrink-0 transition-colors bg-background">
              <Icon className="text-foreground" icon={icon} width={32} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 className="font-bold text-base text-default-900">
                  {name}
                </h3>
                {required && (
                  <Chip color="danger" size="sm" variant="flat">
                    Required
                  </Chip>
                )}
                {comingSoon && (
                  <Chip color="warning" size="sm" variant="flat">
                    Coming soon
                  </Chip>
                )}
              </div>
              <p className="text-sm text-default-600 line-clamp-2">
                {description}
              </p>
            </div>
          </div>

          {/* Right side - Status/Action */}
          <div className="shrink-0 w-full sm:w-auto">
            {isLoading ? (
              <div className="flex items-center justify-center sm:justify-start gap-2.5 text-default-600 bg-default-100 px-4 py-2.5 rounded-lg">
                <Spinner color="primary" size="sm" />
                <span className="text-sm font-medium">
                  Connecting...
                </span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-3">
                <Button
                  color="success"
                  variant="flat"
                  startContent={
                    <Icon icon="solar:check-circle-bold-duotone" width={18} />
                  }
                >
                  Connected
                </Button>
                {showDisconnect && onDisconnect && (
                  <Button
                    color="danger"
                    variant="flat"
                    startContent={
                      <Icon icon="solar:unlink-bold-duotone" width={16} />
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
                  className="w-full sm:w-auto font-semibold"
                  color="primary"
                  endContent={
                    <Icon icon="solar:arrow-right-bold-duotone" width={18} />
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
