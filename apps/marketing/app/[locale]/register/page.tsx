import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPageClient } from "@/app/[locale]/_components/auth-page-client";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";
import { buildLocalizedMetadata } from "@/src/site/config";

type AuthRuntimeConfig = {
  gatewayURL: string;
  appURL: string;
};

function loadRuntimeConfig(): AuthRuntimeConfig {
  return {
    gatewayURL: process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:50000",
    appURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:30004",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "metadata" });

  return {
    ...buildLocalizedMetadata({
      locale: resolvedLocale,
      pathname: "/register",
      title: t("registerTitle"),
      description: t("registerDescription"),
    }),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function RegisterPage() {
  return <AuthPageClient config={loadRuntimeConfig()} mode="registration" />;
}
