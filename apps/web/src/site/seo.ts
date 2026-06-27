import type { Metadata } from "next";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/src/i18n/config";

export const siteName = "Visia";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
  "https://visia.app";

export const siteTwitterHandle = "@visia";

export const defaultOgImagePath = "/og/visia-og.png";

export const localeMeta: Record<
  Locale,
  {
    language: string;
    ogLocale: string;
    title: string;
    titleTemplate: string;
    description: string;
    keywords: string[];
    jsonLdDescription: string;
  }
> = {
  fr: {
    language: "fr-FR",
    ogLocale: "fr_FR",
    title: "Visia. Créez, gérez et automatisez votre présence digitale",
    titleTemplate: "%s | Visia",
    description:
      "Visia vous aide à créer, gérer et automatiser votre présence digitale avec des outils simples, rapides et adaptés aux créateurs, indépendants et entreprises.",
    keywords: [
      "Visia",
      "présence digitale",
      "création de contenu",
      "automatisation",
      "outil créateur",
      "outil indépendant",
      "outil entreprise",
      "marketing digital",
      "productivité",
      "SaaS marketing",
      "gestion digitale",
    ],
    jsonLdDescription:
      "Visia est une application web SaaS qui aide les créateurs, indépendants et entreprises à créer, gérer et automatiser leur présence digitale.",
  },
  en: {
    language: "en-US",
    ogLocale: "en_US",
    title: "Visia. Create, manage and automate your digital presence",
    titleTemplate: "%s | Visia",
    description:
      "Visia helps you create, manage and automate your digital presence with simple, fast tools for creators, freelancers and businesses.",
    keywords: [
      "Visia",
      "digital presence",
      "content creation",
      "automation",
      "creator tool",
      "freelancer tool",
      "business tool",
      "digital marketing",
      "productivity",
      "marketing SaaS",
      "digital management",
    ],
    jsonLdDescription:
      "Visia is a web SaaS application that helps creators, freelancers and businesses create, manage and automate their digital presence.",
  },
};

export const pageSeo: Record<
  Locale,
  Record<
    string,
    {
      title: string;
      description: string;
      keywords?: string[];
    }
  >
