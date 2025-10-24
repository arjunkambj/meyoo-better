import Divider from "@/components/home/Divider";
import { Faq } from "@/components/home/faq";
import { Feature } from "@/components/home/Feature";
import { Hero } from "@/components/home/Hero";
import { Integration } from "@/components/home/Integration";
import { Pricing } from "@/components/home/Pricing";
import { Testimonial } from "@/components/home/Testimonial";

export default function Home() {
  return (
    <div className="flex w-full flex-col items-center">
      <Hero />
      <Divider />
      <Integration />
      <Divider />
      <Feature />
      <Divider />
      <Testimonial />
      <Divider />
      <Pricing />
      <Divider />
      <Faq />
    </div>
  );
}
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meyoo — Profit Analytics for D2C Brands",
  description:
    "See real profit by order, SKU, and campaign. Meyoo unifies sales, ad spend, and costs so D2C teams can cut waste and scale what works. Start free—no credit card.",
  openGraph: {
    title: "Know your true profit.",
    description:
      "One clean view of revenue, costs, spend, and profit—so you can grow with confidence.",
    url: "/",
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
    title: "Know your true profit.",
    description:
      "One clean view of revenue, costs, spend, and profit—so you can grow with confidence.",
    images: ["/dark-meyoo.png"],
  },
};
