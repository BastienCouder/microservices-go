import type { Metadata } from "next";
import { Navigation } from "@/app/[locale]/_components/navigation";
import { HeroSection } from "@/app/[locale]/_components/hero-section";
import { FeaturesSection } from "@/app/[locale]/_components/features-section";
import { HowItWorksSection } from "@/app/[locale]/_components/how-it-works-section";
import { InfrastructureSection } from "@/app/[locale]/_components/infrastructure-section";
import { MetricsSection } from "@/app/[locale]/_components/metrics-section";
import { IntegrationsSection } from "@/app/[locale]/_components/integrations-section";
import { SecuritySection } from "@/app/[locale]/_components/security-section";
import { DevelopersSection } from "@/app/[locale]/_components/developers-section";
import { TestimonialsSection } from "@/app/[locale]/_components/testimonials-section";
import { PricingSection } from "@/app/[locale]/_components/pricing-section";
import { CtaSection } from "@/app/[locale]/_components/cta-section";
import { FooterSection } from "@/app/[locale]/_components/footer-section";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";
import { buildLocalizedMetadata } from "@/src/site/config";
import { getTranslations } from "next-intl/server";

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
      <FeaturesSection />
      <HowItWorksSection />
      <InfrastructureSection />
     {/*  <MetricsSection /> */}
      <IntegrationsSection />
     {/*  <SecuritySection /> */}
      <DevelopersSection />
     {/*  <TestimonialsSection /> */}
      <PricingSection />
    {/*   <CtaSection /> */}
      <FooterSection />
    </main>
  );
}
