import type { UserProfile } from "@/shared/models";
import { formatDateTime } from "@/shared/utils";

type ProfilePageProps = {
  user: UserProfile | null;
};

export function ProfilePage({ user }: ProfilePageProps) {
  return (
    <div className="page-grid">
      <section className="card">
        <h2>Profil utilisateur</h2>
        {!user ? (
          <p className="muted">Aucune donnée utilisateur disponible.</p>
        ) : (
          <dl className="kv-list">
            <div>
              <dt>User ID</dt>
              <dd>
                <code>{user.ID}</code>
              </dd>
            </div>
            <div>
              <dt>Identity ID</dt>
              <dd>
                <code>{user.AuthIdentityID}</code>
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
