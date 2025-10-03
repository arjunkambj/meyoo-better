import { Pricing } from "@/components/home/Pricing";
import { designSystem } from "@/libs/design-system";

export default function PricingPage() {
  return (
    <div className={`min-h-screen ${designSystem.background.gradient} pt-24 pb-20`}>
      <Pricing />
    </div>
  );
}
