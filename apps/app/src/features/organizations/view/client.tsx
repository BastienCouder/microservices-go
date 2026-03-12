import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { gatewayJSON } from "@/shared/api/gateway";
import type { OrganizationInvitation, OrganizationMember, Team, UserProfile } from "@/shared/models";
import { Separator } from "@/components/ui/separator";
import { OrganizationsMainPanel } from "../components/organizations-main-panel";
import { OrganizationsSidebar } from "../components/organizations-sidebar";
import type { OrganizationRole, OrganizationSummary, SimulatedPlan, OrganizationTab } from "../components/types";

type OrganizationsClientProps = {
  apiBaseURL: string;
  busy: boolean;
  routeSearch: string;
  user: UserProfile | null;
};

type MembershipSummary = {
  id?: string;
  organizationId?: string;
  role?: OrganizationRole;
};

const SELECTED_ORG_KEY = "selected-organization-id";
const SIM_PLAN_KEY_PREFIX = "simulated-billing-plan:";

function normalizeStoredPlan(rawPlan: string | null): SimulatedPlan | null {
  if (rawPlan === "starter" || rawPlan === "growth" || rawPlan === "pro" || rawPlan === "agency-enterprise") {
    return rawPlan;
  }
  if (rawPlan === "free") return "starter";
  if (rawPlan === "pro-monthly") return "growth";
  if (rawPlan === "pro-yearly") return "pro";
  return null;
}

