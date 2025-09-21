import CenteredNavbar from "@/components/home/Navbar";
import { ThemeSwitch } from "@/components/home/ThemeSwitch";
import { Footer } from "@/components/home/Footer";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`relative flex flex-col w-full min-h-screen bg-background`}>
      <ThemeSwitch />

      <CenteredNavbar />
      <main className="relative w-full flex-1 z-10">{children}</main>
      <Footer />
    </div>
  );
}
