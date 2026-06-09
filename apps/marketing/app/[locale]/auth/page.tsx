import { redirect } from "next/navigation";
import { getLocalizedPathname, isLocale, defaultLocale, type Locale } from "@/src/i18n/config";

type AuthRedirectPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

export default async function AuthRedirectPage({ params, searchParams }: AuthRedirectPageProps) {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const nextSearchParams = new URLSearchParams();

  const returnTo = pickFirst(resolvedSearchParams?.return_to);
  const error = pickFirst(resolvedSearchParams?.error);

  if (returnTo) {
    nextSearchParams.set("return_to", returnTo);
  }

  if (error) {
    nextSearchParams.set("error", error);
  }

  const pathname = getLocalizedPathname(resolvedLocale, "/login");
  redirect(`${pathname}${nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : ""}`);
}
