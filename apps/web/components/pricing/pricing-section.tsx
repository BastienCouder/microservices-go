import { getPricingData } from "./pricing-data";
import { PricingSectionClient } from "./pricing-section-client";

export async function PricingSection() {
  const pricing = await getPricingData();

  return <PricingSectionClient pricing={pricing} />;
}