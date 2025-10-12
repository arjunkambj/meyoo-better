"use client";

import { IntegrationCard } from "./IntegrationCard";

export const upcomingIntegrations = [
  {
    id: "amazon",
    name: "Amazon",
    description: "Sync your Amazon seller account for multi-channel analytics",
    icon: "simple-icons:amazon",
    color: "#FF9900",
    category: "ecommerce",
    releaseDate: "Coming in Q1 2026",
    features: [
      "FBA inventory sync",
      "Sales analytics",
      "Review monitoring",
      "PPC campaign data",
    ],
  },
  {
    id: "snapchat",
    name: "Snapchat Ads",
    description: "Track your Snapchat advertising campaigns and performance",
    icon: "streamline-ultimate-color:snapchat-logo",
    color: "#FFFC00",
    category: "marketing",
    releaseDate: "Coming in Q1 2026",
    features: [
      "Campaign performance tracking",
      "Snap Ads analytics",
      "Story Ads metrics",
      "Audience insights",
    ],
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    description: "Monitor your TikTok Shop sales and advertising performance",
    icon: "logos:tiktok-icon",
    color: "#000000",
    category: "ecommerce",
    releaseDate: "Coming in Q1 2026",
    features: [
      "Shop analytics",
      "Video performance",
      "Live commerce tracking",
      "Creator marketplace",
    ],
  },
  {
    id: "shiprocket",
    name: "Shiprocket",
    description: "Integrate shipping and logistics data from Shiprocket",
    icon: "simple-icons:rocket",
    color: "#7C3AED",
    category: "shipping",
    releaseDate: "Coming in Q1 2026",
    features: [
      "Shipment tracking",
      "Delivery analytics",
      "Return management",
      "Shipping cost optimization",
    ],
  },
];

export function UpcomingIntegrations() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {upcomingIntegrations.map((integration) => (
        <IntegrationCard
          key={integration.id}
          category={integration.category}
          color={integration.color}
          description={integration.description}
          features={integration.features}
          icon={integration.icon}
          isConnected={false}
          isUpcoming={true}
          name={integration.name}
          platform={integration.id}
          releaseDate={integration.releaseDate}
        />
      ))}
    </div>
  );
}
