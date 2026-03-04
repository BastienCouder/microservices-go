import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import type { SessionInfo, UserProfile } from "@/shared/models";
import { useAuthSession } from "@/features/session/hooks/use-auth-session";
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
  const apiBaseURL = useMemo(() => getAPIBaseURL(), []);

  const { busy, session, user, feedback, refresh, logout, createUserProfile } = useAuthSession(apiBaseURL);
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

  return (
    <AppLayout busy={busy} feedback={feedback} onLogout={logout} onRefresh={refresh} session={session}>
      <AppRouter
        apiBaseURL={apiBaseURL}
        onCreateProfile={createUserProfile}
        routeSearch={routeSearch}
        session={session}
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
  session: SessionInfo | null;
  user: UserProfile | null;
  onCreateProfile: (firstName: string, lastName: string) => Promise<void>;
};
