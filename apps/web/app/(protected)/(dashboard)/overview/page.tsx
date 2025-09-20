import { DevTools } from "@/components/dashboard/overview/DevTools";
import { UnifiedDashboard } from "@/components/dashboard/overview/UnifiedDashboard";

export default function OverviewPage() {
  return (
    <section className="flex flex-col gap-4">
      <UnifiedDashboard />
      <DevTools />
    </section>
  );
}
