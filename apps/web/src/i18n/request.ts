import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./config";
import { getLocaleMessages } from "./messages";

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale;
  const locale = typeof requestedLocale === "string" && isLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return {
    locale,
    messages: getLocaleMessages(locale),
  };
});
