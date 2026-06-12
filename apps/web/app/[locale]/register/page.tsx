import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";
import { getLocalizedPathname } from "@/src/i18n/config";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;

  redirect(getLocalizedPathname(resolvedLocale, "/login"));
}