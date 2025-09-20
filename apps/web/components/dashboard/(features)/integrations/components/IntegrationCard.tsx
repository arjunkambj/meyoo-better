"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  platform: string;
  isConnected: boolean;
  required?: boolean;
  features?: string[];
  isUpcoming?: boolean;
  releaseDate?: string;
  status?: unknown;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSettings?: () => void;
  onNotifyMe?: () => void;
}

export function IntegrationCard({
  name,
  description,
  icon,
  color,
  isConnected,
  isUpcoming = false,
  releaseDate,
  onConnect,
  onSettings: _onSettings,
  onNotifyMe,
}: IntegrationCardProps) {
  return (
    <Card
      className="relative overflow-hidden bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50 transition-colors hover:border-primary/30"
      isPressable={false}
    >
      {/* Connection Status Indicator */}
      {isConnected && (
        <div className="absolute top-3 right-3">
          <div className="w-2 h-2 bg-success rounded-full" />
        </div>
      )}

      <CardBody className="p-5">
        {/* Header with icon and title */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${color}15`,
              borderWidth: "1px",
              borderColor: `${color}30`,
            }}
          >
            <Icon icon={icon} style={{ color }} width={26} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-foreground truncate">
                {name}
              </h3>
            </div>
            <p className="text-xs text-default-500 line-clamp-2 mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto pt-2">
          {isUpcoming ? (
            <Button
              className="w-full font-medium"
              color="default"
              size="sm"
              startContent={<Icon icon="solar:bell-bold" width={16} />}
              variant="flat"
              onPress={onNotifyMe}
            >
              {releaseDate}
            </Button>
          ) : isConnected ? (
            <Button
              className="w-full font-medium"
              color="success"
              size="sm"
              startContent={<Icon icon="solar:check-circle-bold" width={16} />}
            >
              Connected
            </Button>
          ) : (
            <Button
              className="w-full font-medium"
              color="primary"
              endContent={<Icon icon="solar:arrow-right-bold" width={16} />}
              size="sm"
              variant="solid"
              onPress={onConnect}
            >
              Connect
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
