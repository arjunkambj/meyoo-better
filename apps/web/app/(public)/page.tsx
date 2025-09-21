import { Hero } from "@/components/home/Hero";
import { Faq } from "@/components/home/faq";
import { Pricing } from "@/components/home/Pricing";

export default function Home() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Enhanced background gradient for all public pages */}

      {/* Hero Section - Gradient background */}
      <section className="w-full">
        <Hero />
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
