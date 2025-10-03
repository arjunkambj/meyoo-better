import type { ReactNode } from "react";
import { OnboardingLayoutClient } from "@/components/onboarding/layouts/OnboardingLayoutClient";
import { UserProvider } from "@/contexts/UserContext";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Removed server-side status check to avoid duplicate queries
  // OnboardingLayoutClient handles redirect logic via client-side query
  return (
    <UserProvider>
      <section>
        <OnboardingLayoutClient>
          <div className="w-full  h-full">{children}</div>
        </OnboardingLayoutClient>
      </section>
    </UserProvider>
  );
}
export const dynamic = "force-dynamic";
