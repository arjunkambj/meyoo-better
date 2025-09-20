import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "@/components/Providers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
export const metadata: Metadata = {
  title: "Meyoo Admin",
  description: "Admin panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <Providers themeProps={{ attribute: "class", defaultTheme: "light" }}>
            <main>{children}</main>
          </Providers>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
