import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/app/[locale]/_components/legal-page";
import { buildLocalizedMetadata } from "@/src/site/config";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";

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
    pathname: "/politique-retour",
    title: t("returnPolicyTitle"),
    description: t("returnPolicyDescription"),
  });
}

const sectionKeys = [
  "scope",
  "withdrawal",
  "refunds",
  "exceptions",
] as const;

export default async function ReturnPolicyPage() {
  const t = await getTranslations("legalPages.returnPolicy");

  return (
    <LegalPage
      title={t("title")}
      intro={t("intro")}
      sections={sectionKeys.map((sectionKey) => ({
        title: t(`sections.${sectionKey}.title`),
        body: t.raw(`sections.${sectionKey}.body`) as string[],
      }))}
    />
  );
}
