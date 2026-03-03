import { useEffect, useMemo, useState } from "react";

import { OrganizationsPage } from "@/features/organizations/views/organizations-page";
import { ProfilePage } from "@/features/profile/views/profile-page";
import { useAuthSession } from "@/features/session/hooks/use-auth-session";

import "./app.css";

type AppRoute = "profile" | "organizations";

function getAPIBaseURL(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  return typeof value === "string" ? value.trim() : "";
}

function getWebAuthURL(): string {
  const value = import.meta.env.VITE_WEB_AUTH_URL;
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return "http://localhost:3000/auth";
}

function routeFromHash(routeHash: string): AppRoute {
  const normalized = routeHash.startsWith("#") ? routeHash.slice(1) : routeHash;
  const path = normalized.split("?")[0]?.replace(/\/+$/, "") ?? "";

  if (path === "/organizations") {
    return "organizations";
  }
  return "profile";
}

function useHashRoute(): { route: AppRoute; routeHash: string } {
  const [routeHash, setRouteHash] = useState(() => {
    if (typeof window === "undefined") {
      return "#/profile";
    }
    return window.location.hash || "#/profile";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.hash === "") {
      window.location.hash = "/profile";
      setRouteHash(window.location.hash || "#/profile");
    }

    const onHashChange = () => {
      setRouteHash(window.location.hash || "#/profile");
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return { route: routeFromHash(routeHash), routeHash };
}

function buildWebAuthLoginURL(webAuthURL: string, routeHash: string): string {
  if (typeof window === "undefined") {
    return webAuthURL;
  }

  const fallbackReturnURL = `${window.location.origin}${window.location.pathname}${routeHash || "#/profile"}`;

  try {
    const url = new URL(webAuthURL);
    url.searchParams.set("return_to", fallbackReturnURL);
    return url.toString();
  } catch {
    return webAuthURL;
  }
}

export default function App() {
  const { route, routeHash } = useHashRoute();
  const apiBaseURL = useMemo(() => getAPIBaseURL(), []);
  const webAuthURL = useMemo(() => getWebAuthURL(), []);
  const loginURL = useMemo(() => buildWebAuthLoginURL(webAuthURL, routeHash), [routeHash, webAuthURL]);

  const { loading, busy, session, user, feedback, refresh, logout, createUserProfile } = useAuthSession(apiBaseURL);

  if (!apiBaseURL) {
    return (
      <main className="app-root">
        <section className="card">
          <h1>Configuration manquante</h1>
          <p>
            La variable <code>VITE_API_BASE_URL</code> est requise pour appeler l'API Gateway.
          </p>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="app-root">
        <section className="card">
          <h1>Chargement</h1>
          <p>Vérification de la session en cours...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app-root">
        <section className="card">
          <h1>Connexion requise</h1>
          <p>Tu dois être connecté pour accéder à l'application.</p>
          <div className="actions-row">
            <a className="button button-primary" href={loginURL}>
              Se connecter
            </a>
            <button className="button" disabled={busy} onClick={() => void refresh()} type="button">
              Recharger
            </button>
          </div>
          {feedback !== "" && <p className="muted">{feedback}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-root">
      <header className="topbar card">
        <div>
          <h1>AI Reco Monitor</h1>
          <p className="muted">Connecté en tant que {session.email}</p>
        </div>

        <nav className="nav-links" aria-label="Navigation">
          <a className={route === "profile" ? "is-active" : ""} href="#/profile">
            Profile
          </a>
          <a className={route === "organizations" ? "is-active" : ""} href="#/organizations">
            Organisations
          </a>
        </nav>

        <div className="actions-row">
          <button className="button" disabled={busy} onClick={() => void refresh()} type="button">
            Refresh
          </button>
          <button className="button" disabled={busy} onClick={() => void logout()} type="button">
            Logout
          </button>
        </div>
      </header>

      {route === "profile" && <ProfilePage busy={busy} onCreateProfile={createUserProfile} session={session} user={user} />}
      {route === "organizations" && <OrganizationsPage apiBaseURL={apiBaseURL} routeHash={routeHash} user={user} />}

      {feedback !== "" && (
        <section className="card muted-panel">
          <h3>Info</h3>
          <pre>{feedback}</pre>
        </section>
      )}
    </main>
  );
}
