import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { LAYOUT_STYLES } from "@/constants/styles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={LAYOUT_STYLES.mainContainer}>
      <aside className={LAYOUT_STYLES.sidebar.container}>
        <DashboardSidebar />
      </aside>
      <main className={LAYOUT_STYLES.main.container}>
        <div className={LAYOUT_STYLES.main.header}>
          <DashboardHeader />
        </div>
        <section className={LAYOUT_STYLES.main.content}>
          {children}
        </section>
      </main>
    </div>
  );
}
