import { getTranslations } from "next-intl/server";
import { AuthErrorPage } from "@/app/[locale]/_components/auth-error-page";
import { pickFirst, type PageSearchParams } from "@/src/auth/search-params";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";

type LocalizedAuthErrorPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

export default async function LocalizedAuthErrorPage({
  params,
  searchParams,
}: LocalizedAuthErrorPageProps) {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const t = await getTranslations({ locale: resolvedLocale, namespace: "auth" });

  return (
    <AuthErrorPage
      errorId={pickFirst(resolvedSearchParams?.id) || undefined}
      fallbackMessage={pickFirst(resolvedSearchParams?.error) || undefined}
      locale={resolvedLocale}
      strings={{
        secureAccess: t("secureAccess"),
        title: t("errorPage.title"),
        subtitle: t("errorPage.subtitle"),
        detailsLabel: t("errorPage.detailsLabel"),
        genericReason: t("errorPage.genericReason"),
        loadingReason: t("errorPage.loadingReason"),
        unavailableReason: t("errorPage.unavailableReason"),
        errorIdLabel: t("errorPage.errorIdLabel"),
        retryLogin: t("errorPage.retryLogin"),
        retryRegister: t("errorPage.retryRegister"),
        backHome: t("errorPage.backHome"),
      }}
    />
  );
}
