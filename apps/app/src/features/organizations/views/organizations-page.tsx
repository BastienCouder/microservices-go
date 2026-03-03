import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { gatewayJSON } from "@/shared/api/gateway";
import type {
  AcceptInvitationResponse,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  Team,
  UserProfile,
} from "@/shared/models";
import { formatDateTime, parsePositiveInt } from "@/shared/utils";

const LAST_ORGANIZATION_STORAGE_KEY = "app:last-org-id";

type OrganizationsPageProps = {
  apiBaseURL: string;
  user: UserProfile | null;
  routeHash: string;
};

function readRouteQueryParam(routeHash: string, key: string): string {
  const normalized = routeHash.startsWith("#") ? routeHash.slice(1) : routeHash;
  const queryIndex = normalized.indexOf("?");
  if (queryIndex < 0) {
    return "";
  }
  const params = new URLSearchParams(normalized.slice(queryIndex + 1));
  return params.get(key)?.trim() ?? "";
}

function readStoredOrganizationID(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return window.localStorage.getItem(LAST_ORGANIZATION_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function storeOrganizationID(value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LAST_ORGANIZATION_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors to keep UX functional in private mode.
  }
}

function toRFC3339(localDateTime: string): string {
  const trimmed = localDateTime.trim();
  if (trimmed === "") {
    return "";
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function toDateTimeLocal(raw: string | null | undefined): string {
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}

export function OrganizationsPage({ apiBaseURL, user, routeHash }: OrganizationsPageProps) {
  const initialOrgHint = readRouteQueryParam(routeHash, "org");

  const [organizationName, setOrganizationName] = useState("Acme");
  const [organizationIDInput, setOrganizationIDInput] = useState(() => initialOrgHint || readStoredOrganizationID());
  const [teamName, setTeamName] = useState("Platform");
  const [joinTeamIDInput, setJoinTeamIDInput] = useState("");
  const [selfRole, setSelfRole] = useState("member");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [editingInvitationID, setEditingInvitationID] = useState<number | null>(null);

  const [invitationTokenInput, setInvitationTokenInput] = useState(() => readRouteQueryParam(routeHash, "invite_token"));

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);

  const selectedOrganizationID = parsePositiveInt(organizationIDInput);

  const teamsByID = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of teams) {
      map.set(team.ID, team.Name);
    }
    return map;
  }, [teams]);

  const refreshInvitations = useCallback(
    async (organizationID: number) => {
      const invitationsResponse = await gatewayJSON<OrganizationInvitation[]>(apiBaseURL, `/organizations/${organizationID}/invitations`, {
        method: "GET",
        organizationId: String(organizationID),
      });
      if (!invitationsResponse.ok) {
        return {
          ok: false,
          reason: `invitations: ${invitationsResponse.status} ${invitationsResponse.error}`,
        };
      }

      setInvitations(invitationsResponse.data);
      return { ok: true, reason: "" };
    },
    [apiBaseURL],
  );

  const loadOrganization = useCallback(
    async (forcedOrganizationID?: number) => {
      const organizationID = forcedOrganizationID ?? selectedOrganizationID;
      if (!organizationID) {
        setFeedback("Renseigne un Organization ID valide.");
        return;
      }
      if (!user) {
        setFeedback("Tu dois créer un profil utilisateur avant d'accéder aux données organisation.");
        return;
      }

      setBusy(true);
      setFeedback("");
      try {
        const organizationHeader = String(organizationID);
        const [organizationResponse, teamsResponse, membersResponse, invitationOutcome] = await Promise.all([
          gatewayJSON<Organization>(apiBaseURL, `/organizations/${organizationID}`, {
            method: "GET",
            organizationId: organizationHeader,
          }),
          gatewayJSON<Team[]>(apiBaseURL, `/organizations/${organizationID}/teams`, {
            method: "GET",
            organizationId: organizationHeader,
          }),
          gatewayJSON<OrganizationMember[]>(apiBaseURL, `/organizations/${organizationID}/members`, {
            method: "GET",
            organizationId: organizationHeader,
          }),
          refreshInvitations(organizationID),
        ]);

        if (!organizationResponse.ok) {
          setFeedback(`organization: ${organizationResponse.status} ${organizationResponse.error}`);
          return;
        }
        if (!teamsResponse.ok) {
          setFeedback(`teams: ${teamsResponse.status} ${teamsResponse.error}`);
          return;
        }
        if (!membersResponse.ok) {
          setFeedback(`members: ${membersResponse.status} ${membersResponse.error}`);
          return;
        }

        setOrganization(organizationResponse.data);
        setTeams(teamsResponse.data);
        setMembers(membersResponse.data);
        storeOrganizationID(organizationHeader);

        if (!invitationOutcome.ok) {
          setFeedback(`Organisation chargée, mais ${invitationOutcome.reason}`);
          return;
        }

        setFeedback(`Organisation #${organizationID} chargée.`);
      } finally {
        setBusy(false);
      }
    },
    [apiBaseURL, refreshInvitations, selectedOrganizationID, user],
  );

  useEffect(() => {
    if (bootstrapped) {
      return;
    }
    setBootstrapped(true);
    if (selectedOrganizationID) {
      void loadOrganization(selectedOrganizationID);
    }
  }, [bootstrapped, loadOrganization, selectedOrganizationID]);

  useEffect(() => {
    const hintedOrg = parsePositiveInt(readRouteQueryParam(routeHash, "org"));
    const hintedToken = readRouteQueryParam(routeHash, "invite_token");

    if (hintedToken !== "") {
      setInvitationTokenInput(hintedToken);
    }

    if (!hintedOrg) {
      return;
    }

    setOrganizationIDInput(String(hintedOrg));
    void loadOrganization(hintedOrg);
  }, [loadOrganization, routeHash]);

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setFeedback("Tu dois créer un profil utilisateur avant de créer une organisation.");
      return;
    }

    const trimmedName = organizationName.trim();
    if (trimmedName === "") {
      setFeedback("Le nom de l'organisation est obligatoire.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const response = await gatewayJSON<Organization>(apiBaseURL, "/organizations", {
        method: "POST",
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) {
        setFeedback(`create organization: ${response.status} ${response.error}`);
        return;
      }

      const createdID = response.data.ID;
      setOrganizationIDInput(String(createdID));
      setFeedback(`Organisation créée (#${createdID}).`);
      await loadOrganization(createdID);
    } finally {
      setBusy(false);
    }
  };

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrganizationID) {
      setFeedback("Renseigne un Organization ID avant de créer une équipe.");
      return;
    }

    const trimmedName = teamName.trim();
    if (trimmedName === "") {
      setFeedback("Le nom de l'équipe est obligatoire.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const response = await gatewayJSON<Team>(apiBaseURL, `/organizations/${selectedOrganizationID}/teams`, {
        method: "POST",
        organizationId: String(selectedOrganizationID),
        body: JSON.stringify({ name: trimmedName }),
      });
      if (!response.ok) {
        setFeedback(`create team: ${response.status} ${response.error}`);
        return;
      }

      setFeedback(`Équipe créée (${response.data.Name}).`);
      await loadOrganization(selectedOrganizationID);
    } finally {
      setBusy(false);
    }
  };

  const joinOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setFeedback("Tu dois créer un profil utilisateur avant de rejoindre une organisation.");
      return;
    }
    if (!selectedOrganizationID) {
      setFeedback("Renseigne un Organization ID valide.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const joinTeamID = parsePositiveInt(joinTeamIDInput) ?? 0;
      const response = await gatewayJSON<OrganizationMember>(apiBaseURL, `/organizations/${selectedOrganizationID}/members`, {
        method: "POST",
        organizationId: String(selectedOrganizationID),
        body: JSON.stringify({
          user_id: user.ID,
          team_id: joinTeamID,
        }),
      });
      if (!response.ok) {
        setFeedback(`add member: ${response.status} ${response.error}`);
        return;
      }

      setFeedback("Membre ajouté à l'organisation.");
      await loadOrganization(selectedOrganizationID);
    } finally {
      setBusy(false);
    }
  };

  const assignSelfRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setFeedback("Tu dois créer un profil utilisateur avant d'assigner un rôle.");
      return;
    }
    if (!selectedOrganizationID) {
      setFeedback("Renseigne un Organization ID valide.");
      return;
    }

    const role = selfRole.trim();
    if (role === "") {
      setFeedback("Le rôle est obligatoire.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const response = await gatewayJSON<OrganizationMember>(
        apiBaseURL,
        `/organizations/${selectedOrganizationID}/members/${user.ID}/roles`,
        {
          method: "POST",
          organizationId: String(selectedOrganizationID),
          body: JSON.stringify({ role }),
        },
      );
      if (!response.ok) {
        setFeedback(`assign role: ${response.status} ${response.error}`);
        return;
      }

      setFeedback(`Rôle \"${role}\" assigné.`);
      await loadOrganization(selectedOrganizationID);
    } finally {
      setBusy(false);
    }
  };

  const resetInvitationForm = () => {
    setInviteEmail("");
    setInviteRole("member");
    setInviteMessage("");
    setInviteExpiresAt("");
    setEditingInvitationID(null);
  };

  const submitInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrganizationID) {
      setFeedback("Renseigne un Organization ID avant de gérer les invitations.");
      return;
    }

    const recipient = inviteEmail.trim();
    if (recipient === "") {
      setFeedback("L'email du destinataire est obligatoire.");
      return;
    }

    const role = inviteRole.trim() || "member";
    const payload = {
      email: recipient,
      role,
      message: inviteMessage.trim(),
      expires_at: toRFC3339(inviteExpiresAt),
    };

    setBusy(true);
    setFeedback("");
    try {
      if (editingInvitationID === null) {
        const response = await gatewayJSON<OrganizationInvitation>(apiBaseURL, `/organizations/${selectedOrganizationID}/invitations`, {
          method: "POST",
          organizationId: String(selectedOrganizationID),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          setFeedback(`create invitation: ${response.status} ${response.error}`);
          return;
        }
        setFeedback(`Invitation créée (token: ${response.data.Token}).`);
      } else {
        const response = await gatewayJSON<OrganizationInvitation>(
          apiBaseURL,
          `/organizations/${selectedOrganizationID}/invitations/${editingInvitationID}`,
          {
            method: "PUT",
            organizationId: String(selectedOrganizationID),
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          setFeedback(`update invitation: ${response.status} ${response.error}`);
          return;
        }
        setFeedback("Invitation mise à jour.");
      }

      resetInvitationForm();
      await loadOrganization(selectedOrganizationID);
    } finally {
      setBusy(false);
    }
  };

  const prepareInvitationEdit = (invitation: OrganizationInvitation) => {
    setEditingInvitationID(invitation.ID);
    setInviteEmail(invitation.Email);
    setInviteRole(invitation.Role);
    setInviteMessage(invitation.Message ?? "");
    setInviteExpiresAt(toDateTimeLocal(invitation.ExpiresAt));
  };

  const deleteInvitation = async (invitationID: number) => {
    if (!selectedOrganizationID) {
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const response = await gatewayJSON<unknown>(
        apiBaseURL,
        `/organizations/${selectedOrganizationID}/invitations/${invitationID}`,
        {
          method: "DELETE",
          organizationId: String(selectedOrganizationID),
        },
      );
      if (!response.ok) {
        setFeedback(`delete invitation: ${response.status} ${response.error}`);
        return;
      }

      if (editingInvitationID === invitationID) {
        resetInvitationForm();
      }
      setFeedback("Invitation révoquée.");
      await loadOrganization(selectedOrganizationID);
    } finally {
      setBusy(false);
    }
  };

  const acceptInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = invitationTokenInput.trim();
    if (token === "") {
      setFeedback("Renseigne un token d'invitation pour accepter.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const response = await gatewayJSON<AcceptInvitationResponse>(apiBaseURL, `/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
      if (!response.ok) {
        setFeedback(`accept invitation: ${response.status} ${response.error}`);
        return;
      }

      const acceptedOrgID = response.data.invitation.OrganizationID;
      setOrganizationIDInput(String(acceptedOrgID));
      setFeedback(`Invitation acceptée. Organisation active: #${acceptedOrgID}.`);
      await loadOrganization(acceptedOrgID);
    } finally {
      setBusy(false);
    }
  };

  const refuseInvitation = async () => {
    const token = invitationTokenInput.trim();
    if (token === "") {
      setFeedback("Renseigne un token d'invitation pour refuser.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const response = await gatewayJSON<OrganizationInvitation>(apiBaseURL, `/invitations/${encodeURIComponent(token)}/refuse`, {
        method: "POST",
      });
      if (!response.ok) {
        setFeedback(`refuse invitation: ${response.status} ${response.error}`);
        return;
      }

      setFeedback("Invitation refusée.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="card">
        <h2>Contexte organisation</h2>
        <p className="muted">
          Toutes les routes protégées passent par <code>X-Organization-ID</code>. Sélectionne l'organisation active pour gérer équipes,
          membres et invitations.
        </p>

        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void loadOrganization();
          }}
        >
          <label className="field inline-field">
            <span>Organization ID</span>
            <input
              disabled={busy}
              inputMode="numeric"
              onChange={(event) => setOrganizationIDInput(event.target.value)}
              placeholder="ex: 1"
              value={organizationIDInput}
            />
          </label>
          <button className="button" disabled={busy || !user || !selectedOrganizationID} type="submit">
            Charger
          </button>
        </form>

        <form className="inline-form" onSubmit={createOrganization}>
          <label className="field inline-field">
            <span>Nom de l'organisation</span>
            <input disabled={busy} onChange={(event) => setOrganizationName(event.target.value)} value={organizationName} />
          </label>
          <button className="button button-primary" disabled={busy || !user || organizationName.trim() === ""} type="submit">
            Créer l'organisation
          </button>
        </form>
      </section>

      {!user && (
        <section className="card warning">
          <h2>Profil requis</h2>
          <p>Crée d'abord ton profil utilisateur dans la page Profile pour accéder à la gestion organisation.</p>
        </section>
      )}

      {organization && (
        <section className="card">
          <h2>Détails organisation</h2>
          <dl className="kv-list">
            <div>
              <dt>ID</dt>
              <dd>
                <code>{organization.ID}</code>
              </dd>
            </div>
            <div>
              <dt>Nom</dt>
              <dd>{organization.Name}</dd>
            </div>
            <div>
              <dt>Owner User ID</dt>
              <dd>{organization.OwnerIdentityID}</dd>
            </div>
            <div>
              <dt>Créée le</dt>
              <dd>{formatDateTime(organization.CreatedAt)}</dd>
            </div>
          </dl>
        </section>
      )}

      {selectedOrganizationID && user && (
        <section className="card">
          <h2>Équipes</h2>
          <form className="inline-form" onSubmit={createTeam}>
            <label className="field inline-field">
              <span>Nom équipe</span>
              <input disabled={busy} onChange={(event) => setTeamName(event.target.value)} value={teamName} />
            </label>
            <button className="button" disabled={busy || teamName.trim() === ""} type="submit">
              Créer une équipe
            </button>
          </form>

          {teams.length === 0 ? (
            <p className="muted">Aucune équipe dans cette organisation.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Créée le</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.ID}>
                    <td>{team.ID}</td>
                    <td>{team.Name}</td>
                    <td>{formatDateTime(team.CreatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {selectedOrganizationID && user && (
        <section className="card">
          <h2>Membres et rôles</h2>

          <form className="inline-form" onSubmit={joinOrganization}>
            <label className="field inline-field">
              <span>Team ID (optionnel)</span>
              <input
                disabled={busy}
                inputMode="numeric"
                onChange={(event) => setJoinTeamIDInput(event.target.value)}
                placeholder="0 ou vide"
                value={joinTeamIDInput}
              />
            </label>
            <button className="button" disabled={busy} type="submit">
              Me joindre à l'organisation
            </button>
          </form>

          <form className="inline-form" onSubmit={assignSelfRole}>
            <label className="field inline-field">
              <span>Mon rôle</span>
              <input disabled={busy} onChange={(event) => setSelfRole(event.target.value)} value={selfRole} />
            </label>
            <button className="button" disabled={busy || selfRole.trim() === ""} type="submit">
              Assigner mon rôle
            </button>
          </form>

          {members.length === 0 ? (
            <p className="muted">Aucun membre pour le moment.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Team</th>
                  <th>Rôles</th>
                  <th>Ajouté le</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={`${member.OrganizationID}-${member.UserID}`}>
                    <td>{member.UserID}</td>
                    <td>{member.TeamID > 0 ? teamsByID.get(member.TeamID) ?? `#${member.TeamID}` : "-"}</td>
                    <td>{member.Roles.join(", ")}</td>
                    <td>{formatDateTime(member.AddedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {selectedOrganizationID && user && (
        <section className="card">
          <h2>Invitations</h2>

          <form className="stack" onSubmit={submitInvitation}>
            <label className="field">
              <span>Email destinataire</span>
              <input
                autoComplete="email"
                disabled={busy}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="invite@acme.io"
                value={inviteEmail}
              />
            </label>
            <label className="field">
              <span>Rôle proposé</span>
              <input disabled={busy} onChange={(event) => setInviteRole(event.target.value)} value={inviteRole} />
            </label>
            <label className="field">
              <span>Expire le (optionnel)</span>
              <input disabled={busy} onChange={(event) => setInviteExpiresAt(event.target.value)} type="datetime-local" value={inviteExpiresAt} />
            </label>
            <label className="field">
              <span>Message</span>
              <textarea
                disabled={busy}
                onChange={(event) => setInviteMessage(event.target.value)}
                placeholder="Contexte de l'invitation"
                rows={3}
                value={inviteMessage}
              />
            </label>
            <div className="actions-row">
              <button className="button button-primary" disabled={busy || inviteEmail.trim() === ""} type="submit">
                {editingInvitationID === null ? "Créer l'invitation" : "Mettre à jour l'invitation"}
              </button>
              {editingInvitationID !== null && (
                <button className="button" disabled={busy} onClick={resetInvitationForm} type="button">
                  Annuler l'édition
                </button>
              )}
            </div>
          </form>

          {invitations.length === 0 ? (
            <p className="muted">Aucune invitation dans cette organisation.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Status</th>
                  <th>Token</th>
                  <th>Créée le</th>
                  <th>Expire le</th>
                  <th>Répondue le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.ID}>
                    <td>{invitation.Email}</td>
                    <td>{invitation.Role}</td>
                    <td>{invitation.Status}</td>
                    <td>
                      <code>{invitation.Token}</code>
                    </td>
                    <td>{formatDateTime(invitation.CreatedAt)}</td>
                    <td>{formatDateTime(invitation.ExpiresAt)}</td>
                    <td>{formatDateTime(invitation.RespondedAt)}</td>
                    <td>
                      <div className="actions-row">
                        <button className="button button-small" disabled={busy} onClick={() => prepareInvitationEdit(invitation)} type="button">
                          Éditer
                        </button>
                        <button className="button button-small" disabled={busy} onClick={() => void deleteInvitation(invitation.ID)} type="button">
                          Révoquer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {user && (
        <section className="card">
          <h2>Répondre à une invitation</h2>
          <p className="muted">Colle un token d'invitation pour l'accepter ou la refuser avec ton compte connecté.</p>
          <form className="stack" onSubmit={acceptInvitation}>
            <label className="field">
              <span>Token invitation</span>
              <input
                disabled={busy}
                onChange={(event) => setInvitationTokenInput(event.target.value)}
                placeholder="token invitation"
                value={invitationTokenInput}
              />
            </label>
            <div className="actions-row">
              <button className="button button-primary" disabled={busy || invitationTokenInput.trim() === ""} type="submit">
                Accepter
              </button>
              <button className="button" disabled={busy || invitationTokenInput.trim() === ""} onClick={() => void refuseInvitation()} type="button">
                Refuser
              </button>
            </div>
          </form>
        </section>
      )}

      {feedback !== "" && (
        <section className="card muted-panel">
          <h3>Résultat</h3>
          <pre>{feedback}</pre>
        </section>
      )}
    </div>
  );
}
