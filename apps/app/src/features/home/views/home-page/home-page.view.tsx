import { FormEvent } from "react";

export type SessionInfo = {
  identity_id: string;
  email: string;
  name: string;
};

export type UserProfile = {
  id: number;
  auth_identity_id: string;
  email: string;
  first_name: string;
  last_name: string;
};

export type HomePageViewProps = {
  apiBaseURL: string;
  webAuthURL: string;
  busy: boolean;
  result: string;
  session: SessionInfo | null;
  user: UserProfile | null;
  organizationId: string;
  firstName: string;
  lastName: string;
  teamName: string;
  permAction: string;
  permResource: string;
  onLogout: () => void;
  onRefresh: () => void;
  onChangeOrganizationId: (value: string) => void;
  onChangeFirstName: (value: string) => void;
  onChangeLastName: (value: string) => void;
  onChangeTeamName: (value: string) => void;
  onChangePermAction: (value: string) => void;
  onChangePermResource: (value: string) => void;
  onCreateUser: (event: FormEvent) => void;
  onCreateOrganization: (event: FormEvent) => void;
  onCreateTeam: (event: FormEvent) => void;
  onCheckPermission: (event: FormEvent) => void;
};

export function HomePageView({
  apiBaseURL,
  webAuthURL,
  busy,
  result,
  session,
  user,
  organizationId,
  firstName,
  lastName,
  teamName,
  permAction,
  permResource,
  onLogout,
  onRefresh,
  onChangeOrganizationId,
  onChangeFirstName,
  onChangeLastName,
  onChangeTeamName,
  onChangePermAction,
  onChangePermResource,
  onCreateUser,
  onCreateOrganization,
  onCreateTeam,
  onCheckPermission,
}: HomePageViewProps) {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>App</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>API: {apiBaseURL}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={busy} onClick={onRefresh} type="button">
            Refresh
          </button>
          <button disabled={busy} onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      <section style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Session</h2>
        {!session ? (
          <div>
            <p>Non connecté.</p>
            <a href={webAuthURL}>Se connecter (via Web)</a>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div>
              <strong>Identity:</strong> <code>{session.identity_id}</code>
            </div>
            <div>
              <strong>Email:</strong> {session.email}
            </div>
            <div>
              <strong>Name:</strong> {session.name}
            </div>
          </div>
        )}
      </section>

      {session && (
        <section style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>User Profile</h2>
          {!user ? (
            <form onSubmit={onCreateUser} style={{ display: "grid", gap: 10 }}>
              <p style={{ margin: 0, color: "#555" }}>
                Aucun profil user. Crée-le pour accéder aux endpoints protégés et au service permissions.
              </p>
              <label style={{ display: "grid", gap: 6 }}>
                Prénom
                <input disabled={busy} onChange={(e) => onChangeFirstName(e.target.value)} value={firstName} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                Nom
                <input disabled={busy} onChange={(e) => onChangeLastName(e.target.value)} value={lastName} />
              </label>
              <button disabled={busy || !firstName.trim() || !lastName.trim()} type="submit">
                Créer mon user
              </button>
            </form>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <strong>User ID:</strong> <code>{user.id}</code>
              </div>
              <div>
                <strong>Name:</strong> {user.first_name} {user.last_name}
              </div>
              <div>
                <strong>Email:</strong> {user.email}
              </div>
            </div>
          )}
        </section>
      )}

      {session && user && (
        <section style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Organization</h2>
          <form onSubmit={onCreateOrganization} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <button disabled={busy} type="submit">
              Créer une org (owner auto)
            </button>
            <label style={{ display: "grid", gap: 6 }}>
              Org ID
              <input
                disabled={busy}
                inputMode="numeric"
                onChange={(e) => onChangeOrganizationId(e.target.value)}
                placeholder="ex: 1"
                value={organizationId}
              />
            </label>
          </form>
          <p style={{ margin: "10px 0 0", color: "#555" }}>
            Les appels protégés nécessitent <code>X-Organization-ID</code>.
          </p>
        </section>
      )}

      {session && user && organizationId.trim() !== "" && (
        <section style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Permissions</h2>
          <form onSubmit={onCheckPermission} style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: 6 }}>
                Action
                <input disabled={busy} onChange={(e) => onChangePermAction(e.target.value)} value={permAction} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                Resource
                <input disabled={busy} onChange={(e) => onChangePermResource(e.target.value)} value={permResource} />
              </label>
            </div>
            <button disabled={busy || !permAction.trim() || !permResource.trim()} type="submit">
              Check (via permission-service)
            </button>
          </form>
        </section>
      )}

      {session && user && organizationId.trim() !== "" && (
        <section style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <h2 style={{ marginTop: 0 }}>Teams</h2>
          <form onSubmit={onCreateTeam} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6 }}>
              Team name
              <input disabled={busy} onChange={(e) => onChangeTeamName(e.target.value)} value={teamName} />
            </label>
            <button disabled={busy || !teamName.trim()} type="submit">
              Create team (permission enforced)
            </button>
          </form>
        </section>
      )}

      {!!result && (
        <section style={{ marginTop: 18, padding: 12, border: "1px solid #eee", borderRadius: 10, background: "#fafafa" }}>
          <strong>Result</strong>
          <pre style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{result}</pre>
        </section>
      )}
    </main>
  );
}

