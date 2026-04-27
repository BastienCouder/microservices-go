import { useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import type { UserProfile } from "@/shared/models";
import { useAuthSession } from "@/features/session/hooks/use-auth-session";
import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { redirectToWebAuth } from "@/shared/auth/web-auth";
import {
  shouldRedirectToOnboarding,
  shouldRedirectUnauthenticated,
} from "./auth-guard";
import { AppLayout } from "./layout";
import { AppRouter } from "./router";

import "./global.css";

function getAPIBaseURL(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  return typeof value === "string" ? value.trim() : "";
}

function unwrapData(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "success" in value &&
    (value as { success?: unknown }).success === true &&
    "data" in value
  ) {
    return (value as { data: unknown }).data;
  }
  return value;
}

async function loadProjectCount(
  apiBaseURL: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.list(), {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const payload = unwrapData(response.data);
  return Array.isArray(payload) ? payload.length : 0;
}

export default function App() {
  const location = useLocation();
  const routeSearch = location.search;
  const isOnboardingRoute = location.pathname === "/onboarding" || location.pathname.startsWith("/onboarding/");
  const apiBaseURL = useMemo(() => getAPIBaseURL(), []);

  const { busy, user, feedback, refresh, logout } = useAuthSession(apiBaseURL);
  const shouldCheckProjectGuard =
    apiBaseURL.trim() !== "" && !busy && user !== null && !isOnboardingRoute;
  const mustRedirectToAuth = shouldRedirectUnauthenticated({ apiBaseURL, busy, user });
  const projectGuardQuery = useQuery({
    queryKey: ["route-project-guard", apiBaseURL, user?.ID ?? null],
    enabled: shouldCheckProjectGuard,
    queryFn: ({ signal }) => loadProjectCount(apiBaseURL, signal),
  });
  const mustRedirectToOnboarding = shouldRedirectToOnboarding({
    apiBaseURL,
    busy,
    user,
    isOnboardingRoute,
    projectCount:
      projectGuardQuery.isLoading || projectGuardQuery.isFetching
        ? null
        : projectGuardQuery.data ?? null,
  });

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

  if (shouldCheckProjectGuard && (projectGuardQuery.isLoading || projectGuardQuery.isFetching)) {
    return null;
  }

  if (mustRedirectToOnboarding) {
    return <Navigate replace to="/onboarding" />;
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
