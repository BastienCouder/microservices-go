import { FormEvent, useEffect, useState } from "react";

import type { SessionInfo, UserProfile } from "@/shared/models";
import { formatDateTime, splitDisplayName } from "@/shared/utils";

type ProfilePageProps = {
  session: SessionInfo;
  user: UserProfile | null;
  busy: boolean;
  onCreateProfile: (firstName: string, lastName: string) => Promise<void>;
};

export function ProfilePage({ session, user, busy, onCreateProfile }: ProfilePageProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (user) {
      return;
    }
    if (firstName.trim() !== "" || lastName.trim() !== "") {
      return;
    }
    const parts = splitDisplayName(session.name);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
  }, [firstName, lastName, session.name, user]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreateProfile(firstName.trim(), lastName.trim());
  };

  return (
    <div className="page-grid">
      <section className="card">
        <h2>Session</h2>
        <dl className="kv-list">
          <div>
            <dt>Identity ID</dt>
            <dd>
              <code>{session.identity_id}</code>
            </dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.email}</dd>
          </div>
          <div>
            <dt>Nom affiché</dt>
            <dd>{session.name || "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>Profil utilisateur</h2>
        {!user ? (
          <form className="stack" onSubmit={submit}>
            <p className="muted">Aucun profil `user-service` détecté. Crée ton profil pour accéder aux endpoints protégés.</p>
            <label className="field">
              <span>Prénom</span>
              <input
                autoComplete="given-name"
                disabled={busy}
                onChange={(event) => setFirstName(event.target.value)}
                value={firstName}
              />
            </label>
            <label className="field">
              <span>Nom</span>
              <input
                autoComplete="family-name"
                disabled={busy}
                onChange={(event) => setLastName(event.target.value)}
                value={lastName}
              />
            </label>
            <button className="button button-primary" disabled={busy || firstName.trim() === "" || lastName.trim() === ""} type="submit">
              Créer mon profil
            </button>
          </form>
        ) : (
          <dl className="kv-list">
            <div>
              <dt>User ID</dt>
              <dd>
                <code>{user.ID}</code>
              </dd>
            </div>
            <div>
              <dt>Prénom</dt>
              <dd>{user.FirstName}</dd>
            </div>
            <div>
              <dt>Nom</dt>
              <dd>{user.LastName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.Email}</dd>
            </div>
            <div>
              <dt>Banni</dt>
              <dd>{user.Banned ? "Oui" : "Non"}</dd>
            </div>
            <div>
              <dt>Créé le</dt>
              <dd>{formatDateTime(user.CreatedAt)}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}
