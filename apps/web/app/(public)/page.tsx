import { Hero } from "@/components/home/Hero";
import { Faq } from "@/components/home/faq";
import { Pricing } from "@/components/home/Pricing";
import { Integration } from "@/components/home/Integration";

export default function Home() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Enhanced background gradient for all public pages */}
      <section className="w-full">
        <Hero />
      </section>

      {/* Hero Section - Gradient background */}
      <section className="w-full">
        <Integration />
      </section>

      <section className="w-full scroll-mt-24" id="pricing">
        <Pricing />
      </section>

      {/* FAQ - Clean background */}
      <section id="faq" className="scroll-mt-24">
        <Faq />
      </section>
    </div>
  );
}