> = {
  fr: {
    "/": {
      title: "Outil pour créer et automatiser votre présence digitale",
      description:
        "Créez, gérez et automatisez votre présence digitale avec Visia. Une plateforme simple pour les créateurs, indépendants et entreprises.",
      keywords: [
        "outil présence digitale",
        "automatiser présence digitale",
        "outil marketing digital",
        "Visia",
      ],
    },
    "/pricing": {
      title: "Tarifs",
      description:
        "Découvrez les offres Visia et choisissez la formule adaptée à vos besoins pour gérer votre présence digitale.",
      keywords: [
        "tarifs Visia",
        "prix Visia",
        "abonnement Visia",
        "outil marketing prix",
      ],
    },
    "/faq": {
      title: "Questions fréquentes",
      description:
        "Retrouvez les réponses aux questions fréquentes sur Visia, la création de compte, les fonctionnalités et l’utilisation de la plateforme.",
      keywords: [
        "FAQ Visia",
        "questions Visia",
        "aide Visia",
        "connexion Visia",
      ],
    },
    "/features": {
      title: "Fonctionnalités",
      description:
        "Découvrez les fonctionnalités de Visia pour créer, organiser et automatiser votre présence digitale plus rapidement.",
      keywords: [
        "fonctionnalités Visia",
        "automatisation marketing",
        "création de contenu",
        "gestion digitale",
      ],
    },
    "/use-cases/creators": {
      title: "Visia pour les créateurs",
      description:
        "Visia aide les créateurs à gagner du temps, structurer leur contenu et développer leur présence digitale.",
      keywords: [
        "outil créateur",
        "outil créateur de contenu",
        "présence digitale créateur",
      ],
    },
    "/use-cases/freelancers": {
      title: "Visia pour les indépendants",
      description:
        "Visia aide les indépendants à gérer leur visibilité en ligne, automatiser leurs tâches et améliorer leur productivité.",
      keywords: [
        "outil indépendant",
        "outil freelance",
        "présence digitale freelance",
      ],
    },
    "/use-cases/businesses": {
      title: "Visia pour les entreprises",
      description:
        "Visia accompagne les entreprises dans la gestion et l’automatisation de leur présence digitale.",
      keywords: [
        "outil entreprise",
        "marketing digital entreprise",
        "automatisation entreprise",
      ],
    },
    "/login": {
      title: "Connexion",
      description:
        "Connectez-vous à Visia ou créez automatiquement votre compte lors de votre première connexion.",
      keywords: ["connexion Visia", "login Visia"],
    },
  },
  en: {
    "/": {
      title: "Tool to create and automate your digital presence",
      description:
        "Create, manage and automate your digital presence with Visia. A simple platform for creators, freelancers and businesses.",
      keywords: [
        "digital presence tool",
        "automate digital presence",
        "digital marketing tool",
        "Visia",
      ],
    },
    "/pricing": {
      title: "Pricing",
      description:
        "Explore Visia pricing and choose the plan that fits your digital presence management needs.",
      keywords: [
        "Visia pricing",
        "Visia plans",
        "Visia subscription",
        "marketing tool pricing",
      ],
    },
    "/faq": {
      title: "Frequently asked questions",
      description:
        "Find answers to common questions about Visia, account creation, features and platform usage.",
      keywords: [
        "Visia FAQ",
        "Visia questions",
        "Visia help",
        "Visia login",
      ],
    },
    "/features": {
      title: "Features",
      description:
        "Discover Visia features to create, organize and automate your digital presence faster.",
      keywords: [
        "Visia features",
        "marketing automation",
        "content creation",
        "digital management",
      ],
    },
    "/use-cases/creators": {
      title: "Visia for creators",
      description:
        "Visia helps creators save time, structure their content and grow their digital presence.",
      keywords: [
        "creator tool",
        "content creator tool",
        "digital presence for creators",
      ],
    },
    "/use-cases/freelancers": {
      title: "Visia for freelancers",
      description:
        "Visia helps freelancers manage their online visibility, automate tasks and improve productivity.",
      keywords: [
        "freelancer tool",
        "independent worker tool",
        "digital presence for freelancers",
      ],
    },
    "/use-cases/businesses": {
      title: "Visia for businesses",
      description:
        "Visia helps businesses manage and automate their digital presence.",
      keywords: [
        "business tool",
        "digital marketing for businesses",
        "business automation",
      ],
    },
    "/login": {
      title: "Login",
      description:
        "Log in to Visia or automatically create your account during your first sign-in.",
      keywords: ["Visia login", "Visia sign in"],
    },
  },
};

const sharedRobots = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    noimageindex: false,
    "max-image-preview": "large" as const,
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

type PageSEOOptions = {
  locale: Locale;
  pathname?: string;
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  noFollow?: boolean;
};

