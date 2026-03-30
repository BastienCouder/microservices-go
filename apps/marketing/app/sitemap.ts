import type { MetadataRoute } from "next";
import {
  getLanguageAlternates,
  getLocalizedURL,
  localizedPages,
  sitemapDefaultLocale,
} from "@/src/site/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return localizedPages.map((pathname) => ({
    url: getLocalizedURL(sitemapDefaultLocale, pathname),
    lastModified,
    changeFrequency: pathname === "/" ? "weekly" : "monthly",
    priority: pathname === "/" ? 1 : 0.7,
    alternates: {
      languages: getLanguageAlternates(pathname),
    },
  }));
}
