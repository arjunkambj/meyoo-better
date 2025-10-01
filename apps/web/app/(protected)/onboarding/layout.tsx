import { OnboardingLayoutClient } from "@/components/onboarding/layouts/OnboardingLayoutClient";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Removed server-side status check to avoid duplicate queries
  // OnboardingLayoutClient handles redirect logic via client-side query
  return (
    <section>
      <OnboardingLayoutClient>
        <div className="w-full  h-full">{children}</div>
      </OnboardingLayoutClient>
    </section>
  );
}
export const dynamic = "force-dynamic";
