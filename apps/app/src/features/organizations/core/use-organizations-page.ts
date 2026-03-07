import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { gatewayJSON } from "@/shared/api/gateway";
import type {
  AcceptInvitationResponse,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  Team,
  UserProfile,
} from "@/shared/models";
import { parsePositiveInt } from "@/shared/utils";

const LAST_ORGANIZATION_STORAGE_KEY = "app:last-org-id";

export type OrganizationsViewTab = "overview" | "teams" | "members" | "invitations" | "invitation-response";

type UseOrganizationsPageOptions = {
  apiBaseURL: string;
  user: UserProfile | null;
  routeSearch: string;
};

function readRouteQueryParam(routeSearch: string, key: string): string {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
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

export function useOrganizationsPage({ apiBaseURL, user, routeSearch }: UseOrganizationsPageOptions) {
  const initialOrgHint = readRouteQueryParam(routeSearch, "org");

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

  const [invitationTokenInput, setInvitationTokenInput] = useState(() => readRouteQueryParam(routeSearch, "invite_token"));

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [activeTab, setActiveTab] = useState<OrganizationsViewTab>("overview");

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
      const invitationsResponse = await gatewayJSON<OrganizationInvitation[]>(
        apiBaseURL,
        `/organizations/${organizationID}/invitations`,
        {
          method: "GET",
          organizationId: String(organizationID),
        },
      );
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
    const hintedOrg = parsePositiveInt(readRouteQueryParam(routeSearch, "org"));
    const hintedToken = readRouteQueryParam(routeSearch, "invite_token");

    if (hintedToken !== "") {
      setInvitationTokenInput(hintedToken);
      setActiveTab("invitation-response");
    }

    if (!hintedOrg) {
      return;
    }

    setOrganizationIDInput(String(hintedOrg));
    void loadOrganization(hintedOrg);
  }, [loadOrganization, routeSearch]);

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

      setFeedback(`Rôle "${role}" assigné.`);
      await loadOrganization(selectedOrganizationID);
    } finally {
      setBusy(false);
    }
  };

  const resetInvitationForm = useCallback(() => {
    setInviteEmail("");
    setInviteRole("member");
    setInviteMessage("");
    setInviteExpiresAt("");
    setEditingInvitationID(null);
  }, []);

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

  return {
    user,
    organizationName,
    setOrganizationName,
    organizationIDInput,
    setOrganizationIDInput,
    teamName,
    setTeamName,
    joinTeamIDInput,
    setJoinTeamIDInput,
    selfRole,
    setSelfRole,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    inviteMessage,
    setInviteMessage,
    inviteExpiresAt,
    setInviteExpiresAt,
    editingInvitationID,
    invitationTokenInput,
    setInvitationTokenInput,
    organization,
    teams,
    members,
    invitations,
    busy,
    feedback,
    activeTab,
    setActiveTab,
    selectedOrganizationID,
    teamsByID,
    loadOrganization,
    createOrganization,
    createTeam,
    joinOrganization,
    assignSelfRole,
    resetInvitationForm,
    submitInvitation,
    prepareInvitationEdit,
    deleteInvitation,
    acceptInvitation,
    refuseInvitation,
  };
}
