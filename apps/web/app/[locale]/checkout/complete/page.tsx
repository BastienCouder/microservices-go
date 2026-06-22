import { CheckoutCompleteClient } from "@/app/checkout/complete/checkout-complete-client";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";

export const dynamic = "force-dynamic";

function readRuntimeURL(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : fallback;
}

export default async function CheckoutCompletePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;
  const localePrefix = resolvedLocale === defaultLocale ? "" : `/${resolvedLocale}`;

  return (
    <CheckoutCompleteClient
      appURL={readRuntimeURL(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:30004")}
      gatewayURL={readRuntimeURL(process.env.NEXT_PUBLIC_API_GATEWAY_URL, "http://localhost:50000")}
      localePrefix={localePrefix}
    />
  );
}
