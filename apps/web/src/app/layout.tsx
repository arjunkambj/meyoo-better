import "@/styles/globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ToastProvider } from "@heroui/toast";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/Providers";
import { siteConfig } from "@/constants/config/site";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  title: {
    default: "Meyoo — Profit Analytics for D2C Brands",
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Know your true profit.",
    description:
      "One clean view of revenue, costs, spend, and profit—so you can grow with confidence.",
    url: "/",
    siteName: siteConfig.name,
    images: [
      {
        url: "/dark-meyoo.png",
        width: 1200,
        height: 630,
        alt: "Meyoo dashboard preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Know your true profit.",
    description:
      "One clean view of revenue, costs, spend, and profit—so you can grow with confidence.",
    images: ["/dark-meyoo.png"],
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <Providers>
            <main className={`h-dvh w-full antialiased ${inter.className}`}>
              <ToastProvider />
              <SpeedInsights />
              <Analytics />
              {children}
            </main>
          </Providers>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
