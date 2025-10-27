import { Pricing } from "@/components/home/Pricing";
import { designSystem } from "@/libs/design-system";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Meyoo",
  description:
    "Simple, transparent pricing. Start free for 28 days. Scale as you grow. Cancel anytime.",
  openGraph: {
    title: "Pricing — Meyoo",
    description:
      "Simple, transparent pricing. Start free for 28 days. Scale as you grow. Cancel anytime.",
    url: "/pricing",
    images: [
      {
        url: "/dark-meyoo.png",
        width: 1200,
        height: 630,
        alt: "Meyoo dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Meyoo",
    description:
      "Simple, transparent pricing. Start free for 28 days. Scale as you grow. Cancel anytime.",
    images: ["/dark-meyoo.png"],
  },
};

export default function PricingPage() {
  return (
    <div className={`min-h-screen ${designSystem.background.gradient} pt-24 pb-20`}>
      <Pricing />
    </div>
  );
}
