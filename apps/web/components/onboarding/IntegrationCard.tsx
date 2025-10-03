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
        "bg-default-50 dark:bg-default-100/50 border border-default-200 rounded-xl shadow-none transition-all duration-200",
        !isConnected && "hover:border-primary/20"
      )}
    >
      <CardBody className="px-5 py-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          {/* Logo */}
          <div className="rounded-lg border border-default-100 bg-default-50 p-3">
            <Icon className="text-foreground" icon={icon} width={20} />
          </div>

          {/* Info */}
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h3 className="font-medium text-default-900">{name}</h3>
              {required && (
                <Chip color="danger" size="sm" className="px-3">
                  Required
                </Chip>
              )}
              {comingSoon && (
                <Chip color="warning" size="sm">
                  Coming soon
                </Chip>
              )}
            </div>
            <p className="text-sm mt-0.5 text-default-700">{description}</p>
          </div>

          {/* Action Button */}
          <div className="shrink-0">
            {isLoading ? (
              <Button
                color="default"
                variant="flat"
                radius="lg"
                size="md"
                isDisabled
                startContent={<Spinner color="primary" size="sm" />}
              >
                Connecting...
              </Button>
            ) : isConnected ? (
              <div className="flex items-center gap-2">
                <Button
                  color="success"
                  size="md"
                  radius="lg"
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
                    size="md"
                    radius="lg"
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
                color="default"
                size="md"
                radius="lg"
                isDisabled
                variant="flat"
              >
                {comingSoonLabel ?? "Coming soon"}
              </Button>
            ) : (
              <Button
                color="primary"
                size="md"
                radius="lg"
                endContent={
                  <Icon icon="solar:arrow-right-line-duotone" width={18} />
                }
                onPress={onConnect}
              >
                Connect
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
});

export default SimpleIntegrationCard;
