import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./config";
import { getLocaleMessages } from "./messages";

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (!locale || !isLocale(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: getLocaleMessages(locale),
  };
});
