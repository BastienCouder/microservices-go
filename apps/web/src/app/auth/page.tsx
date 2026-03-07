import type { Metadata } from "next";
import { AuthPageClient } from "./_components/auth-page-client";

export const metadata: Metadata = {
  title: "Authentification",
  description: "Page mobile-first de connexion et inscription via Kratos",
};

type AuthRuntimeConfig = {
  gatewayURL: string;
  appURL: string;
};

function loadRuntimeConfig(): AuthRuntimeConfig {
  const gatewayURL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
  const appURL = process.env.NEXT_PUBLIC_APP_URL;
  if (!gatewayURL) {
    throw new Error("missing NEXT_PUBLIC_API_GATEWAY_URL");
  }
  if (!appURL) {
    throw new Error("missing NEXT_PUBLIC_APP_URL");
  }
  return { gatewayURL, appURL };
}

export default function AuthPage() {
  const config = loadRuntimeConfig();
  return <AuthPageClient config={config} />;
}
