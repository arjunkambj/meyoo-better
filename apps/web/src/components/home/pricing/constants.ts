import { type Frequency, FrequencyEnum, type Tier, TiersEnum } from "./types";

export const frequencies: Array<Frequency> = [
  {
    key: FrequencyEnum.Monthly,
    label: "Pay Monthly",
    priceSuffix: "per month",
  },
  {
    key: FrequencyEnum.Yearly,
    label: "Pay Yearly",
    priceSuffix: "per year",
  },
];

export const tiers: Array<Tier> = [
  {
    key: TiersEnum.Free,
    title: "Free",
    description: "Perfect for a quick profit snapshot.",
    href: "/auth",
    mostPopular: false,
    price: "$0",
    period: {
      [FrequencyEnum.Monthly]: "Per month/store",
      [FrequencyEnum.Yearly]: "Per year/store",
    },
    featured: false,
    features: [
      "Up to 300 orders/month",
      "Basic Profit Dashboard",
      "1 Marketing Channel",
      "$10 Per Extra Seat (AI included)",
      "Email Support",
      "$0.30 per extra order",
    ],
    buttonText: "Start 28-day trial",
    buttonColor: "default",
    buttonVariant: "flat",
  },
  {
    key: TiersEnum.Pro,
    title: "Starter",
    description: "For growing brands getting serious about profit.",
    href: "/auth",
    mostPopular: false,
    price: {
      [FrequencyEnum.Monthly]: "$40",
      [FrequencyEnum.Yearly]: "$399",
    },
    period: {
      [FrequencyEnum.Monthly]: "Per month/store",
      [FrequencyEnum.Yearly]: "Per year/store",
    },
    featured: false,
    features: [
      "Up to 1,200 orders/month",
      "Custom Profit Dashboard",
      "1 Free Team Members",
      "Email Support",
      "$0.20 Per Extra Order",
      "Max $299 Overage Charge",
    ],
    buttonText: "Start 28-day trial",
    buttonColor: "default",
    buttonVariant: "flat",
  },
  {
    key: TiersEnum.Team,
    title: "Growth",
    href: "/auth",
    featured: true,
    mostPopular: true,
    description: "For teams that want levers, not just numbers.",
    price: {
      [FrequencyEnum.Monthly]: "$90",
      [FrequencyEnum.Yearly]: "$899",
    },
    period: {
      [FrequencyEnum.Monthly]: "Per month/store",
      [FrequencyEnum.Yearly]: "Per year/store",
    },
    features: [
      "Advanced Analytics",
      "MCP Support",
      "3 Free Team Members",
      "Email Support",
      "$0.10 Per Extra Order",
      "Max $399 Overage Charge",
    ],
    buttonText: "Start 28-day trial",
    buttonColor: "primary",
    buttonVariant: "solid",
  },
  {
    key: TiersEnum.Custom,
    title: "Business",
    href: "/auth",
    featured: false,
    mostPopular: false,
    description: "For complex setups and bigger teams.",
    price: {
      [FrequencyEnum.Monthly]: "$160",
      [FrequencyEnum.Yearly]: "$1,599",
    },
    period: {
      [FrequencyEnum.Monthly]: "Per month/store",
      [FrequencyEnum.Yearly]: "Per year/store",
    },
    features: [
      "Up to 7,500 orders/month",
      "AI-powered Insights",
      "5 Free Team Members",
      "$0.05 Per Extra Order",
      "Max $499 Overage Charge",
      "Priority Support",
    ],
    buttonText: "Talk to our team",
    buttonColor: "default",
    buttonVariant: "flat",
  },
];

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

export const seatPricing = {
  freeSeats: 3,
  pricePerSeat: 15,
  aiAddOnPrice: 10,
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
      daily: 100,
      monthly: 1000,
      description: "1,000 AI messages per month",
    },
  },
  breakdown: {
    freeSeat: {
      base: 0,
      aiAddOn: 10,
      total: "0 or 10",
    },
    paidSeat: {
      base: 15,
      aiAddOn: 0,
      total: 15,
    },
  },
};
