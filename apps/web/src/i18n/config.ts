export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";
export const localePrefix = "always";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function stripLocalePrefix(pathname: string): string {
  const normalizedPathname = normalizePathname(pathname);

  for (const locale of locales) {
    if (normalizedPathname === `/${locale}`) {
      return "/";
    }

    if (normalizedPathname.startsWith(`/${locale}/`)) {
      const strippedPathname = normalizedPathname.slice(locale.length + 1);
      return strippedPathname.startsWith("/") ? strippedPathname : `/${strippedPathname}`;
    }
  }

  return normalizedPathname;
}

export function getLocalizedPathname(locale: Locale, pathname: string): string {
  const normalizedPathname = stripLocalePrefix(pathname);
  return normalizedPathname === "/" ? `/${locale}` : `/${locale}${normalizedPathname}`;
}
