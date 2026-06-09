import { redirect } from "next/navigation";
import { toQueryString, type PageSearchParams } from "@/src/auth/search-params";
import { defaultLocale, getLocalizedPathname, isLocale, type Locale } from "@/src/i18n/config";

type LocalizedAuthLoginAliasPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

export default async function LocalizedAuthLoginAliasPage({
  params,
  searchParams,
}: LocalizedAuthLoginAliasPageProps) {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  redirect(`${getLocalizedPathname(resolvedLocale, "/login")}${toQueryString(resolvedSearchParams)}`);
}
