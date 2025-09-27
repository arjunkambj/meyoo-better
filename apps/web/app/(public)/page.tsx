import { Hero } from "@/components/home/Hero";
import { Faq } from "@/components/home/faq";
import { Pricing } from "@/components/home/Pricing";
import { Integration } from "@/components/home/Integration";
import { Feature } from "@/components/home/Feature";
import { Testimonial } from "@/components/home/Testimonial";
import Divider from "@/components/home/Divider";

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
