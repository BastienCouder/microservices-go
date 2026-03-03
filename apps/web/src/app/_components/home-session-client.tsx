"use client";

import { useEffect, useMemo, useState } from "react";

type SessionInfo =
  | {
      identity_id: string;
      email: string;
      name: string;
    }
  | null;

type UserProfile =
  | {
      id: number;
      email: string;
      first_name: string;
      last_name: string;
    }
  | null;

type HomeSessionClientProps = {
  gatewayURL: string;
  appURL: string;
};

async function parseJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return (await response.json()) as unknown;
}

export function HomeSessionClient({ gatewayURL, appURL }: HomeSessionClientProps) {
  const baseURL = useMemo(() => gatewayURL.replace(/\/$/, ""), [gatewayURL]);
  const [busy, setBusy] = useState(true);
  const [session, setSession] = useState<SessionInfo>(null);
  const [user, setUser] = useState<UserProfile>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;

    async function load() {
      setBusy(true);
      setError("");
      try {
        const meRes = await fetch(`${baseURL}/auth/me`, { credentials: "include" });
        if (!meRes.ok) {
          if (!canceled) setSession(null);
          return;
        }
        const mePayload = (await parseJSON(meRes)) as SessionInfo;
        if (!canceled) setSession(mePayload);

        const userRes = await fetch(`${baseURL}/users/me`, { credentials: "include" });
        if (!userRes.ok) {
          if (!canceled) setUser(null);
          return;
        }
        const userPayload = (await parseJSON(userRes)) as UserProfile;
        if (!canceled) setUser(userPayload);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : "unexpected error");
      } finally {
        if (!canceled) setBusy(false);
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, [baseURL]);

  return (
    <section style={{ marginTop: 16, padding: 14, border: "1px solid #c5cada", borderRadius: 14, background: "#eef1f8" }}>
      <h2 style={{ margin: "0 0 8px" }}>Accès</h2>
      {busy ? (
        <p>Chargement…</p>
      ) : error ? (
        <p>Erreur: {error}</p>
      ) : !session ? (
        <p>
          Non connecté. <a href="/auth">Se connecter</a>
        </p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          <div>
            Connecté: <strong>{session.email}</strong>
          </div>
          <div>
            Profil user:{" "}
            {user ? (
              <strong>
                #{user.id} ({user.first_name} {user.last_name})
              </strong>
            ) : (
              <span>absent (crée-le depuis l’App)</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={appURL}>Ouvrir l’application (App)</a>
            <a href="/auth">Gérer la session</a>
          </div>
        </div>
      )}
    </section>
  );
}
