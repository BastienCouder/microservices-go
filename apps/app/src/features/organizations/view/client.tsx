import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { gatewayJSON } from "@/shared/api/gateway";
import type { OrganizationHierarchy, OrganizationInvitation, OrganizationMember, Team, UserProfile } from "@/shared/models";
import {
  buildScopedHref,
  readRouteQueryParam,
  readSelectedOrganizationID,
  storeSelectedOrganizationID,
  storeSelectedProjectID,
} from "@/shared/selection";
import { Separator } from "@/components/ui/separator";
import { countHierarchyBrands, groupProjectsByBrand, normalizeOrganizationHierarchy } from "../lib/hierarchy";
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

function extractCreatedProjectId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const data = isRecord(value.data) ? value.data : value;
  const id = data.id;
  return typeof id === "string" && id ? id : null;
}

function deriveDomainFromWebsiteURL(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const normalizedURL = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(normalizedURL).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return normalizedURL
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      ?.replace(/^www\./i, "")
      .toLowerCase() ?? "";
  }
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
  hierarchy: OrganizationHierarchy | null;
}> {
  const [teamsResponse, membersResponse, invitationsResponse, hierarchyResponse] = await Promise.all([
    gatewayJSON<Team[]>(apiBaseURL, `${apiRoutes.organizations.get(organizationId)}/teams`, {
      method: "GET",
      organizationId,
      signal,
    }),
    gatewayJSON<OrganizationMember[]>(apiBaseURL, `${apiRoutes.organizations.get(organizationId)}/members`, {
      method: "GET",
      organizationId,
      signal,
    }),
    gatewayJSON<OrganizationInvitation[]>(apiBaseURL, apiRoutes.organizations.inviteMember(organizationId), {
      method: "GET",
      organizationId,
      signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.hierarchy(organizationId), {
      method: "GET",
      organizationId,
      signal,
    }),
  ]);

  return {
    teams: teamsResponse.ok ? teamsResponse.data : [],
    members: membersResponse.ok ? membersResponse.data : [],
    invitations: invitationsResponse.ok ? invitationsResponse.data : [],
    hierarchy: hierarchyResponse.ok ? normalizeOrganizationHierarchy(hierarchyResponse.data, organizationId) : null,
  };
}

export default function OrganizationsClient({ apiBaseURL, busy, routeSearch, user }: OrganizationsClientProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hintedOrganizationId = readRouteQueryParam(routeSearch, "org");
  const shouldOpenCreateProject = readRouteQueryParam(routeSearch, "createProject") === "1";

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>(hintedOrganizationId || readSelectedOrganizationID());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showCreateProjectForm, setShowCreateProjectForm] = useState(shouldOpenCreateProject);
  const [draftProjectName, setDraftProjectName] = useState("");
  const [draftProjectWebsiteURL, setDraftProjectWebsiteURL] = useState("");
  const [draftProjectDomain, setDraftProjectDomain] = useState("");
  const [draftProjectBrandName, setDraftProjectBrandName] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const [editedName, setEditedName] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<OrganizationTab>("overview");
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
  const hierarchy = organizationResourcesQuery.data?.hierarchy ?? null;

  const filteredOrganizations = useMemo(() => {
    if (!deferredSearch.trim()) return organizations;
    const query = deferredSearch.toLowerCase();
    return organizations.filter((organization) => organization.name.toLowerCase().includes(query));
  }, [organizations, deferredSearch]);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedOrganizationId) || null,
    [organizations, selectedOrganizationId],
  );
  const brandGroups = useMemo(() => groupProjectsByBrand(hierarchy?.projects ?? []), [hierarchy?.projects]);
  const brandsCount = useMemo(() => countHierarchyBrands(hierarchy?.projects ?? []), [hierarchy?.projects]);

  const canManageOrganizationSettings = selectedOrganization?.role === "owner" || selectedOrganization?.role === "admin";
  const canDeleteOrganization = selectedOrganization?.role === "owner";

  useEffect(() => {
    const nextSelectedId =
      (selectedOrganizationId && organizations.some((organization) => organization.id === selectedOrganizationId)
        ? selectedOrganizationId
        : "") ||
      readRouteQueryParam(routeSearch, "org") ||
      readSelectedOrganizationID() ||
      organizations[0]?.id ||
      "";

    setSelectedOrganizationId((current) => (current === nextSelectedId ? current : nextSelectedId));
    if (nextSelectedId) {
      storeSelectedOrganizationID(nextSelectedId);
    }
  }, [organizations, routeSearch, selectedOrganizationId]);

  useEffect(() => {
    if (!shouldOpenCreateProject) {
      return;
    }
    setActiveTab("overview");
    setShowCreateProjectForm(true);
  }, [shouldOpenCreateProject]);

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
    storeSelectedOrganizationID(selectedOrganizationId);
  }, [organizations, selectedOrganizationId]);

  useEffect(() => {
    if (organizationsQuery.error instanceof Error) {
      setError(organizationsQuery.error.message);
      return;
    }
    if (organizationResourcesQuery.error instanceof Error) {
      setError(organizationResourcesQuery.error.message);
      return;
    }
    setError(null);
  }, [organizationResourcesQuery.error, organizationsQuery.error]);

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

  const resetCreateProjectForm = () => {
    setShowCreateProjectForm(false);
    setDraftProjectName("");
    setDraftProjectWebsiteURL("");
    setDraftProjectDomain("");
    setDraftProjectBrandName("");
  };

  const clearCreateProjectFlag = () => {
    navigate(buildScopedHref("/organizations", { org: selectedOrganizationId, createProject: null }), { replace: true });
  };

  const handleCreateProject = async () => {
    if (!selectedOrganizationId) {
      setError("Select an organization before creating a project");
      return;
    }

    const name = draftProjectName.trim();
    const websiteURL = draftProjectWebsiteURL.trim();
    const domain = draftProjectDomain.trim() || deriveDomainFromWebsiteURL(websiteURL);
    const brandName = draftProjectBrandName.trim() || name;

    if (!name) {
      setError("Project name is required");
      return;
    }
    if (!websiteURL) {
      setError("Website URL is required");
      return;
    }
    if (!domain) {
      setError("Domain is required");
      return;
    }

    setIsCreatingProject(true);
    setError(null);
    try {
      const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.create(), {
        method: "POST",
        organizationId: selectedOrganizationId,
        body: JSON.stringify({
          name,
          domain,
          websiteUrl: websiteURL,
          brandName,
        }),
      });

      if (!response.ok) {
        throw new Error(response.error || "Failed to create project");
      }

      const createdId = extractCreatedProjectId(response.data);
      if (createdId) {
        storeSelectedProjectID(createdId);
      }

      resetCreateProjectForm();
      clearCreateProjectFlag();
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizationResources(apiBaseURL, selectedOrganizationId),
      });
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrganizationId),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
    } finally {
      setIsCreatingProject(false);
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
      storeSelectedOrganizationID(nextSelectedId);
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
            Manage tenant isolation at the org level, then explore brands and projects inside each organization.
          </p>
        </div>

        {error ? (
          <div className="mb-6 shrink-0 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="min-h-0 flex flex-1 flex-col gap-6 lg:flex-row">
          <OrganizationsSidebar
            search={search}
            onSearchChange={setSearch}
            selectedOrganization={selectedOrganization}
            showCreateProjectForm={showCreateProjectForm}
            onToggleCreateProjectForm={() => {
              setShowCreateProjectForm((prev) => !prev);
              if (showCreateProjectForm) {
                clearCreateProjectFlag();
              }
            }}
            draftProjectName={draftProjectName}
            onDraftProjectNameChange={(value) => {
              setDraftProjectName(value);
              if (draftProjectBrandName.trim() === "") {
                setDraftProjectBrandName(value);
              }
            }}
            draftProjectWebsiteURL={draftProjectWebsiteURL}
            onDraftProjectWebsiteURLChange={(value) => {
              setDraftProjectWebsiteURL(value);
              if (draftProjectDomain.trim() === "") {
                setDraftProjectDomain(deriveDomainFromWebsiteURL(value));
              }
            }}
            draftProjectDomain={draftProjectDomain}
            onDraftProjectDomainChange={setDraftProjectDomain}
            draftProjectBrandName={draftProjectBrandName}
            onDraftProjectBrandNameChange={setDraftProjectBrandName}
            isCreatingProject={isCreatingProject}
            onCreateProject={() => void handleCreateProject()}
            onCancelCreateProject={() => {
              resetCreateProjectForm();
              clearCreateProjectFlag();
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
            hierarchy={hierarchy}
            brandGroups={brandGroups}
            brandsCount={brandsCount}
            onOpenCreateProject={() => {
              setShowCreateProjectForm(true);
              setActiveTab("overview");
              navigate(buildScopedHref("/organizations", { org: selectedOrganizationId, createProject: "1" }), { replace: true });
            }}
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
