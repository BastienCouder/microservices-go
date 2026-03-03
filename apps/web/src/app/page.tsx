import Link from "next/link";

import { HomeSessionClient } from "./_components/home-session-client";

type HomeRuntimeConfig = {
  gatewayURL: string;
  appURL: string;
};

function loadRuntimeConfig(): HomeRuntimeConfig {
  const gatewayURL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;
  if (!gatewayURL) {
    throw new Error("missing NEXT_PUBLIC_API_GATEWAY_URL");
  }
  return {
    gatewayURL,
    appURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:19020",
  };
}

export default function Home() {
  const config = loadRuntimeConfig();
  return (
    <main className="page">
      <h1>Web App initialisee</h1>
      <p>Application frontend Next.js.</p>
      <p>
        <Link href="/auth">Ouvrir la page de test auth</Link>
      </p>
      <HomeSessionClient appURL={config.appURL} gatewayURL={config.gatewayURL} />
    </main>
  );
}
