import type { Metadata } from "next";
import { AuthPageClient } from "@/app/[locale]/_components/auth-page-client";
import { Navigation } from "@/app/[locale]/_components/navigation";
import { defaultLocale, isLocale, type Locale } from "@/src/i18n/config";
import { createPageMetadata } from "@/src/site/seo";

type AuthRuntimeConfig = {
  gatewayURL: string;
  appURL: string;
};

function readRuntimeURL(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : fallback;
}

function loadRuntimeConfig(): AuthRuntimeConfig {
  return {
    gatewayURL: readRuntimeURL(process.env.NEXT_PUBLIC_API_GATEWAY_URL, "http://localhost:50000"),
    appURL: readRuntimeURL(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:30004"),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale: Locale = isLocale(locale) ? locale : defaultLocale;

  return createPageMetadata({
    locale: resolvedLocale,
    pathname: "/login",
    noIndex: true,
    noFollow: true,
  });
}

export default function LoginPage() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <header className="h-20 w-full shrink-0">
        <Navigation />
      </header>

      <section className="h-[calc(100vh-5rem)] w-full overflow-hidden">
        <AuthPageClient config={loadRuntimeConfig()} mode="login" />
      </section>
    </main>
  );
}
