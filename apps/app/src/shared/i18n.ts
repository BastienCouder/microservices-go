import i18next, { type InitOptions } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend, { type HttpBackendOptions } from "i18next-http-backend";

import en from "@/public/locales/en/translations.json";
import fr from "@/public/locales/fr/translations.json";
import { isProduction } from "@/lib/utils";

export type TranslationKeys = typeof en;

export const translations: Record<string, { translations: TranslationKeys }> = {
  en: {
    translations: en,
  },
  fr: {
    translations: fr,
  },
};

const config: InitOptions<HttpBackendOptions> = {
  supportedLngs: ["en", "fr"],
  ns: ["translations"],
  defaultNS: "translations",
  fallbackLng: "en",
  debug: !isProduction,
  interpolation: {
    escapeValue: false,
  },
  resources: translations,
  backend: {
    loadPath: "/locales/{{lng}}/translations.json",
  },
};

void i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(Backend)
  .init(config);

export default i18next;
