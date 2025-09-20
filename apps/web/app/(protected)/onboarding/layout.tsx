import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { api } from "@/libs/convexApi";
import { OnboardingLayoutClient } from "@/components/onboarding/layouts/OnboardingLayoutClient";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side onboarding status check - redirect if completed
  try {
    const token = await convexAuthNextjsToken();
    if (token) {
      const status = await fetchQuery(
        api.core.onboarding.getOnboardingStatus,
        {},
        { token }
      );
      if (status?.completed) {
        redirect("/overview");
      }
    }
  } catch {
    // If token/Convex unavailable, continue rendering onboarding
  }

  return (
    <section>
      <OnboardingLayoutClient>
        <div className="w-full  h-full">{children}</div>
      </OnboardingLayoutClient>
    </section>
  );
}
export const dynamic = "force-dynamic";
