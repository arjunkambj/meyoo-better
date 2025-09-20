import Divider from "@/components/home/Divider";
import FAQ from "@/components/home/FAQ";
import Hero from "@/components/home/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import Integrations from "@/components/home/Integrations";
import Testimonials from "@/components/home/Testimonials";

export default function Home() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Enhanced background gradient for all public pages */}

      {/* Hero Section - Gradient background */}
      <section className="w-full">
        <Hero />
      </section>

      <Divider />

      <section id="integrations" className="scroll-mt-28">
        <Integrations />
      </section>

      <Divider />

      <section id="benefits" className="scroll-mt-28">
        <HowItWorks />
      </section>

      <Divider />

      {/* Testimonials - Clean background */}
      <section id="testimonials" className="scroll-mt-28">
        <Testimonials />
      </section>

      <Divider />

      {/* FAQ - Clean background */}
      <section id="faq" className="scroll-mt-28">
        <FAQ />
      </section>
    </div>
  );
}
