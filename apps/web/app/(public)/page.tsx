import { Hero } from "@/components/home/Hero";
import { Faq } from "@/components/home/faq";

export default function Home() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Enhanced background gradient for all public pages */}

      {/* Hero Section - Gradient background */}
      <section className="w-full">
        <Hero />
      </section>

      {/* FAQ - Clean background */}
      <section id="faq" className="scroll-mt-28">
        <Faq />
      </section>
    </div>
  );
}
