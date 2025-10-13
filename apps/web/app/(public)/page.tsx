import Divider from "@/components/home/Divider";
import { Faq } from "@/components/home/faq";
import { Feature } from "@/components/home/Feature";
import { Hero } from "@/components/home/Hero";
import { Integration } from "@/components/home/Integration";
import { Pricing } from "@/components/home/Pricing";
import { Testimonial } from "@/components/home/Testimonial";

export default function Home() {
  return (
    <div className="flex w-full flex-col items-center">
      <Hero />
      <Divider />
      <Integration />
      <Divider />
      <Feature />
      <Divider />
      <Testimonial />
      <Divider />
      <Pricing />
      <Divider />
      <Faq />
    </div>
  );
}
