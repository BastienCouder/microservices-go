import type { MetadataRoute } from "next";
import { getSiteURL } from "@/src/site/config";

export default function robots(): MetadataRoute.Robots {
  const siteURL = getSiteURL();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api"],
    },
    host: new URL(siteURL).origin,
    sitemap: `${siteURL}/sitemap.xml`,
  };
}