function normalizePath(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function absoluteUrl(pathname = "/"): string {
  return new URL(normalizePath(pathname), siteUrl).toString();
}

export function getLocalizedURL(locale: Locale, pathname = "/"): string {
  const normalizedPath = normalizePath(pathname);
  return absoluteUrl(
    `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`,
  );
}

export function getLanguageAlternates(pathname = "/"): Record<string, string> {
  const normalizedPath = normalizePath(pathname);

  return {
    ...Object.fromEntries(
      locales.map((locale) => [
        locale,
        getLocalizedURL(locale, normalizedPath),
      ]),
    ),
    "x-default": getLocalizedURL(defaultLocale, normalizedPath),
  };
}

function resolveImageUrl(image?: string): string {
  if (!image) {
    return absoluteUrl(defaultOgImagePath);
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return absoluteUrl(image);
}

function getLocaleMeta(locale: Locale) {
  return localeMeta[locale] ?? localeMeta[defaultLocale];
}

export function getPageSeo(locale: Locale, pathname = "/") {
  const normalizedPath = normalizePath(pathname);
  const translatedPages = pageSeo[locale] ?? pageSeo[defaultLocale];

  return translatedPages[normalizedPath] ?? translatedPages["/"];
}

export function createPageMetadata({
  locale,
  pathname = "/",
  title,
  description,
  keywords = [],
  image,
  type = "website",
  noIndex = false,
  noFollow = noIndex,
}: PageSEOOptions): Metadata {
  const meta = getLocaleMeta(locale);
  const translatedPage = getPageSeo(locale, pathname);

  const pageTitle = title ?? translatedPage.title ?? meta.title;
  const pageDescription =
    description ?? translatedPage.description ?? meta.description;

  const url = getLocalizedURL(locale, pathname);
  const imageUrl = resolveImageUrl(image);

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: [
      ...meta.keywords,
      ...(translatedPage.keywords ?? []),
      ...keywords,
    ],
    alternates: {
      canonical: url,
      languages: getLanguageAlternates(pathname),
    },
    robots:
      noIndex || noFollow
        ? {
            index: !noIndex,
            follow: !noFollow,
            googleBot: {
              index: !noIndex,
              follow: !noFollow,
              noimageindex: noIndex,
            },
          }
        : sharedRobots,
    openGraph: {
      type,
      locale: meta.ogLocale,
      alternateLocale: locales
        .filter((item) => item !== locale)
        .map((item) => getLocaleMeta(item).ogLocale),
      url,
      siteName,
      title: pageTitle,
      description: pageDescription,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${siteName} — ${pageTitle}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: siteTwitterHandle,
      title: pageTitle,
      description: pageDescription,
      images: [imageUrl],
    },
  };
}

export function createRootMetadata(locale: Locale = defaultLocale): Metadata {
  const meta = getLocaleMeta(locale);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: meta.title,
      template: meta.titleTemplate,
    },
    description: meta.description,
    applicationName: siteName,
    keywords: meta.keywords,
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    referrer: "origin-when-cross-origin",
    alternates: {
      canonical: getLocalizedURL(locale, "/"),
      languages: getLanguageAlternates("/"),
    },
    robots: sharedRobots,
    openGraph: {
      type: "website",
      locale: meta.ogLocale,
      alternateLocale: locales
        .filter((item) => item !== locale)
        .map((item) => getLocaleMeta(item).ogLocale),
      url: getLocalizedURL(locale, "/"),
      siteName,
      title: meta.title,
      description: meta.description,
      images: [
        {
          url: absoluteUrl(defaultOgImagePath),
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: siteTwitterHandle,
      title: meta.title,
      description: meta.description,
      images: [absoluteUrl(defaultOgImagePath)],
    },
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
  };
}

export function createVisiaJsonLd(locale: Locale = defaultLocale) {
  const meta = getLocaleMeta(locale);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: getLocalizedURL(locale, "/"),
        name: siteName,
        inLanguage: meta.language,
        description: meta.jsonLdDescription,
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: siteName,
        url: siteUrl,
        logo: absoluteUrl("/logos/logo.svg"),
        sameAs: [],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: siteName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: getLocalizedURL(locale, "/"),
        inLanguage: meta.language,
        description: meta.jsonLdDescription,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
        },
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
    ],
  };
}

export function createFAQJsonLd(
  locale: Locale,
  questions: Array<{
    question: string;
    answer: string;
  }>,
) {
  const meta = getLocaleMeta(locale);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: meta.language,
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export const publicSitemapPages = [
  {
    pathname: "/",
    priority: 1,
    changeFrequency: "weekly" as const,
  },
  {
    pathname: "/features",
    priority: 0.85,
    changeFrequency: "monthly" as const,
  },
  {
    pathname: "/pricing",
    priority: 0.8,
    changeFrequency: "monthly" as const,
  },
  {
    pathname: "/faq",
    priority: 0.75,
    changeFrequency: "monthly" as const,
  },
  {
    pathname: "/use-cases/creators",
    priority: 0.7,
    changeFrequency: "monthly" as const,
  },
  {
    pathname: "/use-cases/freelancers",
    priority: 0.7,
    changeFrequency: "monthly" as const,
  },
  {
    pathname: "/use-cases/businesses",
    priority: 0.7,
    changeFrequency: "monthly" as const,
  },
];
