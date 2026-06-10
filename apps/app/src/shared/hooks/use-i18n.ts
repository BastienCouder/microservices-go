import type { TOptions } from "i18next";
import { useTranslation } from "react-i18next";

import i18n, { translations } from "@/shared/i18n";
import type { TranslationKeys, TranslationNamespace } from "@/shared/i18n-messages";

type SupportedLocale = "fr" | "en";
const DEFAULT_NAMESPACE: TranslationNamespace = "shared-api";

function humanizeKey(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocale(locale: string | undefined): SupportedLocale {
  return locale?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function getNamespaceContent(
  namespace: string | undefined,
  locale: string,
): Record<string, string> | undefined {
  const normalizedNamespace = (namespace ?? DEFAULT_NAMESPACE) as TranslationNamespace;

  const normalizedLocale = normalizeLocale(locale);
  const dictionary = translations[normalizedLocale];
  if (!dictionary) return undefined;

  const scoped = dictionary[normalizedNamespace as keyof TranslationKeys];
  if (!scoped || typeof scoped !== "object" || Array.isArray(scoped)) {
    return undefined;
  }

  return scoped as Record<string, string>;
}

export function getI18nText(namespace: string | undefined, key: string, locale: string): string {
  const scoped = getNamespaceContent(namespace, locale);
  const resolvedValue = scoped?.[key];

  if (typeof resolvedValue === "string" && resolvedValue.length > 0) {
    return resolvedValue;
  }

  return humanizeKey(key);
}

export function translateI18nText(
  namespace: string | undefined,
  key: string,
  locale: string,
  options?: TOptions,
): string {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedNamespace = (namespace ?? DEFAULT_NAMESPACE) as TranslationNamespace;
  const translate = i18n.getFixedT(normalizedLocale, normalizedNamespace);

  return translate(key, {
    ...options,
    defaultValue: getI18nText(namespace, key, normalizedLocale),
  });
}

export function useI18nScope(namespace?: string): Record<string, string> {
  const { i18n: translationInstance } = useTranslation(namespace ?? DEFAULT_NAMESPACE);
  const locale = translationInstance.resolvedLanguage || translationInstance.language || i18n.language;

  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop !== "string") return "";

        return translateI18nText(namespace, prop, locale);
      },
    },
  ) as Record<string, string>;
}

export function useScopedI18n(namespace?: string): {
  locale: SupportedLocale;
  t: (key: string, options?: TOptions) => string;
} {
  const { i18n: translationInstance } = useTranslation(namespace ?? DEFAULT_NAMESPACE);
  const locale = normalizeLocale(
    translationInstance.resolvedLanguage || translationInstance.language || i18n.language,
  );

  return {
    locale,
    t: (key, options) => translateI18nText(namespace, key, locale, options),
  };
}

export function useLocale(): { locale: string } {
  const { i18n: translationInstance } = useTranslation();

  return {
    locale: normalizeLocale(
      translationInstance.resolvedLanguage || translationInstance.language || i18n.language,
    ),
  };
}
