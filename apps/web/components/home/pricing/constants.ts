import { type Frequency, FrequencyEnum, type Tier, TiersEnum } from "./types";

export const frequencies: Array<Frequency> = [
  {
    key: FrequencyEnum.Monthly,
    label: "Pay Monthly",
    priceSuffix: "per month",
  },
  { key: FrequencyEnum.Yearly, label: "Pay Yearly", priceSuffix: "per year" },
];

export const tiers: Array<Tier> = [
  {
    key: TiersEnum.Free,
    title: "Free",
    description: "Perfect for testing Meyoo.",
    href: "/auth",
    mostPopular: false,
    price: "$0",
    featured: false,
    features: [
      "Up to 300 orders/month",
      "Basic profit dashboard",
      "1 marketing channel",
      "3 free team members",
      "$10 per seat (AI included)",
      "Email support",
    ],
    buttonText: "Get Started",
    buttonColor: "default",
    buttonVariant: "flat",
  },
  {
    key: TiersEnum.Pro,
    title: "Starter",
    description: "Perfect for growing stores.",
    href: "/auth",
    mostPopular: false,
    price: {
      monthly: "$40",
      yearly: "$399", // 10 months price for 12 months
    },
    featured: false,
    features: [
      "Up to 1,200 orders/month",
      "Custom profit dashboard",
      "All marketing channels",
      "3 free team members",
      "$0.20 per extra order",
      "Max $299 overage charge",
      "Email support",
    ],
    buttonText: "Get Started",
    buttonColor: "default",
    buttonVariant: "flat",
  },
  {
    key: TiersEnum.Team,
    title: "Growth",
    href: "/auth",
    featured: true,
    mostPopular: true,
    description: "Most popular choice.",
    price: {
      monthly: "$90",
      yearly: "$899", // 10 months price for 12 months
    },
    features: [
      "Up to 3,500 orders/month",
      "Advanced analytics",
      "All marketing channels",
      "5 free team members",
      "$0.10 per extra order",
      "Max $399 overage charge",
      "Priority email support",
    ],
    buttonText: "Get Started",
    buttonColor: "primary",
    buttonVariant: "solid",
  },
  {
    key: TiersEnum.Custom,
    title: "Business",
    href: "/auth",
    featured: false,
    mostPopular: false,
    description: "For high-volume stores.",
    price: {
      monthly: "$160",
      yearly: "$1,599", // 10 months price for 12 months
    },
    features: [
      "Up to 7,500 orders/month",
      "AI-powered insights",
      "All marketing channels",
      "10 free team members",
      "$0.05 per extra order",
      "Max $499 overage charge",
      "Priority support",
      "Dedicated success manager",
    ],
    buttonText: "Get Started",
    buttonColor: "default",
    buttonVariant: "flat",
  },
];

// Agency-specific pricing (if needed)
export const agencyFeatures = {
  seats: {
    free: 3, // First 3 team members are free
    paidPrice: 15, // $15/month per additional seat (includes AI)
    aiAddOnPrice: 10, // $10/month to add AI to free seats
  },
  clients: {
    limit: "Unlimited", // Agencies can have unlimited clients
  },
  features: [
    "Unlimited client stores",
    "Client management dashboard",
    "Custom client naming",
    "Team member access control",
    "3 free team members",
    "AI add-on: +$10/month per user",
    "4th+ teammate: $15/month (AI included)",
  ],
};

// Overage pricing details
export const overagePricing = {
  starter: {
    ratePerOrder: 0.2,
    maxOverageCharge: 299,
  },
  growth: {
    ratePerOrder: 0.1,
    maxOverageCharge: 399,
  },
  business: {
    ratePerOrder: 0.05,
    maxOverageCharge: 499,
  },
};

// Seat pricing details
export const seatPricing = {
  freeSeats: 3,
  pricePerSeat: 15, // USD per month for additional seats (includes AI)
  aiAddOnPrice: 10, // USD per month to add AI to a free seat
  features: {
    free: [
      "Dashboard access",
      "View analytics",
      "Basic reports",
      "Email support",
      "Option to add AI for $10/month",
    ],
    freeWithAI: [
      "Everything in free tier",
      "AI Agent: 5 messages/day (50/month)",
      "AI-powered insights",
      "Predictive analytics",
      "Custom recommendations",
      "Advanced automation",
    ],
    paid: [
      "Everything in free tier",
      "AI Agent: 1,000 messages/month",
      "AI-powered insights (included)",
      "Predictive analytics",
      "Custom recommendations",
      "Advanced automation",
      "Priority support",
    ],
  },
  aiLimits: {
    free: {
      daily: 5,
      monthly: 50,
      description: "5 AI messages per day, 50 per month",
    },
    paid: {
      daily: 100, // Effectively unlimited
      monthly: 1000,
      description: "1,000 AI messages per month",
    },
  },
  breakdown: {
    freeSeat: {
      base: 0,
      aiAddOn: 10, // Optional
      total: "0 or 10", // Depending on AI
    },
    paidSeat: {
      base: 15, // Includes AI
      aiAddOn: 0, // Already included
      total: 15,
    },
  },
};
