import { defaultLocale, getLocalizedPathname, locales, type Locale } from "@/src/i18n/config";

const DEFAULT_SITE_URL = "http://localhost:30000";

export function getSiteURL(): string {
  const rawValue =
    process.env.NEXT_PUBLIC_WEB_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_MARKETING_URL ??
    DEFAULT_SITE_URL;

  try {
    return new URL(rawValue).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function getLocalizedURL(locale: Locale, pathname = "/"): string {
  return `${getSiteURL()}${getLocalizedPathname(locale, pathname)}`;
}

export function getLanguageAlternates(pathname = "/"): Record<string, string> {
  return Object.fromEntries(locales.map((locale) => [locale, getLocalizedURL(locale, pathname)]));
}

export function buildLocalizedMetadata({
  locale,
  pathname,
  title,
  description,
}: {
  locale: Locale;
  pathname: string;
  title: string;
  description: string;
}) {
  return {
    metadataBase: new URL(getSiteURL()),
    title,
    description,
    alternates: {
      canonical: getLocalizedURL(locale, pathname),
      languages: getLanguageAlternates(pathname),
    },
    openGraph: {
      title,
      description,
      url: getLocalizedURL(locale, pathname),
      siteName: "Visia",
      type: "website" as const,
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
    },
  };
}

export const localizedPages = [
  "/",
  "/mentions-legales",
  "/politique-confidentialite",
  "/politique-retour",
  "/conditions-generales",
] as const;
export const sitemapDefaultLocale = defaultLocale;
