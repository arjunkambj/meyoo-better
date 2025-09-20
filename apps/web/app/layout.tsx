import "@/styles/globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ToastProvider } from "@heroui/toast";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";

import { Providers } from "@/components/Providers";
import { siteConfig } from "@/constants/config/site";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.svg",
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
      <html suppressHydrationWarning lang="en">
        <head />
        <body>
          <Providers themeProps={{ attribute: "class", defaultTheme: "light" }}>
            <main className={`h-dvh w-full antialiased ${dmSans.className}`}>
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
