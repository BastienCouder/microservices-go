import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import type { UserProfile } from "@/shared/models";
import { useAuthSession } from "@/features/session/hooks/use-auth-session";
import { redirectToWebAuth } from "@/shared/auth/web-auth";
import { shouldRedirectUnauthenticated } from "./auth-guard";
import { AppLayout } from "./layout";
import { AppRouter } from "./router";

import "./global.css";

function getAPIBaseURL(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  return typeof value === "string" ? value.trim() : "";
}

export default function App() {
  const location = useLocation();
  const routeSearch = location.search;
  const isOnboardingRoute = location.pathname === "/onboarding" || location.pathname.startsWith("/onboarding/");
  const apiBaseURL = useMemo(() => getAPIBaseURL(), []);

  const { busy, user, feedback, refresh, logout } = useAuthSession(apiBaseURL);
  const mustRedirectToAuth = shouldRedirectUnauthenticated({ apiBaseURL, busy, user });

  useEffect(() => {
    if (!mustRedirectToAuth) {
      return;
    }
    redirectToWebAuth(window.location.href);
  }, [mustRedirectToAuth]);

  if (!apiBaseURL) {
    return (
      <main className="app-root">
        <section className="card">
          <h1>Configuration manquante</h1>
          <p>
            La variable <code>VITE_API_BASE_URL</code> est requise pour appeler l&apos;API Gateway.
          </p>
        </section>
      </main>
    );
  }

  if (mustRedirectToAuth) {
    return null;
  }

  if (isOnboardingRoute) {
    return (
      <AppRouter
        apiBaseURL={apiBaseURL}
        routeSearch={routeSearch}
        user={user}
        busy={busy}
      />
    );
  }

  return (
    <AppLayout apiBaseURL={apiBaseURL} busy={busy} feedback={feedback} onLogout={logout} onRefresh={refresh}>
      <AppRouter
        apiBaseURL={apiBaseURL}
        routeSearch={routeSearch}
        user={user}
        busy={busy}
      />
    </AppLayout>
  );
}

export type AppRouterProps = {
  apiBaseURL: string;
  busy: boolean;
  routeSearch: string;
  user: UserProfile | null;
};
