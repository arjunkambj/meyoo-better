import Header from "@/components/dashboard/layouts/DashBoardHeader";
import DashboardSidebar from "@/components/dashboard/layouts/DashboardSidebar";
import { ThemeSwitch } from "@/components/home/ThemeSwitch";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background py-6 border border-default-100">
      <ThemeSwitch />
      <aside className="h-full">
        <DashboardSidebar />
      </aside>
      <main className="flex flex-col min-w-0 w-full">
        <div className="px-6">
          <Header />
        </div>
        <section className="flex-1 pt-1 px-8 overflow-auto">{children}</section>
      </main>
      {/* Floating Agent Mode Button */}
    </div>
  );
}
