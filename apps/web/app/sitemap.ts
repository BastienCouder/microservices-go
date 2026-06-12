import type { MetadataRoute } from "next";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/src/i18n/config";
import {
  getLanguageAlternates,
  getLocalizedURL,
  publicSitemapPages,
} from "@/src/site/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicSitemapPages.flatMap((page) =>
    locales.map((locale: Locale) => ({
      url: getLocalizedURL(locale, page.pathname),
      lastModified,
      changeFrequency: page.changeFrequency,
      priority:
        locale === defaultLocale
          ? page.priority
          : Math.max(page.priority - 0.1, 0.5),
      alternates: {
        languages: getLanguageAlternates(page.pathname),
      },
    }))
  );
}