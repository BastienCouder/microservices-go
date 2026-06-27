import authEn from "@/messages/en/auth.json";
import ctaEn from "@/messages/en/cta.json";
import developersEn from "@/messages/en/developers.json";
import faqEn from "@/messages/en/faq.json";
import featuresEn from "@/messages/en/features.json";
import footerEn from "@/messages/en/footer.json";
import heroEn from "@/messages/en/hero.json";
import howItWorksEn from "@/messages/en/howItWorks.json";
import infrastructureEn from "@/messages/en/infrastructure.json";
import integrationsEn from "@/messages/en/integrations.json";
import legalEn from "@/messages/en/legal.json";
import legalPagesEn from "@/messages/en/legal-pages.json";
import localeSwitcherEn from "@/messages/en/localeSwitcher.json";
import metadataEn from "@/messages/en/metadata.json";
import metricsEn from "@/messages/en/metrics.json";
import navigationEn from "@/messages/en/navigation.json";
import pricingEn from "@/messages/en/pricing.json";
import segmentsEn from "@/messages/en/segments.json";

import authFr from "@/messages/fr/auth.json";
import ctaFr from "@/messages/fr/cta.json";
import developersFr from "@/messages/fr/developers.json";
import faqFr from "@/messages/fr/faq.json";
import featuresFr from "@/messages/fr/features.json";
import footerFr from "@/messages/fr/footer.json";
import heroFr from "@/messages/fr/hero.json";
import howItWorksFr from "@/messages/fr/howItWorks.json";
import infrastructureFr from "@/messages/fr/infrastructure.json";
import integrationsFr from "@/messages/fr/integrations.json";
import legalFr from "@/messages/fr/legal.json";
import legalPagesFr from "@/messages/fr/legal-pages.json";
import localeSwitcherFr from "@/messages/fr/localeSwitcher.json";
import metadataFr from "@/messages/fr/metadata.json";
import metricsFr from "@/messages/fr/metrics.json";
import navigationFr from "@/messages/fr/navigation.json";
import pricingFr from "@/messages/fr/pricing.json";
import segmentsFr from "@/messages/fr/segments.json";

import type { Locale } from "./config";

const messagesByLocale = {
  en: {
    navigation: navigationEn,
    localeSwitcher: localeSwitcherEn,
    metadata: metadataEn,
    auth: authEn,
    hero: heroEn,
    features: featuresEn,
    segments: segmentsEn,
    howItWorks: howItWorksEn,
    infrastructure: infrastructureEn,
    metrics: metricsEn,
    integrations: integrationsEn,
    legal: legalEn,
    legalPages: legalPagesEn,
    developers: developersEn,
    pricing: pricingEn,
    faq: faqEn,
    cta: ctaEn,
    footer: footerEn,
  },
  fr: {
    navigation: navigationFr,
    localeSwitcher: localeSwitcherFr,
    metadata: metadataFr,
    auth: authFr,
    hero: heroFr,
    features: featuresFr,
    segments: segmentsFr,
    howItWorks: howItWorksFr,
    infrastructure: infrastructureFr,
    metrics: metricsFr,
    integrations: integrationsFr,
    legal: legalFr,
    legalPages: legalPagesFr,
    developers: developersFr,
    pricing: pricingFr,
    faq: faqFr,
    cta: ctaFr,
    footer: footerFr,
  },
} as const;

export function getLocaleMessages(locale: Locale) {
  return messagesByLocale[locale];
}
