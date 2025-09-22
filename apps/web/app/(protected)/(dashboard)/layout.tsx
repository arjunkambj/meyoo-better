import Header from "@/components/dashboard/layouts/DashBoardHeader";
import DashboardSidebar from "@/components/dashboard/layouts/DashboardSidebar";
import AgentSidebar from "@/components/agent/AgentSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background border border-default-100">
      <div className="flex h-full w-full py-6">
        <aside className="h-full">
          <DashboardSidebar />
        </aside>
        <main className="flex flex-col min-w-0 flex-1">
          <div className="px-6">
            <Header />
          </div>
          <section className="flex-1 pt-1 px-8 overflow-auto">
            {children}
          </section>
        </main>
      </div>
      <AgentSidebar />
    </div>
  );
}
