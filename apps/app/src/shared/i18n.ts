import i18next, { type InitOptions } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend, { type HttpBackendOptions } from "i18next-http-backend";

import { isProduction } from "@/lib/utils";
import { enMessages, frMessages, translationNamespaces, type TranslationKeys } from "@/shared/i18n-messages";

const defaultNamespace = "shared-api";

export const translations: Record<string, TranslationKeys> = {
  en: enMessages,
  fr: frMessages,
};

const config: InitOptions<HttpBackendOptions> = {
  supportedLngs: ["en", "fr"],
  ns: translationNamespaces,
  defaultNS: defaultNamespace,
  fallbackLng: "en",
  debug: !isProduction,
  interpolation: {
    escapeValue: false,
  },
  resources: translations,
  backend: {
    loadPath: "/locales/{{lng}}/{{ns}}.json",
  },
};

void i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(Backend)
  .init(config);

export default i18next;
