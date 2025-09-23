import { Hero } from "@/components/home/Hero";
import { Faq } from "@/components/home/faq";
import { Pricing } from "@/components/home/Pricing";
import { Integration } from "@/components/home/Integration";
import { Feature } from "@/components/home/Feature";
import { Testimonial } from "@/components/home/Testimonial";

export default function Home() {
  return (
    <div className="flex w-full flex-col items-center">
      <Hero />
      <Integration />
      <Feature />
      <Testimonial />
      <Pricing />
      <Faq />
    </div>
  );
}
