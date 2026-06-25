import { getTranslations } from "next-intl/server";
import { AuthErrorPage } from "@/app/[locale]/_components/auth-error-page";
import { Navigation } from "@/app/[locale]/_components/navigation";
import { pickFirst, type PageSearchParams } from "@/src/auth/search-params";
import { defaultLocale } from "@/src/i18n/config";

type AuthErrorPageProps = {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

export default async function AuthErrorPageRoute({ searchParams }: AuthErrorPageProps) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const t = await getTranslations({ locale: defaultLocale, namespace: "auth" });

  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <header className="h-20 w-full shrink-0">
        <Navigation />
      </header>

      <section className="h-[calc(100vh-5rem)] w-full overflow-hidden">
        <AuthErrorPage
          errorId={pickFirst(resolvedSearchParams?.id) || undefined}
          fallbackMessage={pickFirst(resolvedSearchParams?.error) || undefined}
          locale={defaultLocale}
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
      </section>
    </main>
  );
}