function buildApiUrl(baseURL: string, path: string): string {
  const base = baseURL.trim();
  if (!base) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${base}${path}`;
}

function readRouteQueryParam(routeSearch: string, key: string): string {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  return params.get(key)?.trim() ?? "";
}

function readStoredOrganizationID(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SELECTED_ORG_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function storeOrganizationID(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_ORG_KEY, value);
  } catch {
    // Ignore storage errors.
  }
}

async function mutate(baseURL: string, path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(buildApiUrl(baseURL, path), {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function getIDString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  return null;
}

function normalizeRole(value: unknown): OrganizationRole | null {
  const roleValue = typeof value === "string"
    ? value
    : isRecord(value) && typeof value.value === "string"
      ? value.value
      : "";

  if (roleValue === "owner" || roleValue === "admin" || roleValue === "member") {
    return roleValue;
  }
  return null;
}

function normalizeMemberships(value: unknown): MembershipSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const props = isRecord(item.props) ? item.props : item;
      return {
        id: getIDString(props.id) ?? getIDString(item.id) ?? undefined,
        organizationId: getIDString(props.organizationId) ?? getIDString(item.organizationId) ?? undefined,
        role: normalizeRole(props.role ?? item.role) ?? undefined,
      };
    });
}

function normalizeOrganizationDetails(
  value: unknown,
  fallbackOrganizationId: string,
  fallbackRole: OrganizationRole,
): OrganizationSummary {
  const objectValue = isRecord(value) ? value : {};
  const organizationObject = isRecord(objectValue.organization) ? objectValue.organization : objectValue;
  const payload = isRecord(organizationObject.props) ? organizationObject.props : organizationObject;
  const membersValue = Array.isArray(objectValue.members)
    ? objectValue.members
    : Array.isArray(payload.members)
      ? payload.members
      : [];
  const currentUserMemberObject = isRecord(objectValue.currentUserMember)
    ? objectValue.currentUserMember
    : isRecord(payload.currentUserMember)
      ? payload.currentUserMember
      : {};
  const currentUserMember = isRecord(currentUserMemberObject.props)
    ? currentUserMemberObject.props
    : currentUserMemberObject;

  return {
    id: getString(payload.id) || fallbackOrganizationId,
    name: getString(payload.name) || "Organization",
    role: normalizeRole(currentUserMember.role) || fallbackRole,
    membersCount: membersValue.length,
  };
}

function extractCreatedId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const data = isRecord(value.data) ? value.data : value;
  const payload = isRecord(data.organization) ? data.organization : data;
  const org = isRecord(payload.props) ? payload.props : payload;
  const id = org.id;
  return typeof id === "string" && id ? id : null;
}

function generateSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPlanLabel(organizationId: string): string | null {
  if (typeof window === "undefined") return null;
  const plan = normalizeStoredPlan(window.localStorage.getItem(`${SIM_PLAN_KEY_PREFIX}${organizationId}`));
  if (!plan) return null;
  if (plan === "starter") return "Starter";
  if (plan === "growth") return "Growth";
  if (plan === "pro") return "Pro";
  return "Agency / Enterprise";
}

async function loadOrganizationsList(apiBaseURL: string, signal?: AbortSignal): Promise<OrganizationSummary[]> {
  const membershipsResponse = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.me(), {
    method: "GET",
    signal,
  });
  if (!membershipsResponse.ok) {
    if (membershipsResponse.status === 401) {
      return [];
    }
    throw new Error("Impossible de charger les organisations pour le moment.");
  }

  const memberships = normalizeMemberships(membershipsResponse.data);
  const summaries = await Promise.all(
    memberships.map(async (membership) => {
      const organizationId = membership.organizationId ?? membership.id;
      if (!organizationId) return null;

      const organizationResponse = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.get(organizationId), {
        method: "GET",
        organizationId,
        signal,
      });
      if (!organizationResponse.ok) {
        return null;
      }

      return normalizeOrganizationDetails(organizationResponse.data, organizationId, membership.role || "member");
    }),
  );

  return summaries.filter((item): item is OrganizationSummary => item !== null);
}

async function loadOrganizationResources(
  apiBaseURL: string,
  organizationId: string,
  signal?: AbortSignal,
): Promise<{
  teams: Team[];
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
}> {
  const [teamsResponse, membersResponse, invitationsResponse] = await Promise.all([
    gatewayJSON<Team[]>(apiBaseURL, `/organizations/${organizationId}/teams`, {
      method: "GET",
      organizationId,
      signal,
    }),
    gatewayJSON<OrganizationMember[]>(apiBaseURL, `/organizations/${organizationId}/members`, {
      method: "GET",
      organizationId,
      signal,
    }),
    gatewayJSON<OrganizationInvitation[]>(apiBaseURL, `/organizations/${organizationId}/invitations`, {
      method: "GET",
      organizationId,
      signal,
    }),
  ]);

  return {
    teams: teamsResponse.ok ? teamsResponse.data : [],
    members: membersResponse.ok ? membersResponse.data : [],
    invitations: invitationsResponse.ok ? invitationsResponse.data : [],
  };
}

export default function OrganizationsClient({ apiBaseURL, busy, routeSearch, user }: OrganizationsClientProps) {
  const queryClient = useQueryClient();
  const hintedOrganizationId = readRouteQueryParam(routeSearch, "org");

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>(hintedOrganizationId || readStoredOrganizationID());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftPlan, setDraftPlan] = useState<SimulatedPlan>("starter");
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);

  const [editedName, setEditedName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<OrganizationTab>("members");
  const deferredSearch = useDeferredValue(search);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
    enabled: apiBaseURL.trim() !== "" && !busy,
    queryFn: ({ signal }) => loadOrganizationsList(apiBaseURL, signal),
  });
  const organizations = organizationsQuery.data ?? [];

  const organizationResourcesQuery = useQuery({
    queryKey: appQueryKeys.organizationResources(apiBaseURL, selectedOrganizationId),
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationId !== "",
    queryFn: ({ signal }) => loadOrganizationResources(apiBaseURL, selectedOrganizationId, signal),
  });
  const teams = organizationResourcesQuery.data?.teams ?? [];
  const members = organizationResourcesQuery.data?.members ?? [];
  const invitations = organizationResourcesQuery.data?.invitations ?? [];

  const filteredOrganizations = useMemo(() => {
    if (!deferredSearch.trim()) return organizations;
    const query = deferredSearch.toLowerCase();
    return organizations.filter((organization) => organization.name.toLowerCase().includes(query));
  }, [organizations, deferredSearch]);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId) || null,
    [organizations, selectedOrganizationId],
  );

  const canManageOrganizationSettings = selectedOrganization?.role === "owner" || selectedOrganization?.role === "admin";
  const canDeleteOrganization = selectedOrganization?.role === "owner";

  useEffect(() => {
    const nextSelectedId =
      (selectedOrganizationId && organizations.some((organization) => organization.id === selectedOrganizationId)
        ? selectedOrganizationId
        : "") ||
      readRouteQueryParam(routeSearch, "org") ||
      readStoredOrganizationID() ||
      organizations[0]?.id ||
      "";

    setSelectedOrganizationId((current) => (current === nextSelectedId ? current : nextSelectedId));
    if (nextSelectedId) {
      storeOrganizationID(nextSelectedId);
    }
  }, [organizations, routeSearch, selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganizationId) {
      setEditedName("");
      setShowDeleteConfirm(false);
      setDeleteConfirmName("");
      return;
    }

    const selected = organizations.find((organization) => organization.id === selectedOrganizationId);
    setEditedName(selected?.name ?? "");
    setShowDeleteConfirm(false);
    setDeleteConfirmName("");
    storeOrganizationID(selectedOrganizationId);
  }, [organizations, selectedOrganizationId]);

  useEffect(() => {
    if (organizationsQuery.error instanceof Error) {
      setError(organizationsQuery.error.message);
      return;
    }
    setError(null);
  }, [organizationsQuery.error]);

  const teamsByID = useMemo(() => {
    const map = new Map<number, string>();
    for (const team of teams) {
      map.set(team.ID, team.Name);
    }
    return map;
  }, [teams]);

  const handleSelectOrganization = (organizationId: string) => {
    setSelectedOrganizationId(organizationId);
  };

  const handleCreateOnBilling = async () => {
    const name = draftName.trim();
    const slug = generateSlug(draftSlug.trim() || draftName.trim());
    if (!name) {
      setError("Organization name is required");
      return;
    }
    if (!slug) {
      setError("Please provide a valid slug");
      return;
    }

    setIsCreatingOrganization(true);
    setError(null);
    try {
      const response = await mutate(apiBaseURL, apiRoutes.organizations.create(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const json = await response.json();
      const createdId = extractCreatedId(json);
      if (createdId) {
        window.localStorage.setItem(SELECTED_ORG_KEY, createdId);
        window.localStorage.setItem(`${SIM_PLAN_KEY_PREFIX}${createdId}`, draftPlan);
        setSelectedOrganizationId(createdId);
      }

      setShowCreateWizard(false);
      setDraftName("");
      setDraftSlug("");
      setDraftPlan("starter");
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create organization";
      setError(message);
    } finally {
      setIsCreatingOrganization(false);
    }
  };

  const handleUpdateOrganizationName = async () => {
    if (!selectedOrganization) return;
    const nextName = editedName.trim();
    if (!nextName || nextName === selectedOrganization.name) return;

    setIsUpdatingName(true);
    setError(null);
    try {
      await mutate(apiBaseURL, apiRoutes.organizations.update(selectedOrganization.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update organization name";
      setError(message);
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization) return;
    if (deleteConfirmName.trim() !== selectedOrganization.name) {
      setError("Type the organization name to confirm deletion");
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await mutate(apiBaseURL, apiRoutes.organizations.delete(selectedOrganization.id), {
        method: "DELETE",
      });
      setShowDeleteConfirm(false);
      setDeleteConfirmName("");
      const remaining = organizations.filter((org) => org.id !== selectedOrganization.id);
      const nextSelectedId = remaining[0]?.id ?? "";
      setSelectedOrganizationId(nextSelectedId);
      if (nextSelectedId) {
        window.localStorage.setItem(SELECTED_ORG_KEY, nextSelectedId);
      } else {
        window.localStorage.removeItem(SELECTED_ORG_KEY);
      }
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete organization";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden p-2 md:p-4">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md bg-background p-3 md:p-4">
        <div className="mb-6 shrink-0">
          <h1 className="text-3xl font-semibold tracking-tight">Organizations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create organizations from billing simulation, then manage team and org settings.
          </p>
        </div>

        {error ? (
          <div className="mb-6 shrink-0 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="min-h-0 flex flex-1 flex-col gap-6 lg:flex-row">
          <OrganizationsSidebar
            search={search}
            onSearchChange={setSearch}
            showCreateWizard={showCreateWizard}
            onToggleCreateWizard={() => setShowCreateWizard((prev) => !prev)}
            draftName={draftName}
            onDraftNameChange={(value) => {
              setDraftName(value);
              setDraftSlug(generateSlug(value));
            }}
            draftSlug={draftSlug}
            onDraftSlugChange={(value) => setDraftSlug(generateSlug(value))}
            draftPlan={draftPlan}
            onDraftPlanChange={setDraftPlan}
            isCreatingOrganization={isCreatingOrganization}
            onCreate={() => void handleCreateOnBilling()}
            onCancelCreate={() => {
              setShowCreateWizard(false);
              setDraftName("");
              setDraftSlug("");
              setDraftPlan("starter");
            }}
            organizations={filteredOrganizations}
            selectedOrganizationId={selectedOrganizationId}
            onSelectOrganization={handleSelectOrganization}
            getSimulatedPlanLabel={getPlanLabel}
          />

          <Separator orientation="vertical" className="hidden lg:block" />

          <OrganizationsMainPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedOrganization={selectedOrganization}
            selectedOrganizationId={selectedOrganizationId}
            canManageOrganizationSettings={canManageOrganizationSettings}
            canDeleteOrganization={canDeleteOrganization}
            editedName={editedName}
            onEditedNameChange={setEditedName}
            isUpdatingName={isUpdatingName}
            onUpdateName={() => void handleUpdateOrganizationName()}
            showDeleteConfirm={showDeleteConfirm}
            onShowDeleteConfirm={setShowDeleteConfirm}
            deleteConfirmName={deleteConfirmName}
            onDeleteConfirmNameChange={setDeleteConfirmName}
            isDeleting={isDeleting}
            onDeleteOrganization={() => void handleDeleteOrganization()}
            onCancelDelete={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmName("");
            }}
            members={members}
            invitations={invitations}
            teamsByID={teamsByID}
            loading={
              organizationsQuery.isLoading ||
              (organizationsQuery.isFetching && !organizationsQuery.data) ||
              (selectedOrganizationId !== "" &&
                (organizationResourcesQuery.isLoading ||
                  (organizationResourcesQuery.isFetching && !organizationResourcesQuery.data)))
            }
          />
        </div>
      </div>
    </div>
  );
}
