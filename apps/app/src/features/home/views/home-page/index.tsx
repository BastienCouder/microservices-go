import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { gatewayJSON } from "@/shared/api/gateway";

import { HomePageView, type UserProfile } from "./home-page.view";

function getAPIBaseURL(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  return typeof value === "string" ? value : "";
}

function getWebAuthURL(): string {
  const value = (import.meta.env as unknown as { VITE_WEB_AUTH_URL?: string }).VITE_WEB_AUTH_URL;
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return "http://localhost:30000/auth";
}

function safeJSONStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function HomePageContainer() {
  const apiBaseURL = useMemo(() => getAPIBaseURL(), []);
  const webAuthURL = useMemo(() => getWebAuthURL(), []);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const [user, setUser] = useState<UserProfile | null>(null);

  const [organizationId, setOrganizationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [teamName, setTeamName] = useState("Platform");
  const [permAction, setPermAction] = useState("create");
  const [permResource, setPermResource] = useState("teams");

  const refresh = useCallback(async () => {
    if (!apiBaseURL) return;

    setBusy(true);
    setResult("");
    try {
      const userMe = await gatewayJSON<UserProfile>(apiBaseURL, "/users/me", { method: "GET" });
      if (!userMe.ok) {
        setUser(null);
        setOrganizationId("");
        if (userMe.status === 401 || userMe.status === 404) {
          setResult("");
          return;
        }
        setResult(`users/me: ${userMe.status} ${userMe.error}`);
        return;
      }

      setUser(userMe.data);
      setFirstName(userMe.data.first_name);
      setLastName(userMe.data.last_name);
    } finally {
      setBusy(false);
    }
  }, [apiBaseURL]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (!apiBaseURL) return;
    setBusy(true);
    setResult("");
    try {
      const res = await gatewayJSON<unknown>(apiBaseURL, "/auth/logout", { method: "POST" });
      setResult(res.ok ? "logout ok" : `logout: ${res.status} ${res.error}`);
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [apiBaseURL, refresh]);

  const createUser = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!apiBaseURL) return;

      setBusy(true);
      setResult("");
      try {
        setResult("Le profil utilisateur est auto-provisionné par auth-service.");
      } finally {
        setBusy(false);
        void refresh();
      }
    },
    [apiBaseURL, refresh],
  );

  const createOrganization = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!apiBaseURL) return;

      setBusy(true);
      setResult("");
      try {
        const res = await gatewayJSON<{ id: number }>(apiBaseURL, "/organizations", {
          method: "POST",
          body: JSON.stringify({ name: "Acme" }),
        });
        if (!res.ok) {
          setResult(`organizations: ${res.status} ${res.error}\n${safeJSONStringify(res)}`);
          return;
        }
        setOrganizationId(String(res.data.id));
        setResult(`organization created: ${res.data.id}`);
      } finally {
        setBusy(false);
      }
    },
    [apiBaseURL],
  );

  const createTeam = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!apiBaseURL) return;
      const orgID = organizationId.trim();
      if (!orgID) return;

      setBusy(true);
      setResult("");
      try {
        const res = await gatewayJSON<unknown>(apiBaseURL, `/organizations/${orgID}/teams`, {
          method: "POST",
          organizationId: orgID,
          body: JSON.stringify({ name: teamName }),
        });
        setResult(res.ok ? `team created\n${safeJSONStringify(res.data)}` : `teams: ${res.status} ${res.error}`);
      } finally {
        setBusy(false);
      }
    },
    [apiBaseURL, organizationId, teamName],
  );

  const checkPermission = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!apiBaseURL) return;
      const orgID = organizationId.trim();
      if (!orgID) return;

      setBusy(true);
      setResult("");
      try {
        const res = await gatewayJSON<{ allowed: boolean; reason: string }>(apiBaseURL, "/permissions/check", {
          method: "POST",
          organizationId: orgID,
          body: JSON.stringify({
            organization_id: Number(orgID),
            action: permAction,
            resource: permResource,
          }),
        });
        setResult(res.ok ? safeJSONStringify(res.data) : `permissions/check: ${res.status} ${res.error}\n${safeJSONStringify(res)}`);
      } finally {
        setBusy(false);
      }
    },
    [apiBaseURL, organizationId, permAction, permResource],
  );

  if (!apiBaseURL) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>App</h1>
        <p>
          Missing <code>VITE_API_BASE_URL</code>
        </p>
      </main>
    );
  }

  return (
    <HomePageView
      apiBaseURL={apiBaseURL}
      webAuthURL={webAuthURL}
      busy={busy}
      result={result}
      user={user}
      organizationId={organizationId}
      firstName={firstName}
      lastName={lastName}
      teamName={teamName}
      permAction={permAction}
      permResource={permResource}
      onLogout={logout}
      onRefresh={() => void refresh()}
      onChangeOrganizationId={setOrganizationId}
      onChangeFirstName={setFirstName}
      onChangeLastName={setLastName}
      onChangeTeamName={setTeamName}
      onChangePermAction={setPermAction}
      onChangePermResource={setPermResource}
      onCreateUser={createUser}
      onCreateOrganization={createOrganization}
      onCreateTeam={createTeam}
      onCheckPermission={checkPermission}
    />
  );
}
