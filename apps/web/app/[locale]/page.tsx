import type { Metadata } from "next";
import { Navigation } from "@/app/[locale]/_components/navigation";
import { HeroSection } from "@/app/[locale]/_components/hero-section";
import { InfrastructureSection } from "@/app/[locale]/_components/infrastructure-section";
import { IntegrationsSection } from "@/app/[locale]/_components/integrations-section";
import { DevelopersSection } from "@/app/[locale]/_components/developers-section";
import { FaqSection } from "@/app/[locale]/_components/faq-section";
import { FooterSection } from "@/app/[locale]/_components/footer-section";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";
import { buildLocalizedMetadata } from "@/src/site/config";
import { getTranslations } from "next-intl/server";
import LinearHeroCard, { LinearMonitoringPreview } from "./_components/linear-card";
import { Separator } from "@/components/ui/separator";
import { SegmentsSection } from "./_components/segments-section";
import { PricingSection } from "@/components/pricing/pricing-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "metadata" });

  return buildLocalizedMetadata({
    locale: resolvedLocale,
    pathname: "/",
    title: t("homeTitle"),
    description: t("homeDescription"),
  });
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <HeroSection />
      <LinearHeroCard
        title="Faster app launch"
        description="Render UI before vehicle_state sync."
        eyebrow="ENG-2703"
      >
        <LinearMonitoringPreview />
      </LinearHeroCard>

      <Separator />
      <SegmentsSection />

      <InfrastructureSection />
      <IntegrationsSection />
      <DevelopersSection />
      <PricingSection />
      <FaqSection />
      <FooterSection />
    </main>
  );
}
