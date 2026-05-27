import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { appQueryKeys } from "@/lib/query-keys";
import type { UserProfile } from "@/shared/models";
import { findBySlugOrId } from "@/shared/public-slugs";
import {
  buildScopedHref,
  readOrganizationIdFromSearch,
  readRouteQueryParam,
  readSelectedOrganizationID,
  storeSelectedOrganizationID,
} from "@/shared/selection";
import {
  canManageOrganizationPages,
  DEFAULT_ORGANIZATION_VIEW_TAB,
  EMPTY_INVITATION_DRAFT,
  EMPTY_ORGANIZATIONS,
  EMPTY_RESOURCES,
  isOrganizationViewTabAvailable,
} from "../shared/constants";
import {
  loadOrganizationResources,
  loadOrganizationSummaries,
} from "../shared/organization-page-api";
import {
  buildCreateProjectOnboardingHref,
  prepareCreateProjectOnboardingContext,
} from "../shared/organization-page-links";
import { useOrganizationMutations } from "./use-organization-mutations";
import type {
  InvitationDraft,
  OrganizationAPIKey,
  OrganizationResources,
  OrganizationSummary,
  ProjectSettingsInput,
  ProjectMemberDraft,
  ViewTab,
} from "../shared/types";

type UseOrganizationsPageViewModelInput = {
  apiBaseURL: string;
  busy: boolean;
  routeSearch: string;
  user: UserProfile | null;
};

export type OrganizationsPageViewModel = {
  activeTab: ViewTab;
  activeError: string | null;
  notice: string | null;
  isInitialLoading: boolean;
  selectedOrganization: OrganizationSummary | null;
  resources: OrganizationResources;
  currentUserId: string;
  currentUserEmail: string;
  projectSearch: string;
  projectMemberDrafts: Record<string, ProjectMemberDraft>;
  invitationDraft: InvitationDraft;
  createProjectOnboardingHref: string;
  onStartCreateProjectOnboarding: () => void;
  canManageProjects: boolean;
  canDeleteProjects: boolean;
  deletingProjectId: string;
  projectSettingsBusy: boolean;
  projectMemberBusy: boolean;
  removeProjectMemberBusy: boolean;
  memberActionBusy: boolean;
  createInvitationBusy: boolean;
  revokeInvitationBusy: boolean;
  updateOrganizationBusy: boolean;
  deleteOrganizationBusy: boolean;
  createAPIKeyBusy: boolean;
  revokeAPIKeyBusy: boolean;
  createdAPIKey: OrganizationAPIKey | null;
  setActiveTab: (value: ViewTab) => void;
  setProjectSearch: (value: string) => void;
  setInvitationDraft: (draft: InvitationDraft) => void;
  onMemberDraftChange: (projectId: string, draft: ProjectMemberDraft) => void;
  onUpdateProjectSettings: (projectId: string, input: ProjectSettingsInput) => void;
  onDeleteProject: (projectId: string) => void;
  onAssignProjectMember: (projectId: string) => void;
  onRemoveProjectMember: (projectId: string, userId: string) => void;
  onUpdateMemberProjects: (userId: string, projectIds: string[]) => void;
  onUpdateRoles: (userId: string, roles: string[]) => void;
  onRemoveMember: (userId: string) => void;
  onCreateInvitation: () => void;
  onRevokeInvitation: (invitationId: string) => void;
  onUpdateOrganizationName: (name: string) => void;
  onDeleteOrganization: () => void;
  onCreateAPIKey: (name: string) => void;
  onRevokeAPIKey: (keyId: string) => void;
  onClearCreatedAPIKey: () => void;
  onRefetchOrganizations: () => void;
};

function findPreferredOrganizationId(
  organizations: OrganizationSummary[],
  routeSearch: string,
  currentId: string,
): string {
  const availableIds = new Set(organizations.map((organization) => organization.id));
  const routeOrganization =
    findBySlugOrId(organizations, readOrganizationIdFromSearch(routeSearch))?.id ?? "";
  const candidates = [
    routeOrganization,
    currentId,
    readSelectedOrganizationID(),
    organizations[0]?.id ?? "",
  ];
  return candidates.find((candidate) => candidate && availableIds.has(candidate)) ?? "";
}

function normalizeViewTab(value: string): ViewTab {
  if (
    value === "projects" ||
    value === "members" ||
    value === "invitations" ||
    value === "settings" ||
    value === "apiKeys"
  ) {
    return value;
  }
  return DEFAULT_ORGANIZATION_VIEW_TAB;
}

export function useOrganizationsPageViewModel({
  apiBaseURL,
  busy,
  routeSearch,
  user,
}: UseOrganizationsPageViewModelInput): OrganizationsPageViewModel {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ViewTab>(DEFAULT_ORGANIZATION_VIEW_TAB);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(readSelectedOrganizationID);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectMemberDrafts, setProjectMemberDrafts] = useState<Record<string, ProjectMemberDraft>>({});
  const [invitationDraft, setInvitationDraft] = useState<InvitationDraft>(EMPTY_INVITATION_DRAFT);
  const [createdAPIKey, setCreatedAPIKey] = useState<OrganizationAPIKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const currentRouteHref = `${location.pathname}${location.search}`;
  const navigateIfChanged = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (href === currentRouteHref) return;
      navigate(href, options);
    },
    [currentRouteHref, navigate],
  );

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
    enabled: apiBaseURL.trim() !== "" && !busy,
    queryFn: ({ signal }) => loadOrganizationSummaries(apiBaseURL, signal),
  });
  const organizations = organizationsQuery.data ?? EMPTY_ORGANIZATIONS;
  const routeOrganizationToken = readOrganizationIdFromSearch(routeSearch);
  const routeSection = normalizeViewTab(readRouteQueryParam(routeSearch, "section"));
  const selectedOrganizationFromList = organizations.find(
    (organization) => organization.id === selectedOrganizationId,
  );
  const selectedOrganizationRole = selectedOrganizationFromList?.role ?? "member";
  const canManageOrganizationFromSummary = canManageOrganizationPages([selectedOrganizationRole]);

  useEffect(() => {
    setActiveTab(routeSection);
  }, [routeSection]);

  useEffect(() => {
    if (organizations.length === 0) return;
    const nextId = findPreferredOrganizationId(organizations, routeSearch, selectedOrganizationId);
    if (nextId && nextId !== selectedOrganizationId) {
      setSelectedOrganizationId(nextId);
      storeSelectedOrganizationID(nextId);
      const organization = organizations.find((item) => item.id === nextId);
      navigateIfChanged(
        buildScopedHref(`/organizations${routeSearch}`, { org: organization?.slug }),
        { replace: true },
      );
    }
  }, [navigateIfChanged, organizations, routeSearch, selectedOrganizationId]);

  const resourcesQuery = useQuery({
    queryKey: [
      ...appQueryKeys.organizationResources(apiBaseURL, selectedOrganizationId),
      canManageOrganizationFromSummary ? "manager" : "member",
    ] as const,
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationId !== "",
    queryFn: ({ signal }) =>
      loadOrganizationResources(apiBaseURL, selectedOrganizationId, {
        canManageOrganization: canManageOrganizationFromSummary,
        currentUserEmail: user?.Email ?? "",
        currentUserId: user ? String(user.ID) : "",
        organizationRole: selectedOrganizationRole,
        signal,
      }),
  });
  const resources = resourcesQuery.data ?? EMPTY_RESOURCES;
  const selectedOrganization =
    selectedOrganizationFromList ??
    resources.organization;
  const currentUserId = user ? String(user.ID) : "";
  const currentUserRoles = useMemo(
    () => resources.members.find((member) => member.userId === currentUserId)?.roles ?? [],
    [currentUserId, resources.members],
  );
  const effectiveCurrentUserRoles = useMemo(
    () => (currentUserRoles.length > 0 ? currentUserRoles : [selectedOrganizationRole]),
    [currentUserRoles, selectedOrganizationRole],
  );
  const canManageProjects = canManageOrganizationPages(effectiveCurrentUserRoles);
  const canDeleteProjects = effectiveCurrentUserRoles.some((role) =>
    ["owner", "admin"].includes(role),
  );
  const effectiveActiveTab = isOrganizationViewTabAvailable(activeTab, effectiveCurrentUserRoles)
    ? activeTab
    : DEFAULT_ORGANIZATION_VIEW_TAB;

  useEffect(() => {
    if (isOrganizationViewTabAvailable(routeSection, effectiveCurrentUserRoles)) return;
    if (!selectedOrganization) return;
    navigateIfChanged(
      buildScopedHref(`/organizations${routeSearch}`, {
        org: selectedOrganization.slug,
        section: null,
      }),
      { replace: true },
    );
  }, [effectiveCurrentUserRoles, navigateIfChanged, routeSearch, routeSection, selectedOrganization]);

  useEffect(() => {
    if (!selectedOrganization) return;
    if (routeOrganizationToken === selectedOrganization.slug) return;
    navigateIfChanged(
      buildScopedHref(`/organizations${routeSearch}`, { org: selectedOrganization.slug }),
      { replace: true },
    );
  }, [navigateIfChanged, routeOrganizationToken, routeSearch, selectedOrganization]);

  const activeError =
    localError ??
    (organizationsQuery.error instanceof Error ? organizationsQuery.error.message : null) ??
    (resourcesQuery.error instanceof Error ? resourcesQuery.error.message : null);

  const invalidateOrganizationData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizationResources(apiBaseURL, selectedOrganizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizationHierarchy(apiBaseURL, selectedOrganizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
      }),
    ]);
  };

  const mutations = useOrganizationMutations({
    apiBaseURL,
    selectedOrganizationId,
    currentUserId,
    currentUserRoles,
    resources,
    projectMemberDrafts,
    invitationDraft,
    setProjectMemberDrafts,
    setInvitationDraft,
    setCreatedAPIKey,
    setNotice,
    setLocalError,
    invalidateOrganizationData,
    onDeleteOrganizationSuccess: () => {
      storeSelectedOrganizationID("");
      setSelectedOrganizationId("");
      setActiveTab(DEFAULT_ORGANIZATION_VIEW_TAB);
      navigateIfChanged(
        buildScopedHref(`/organizations${routeSearch}`, {
          org: null,
          section: null,
        }),
        { replace: true },
      );
    },
  });

  return {
    activeTab: effectiveActiveTab,
    activeError,
    notice,
    isInitialLoading:
      organizationsQuery.isLoading ||
      (selectedOrganizationId !== "" && resourcesQuery.isLoading && !resourcesQuery.data),
    selectedOrganization,
    resources,
    currentUserId,
    currentUserEmail: user?.Email ?? "",
    projectSearch,
    projectMemberDrafts,
    invitationDraft,
    createProjectOnboardingHref: buildCreateProjectOnboardingHref(),
    onStartCreateProjectOnboarding: () =>
      prepareCreateProjectOnboardingContext(selectedOrganizationId),
    canManageProjects,
    canDeleteProjects,
    deletingProjectId: mutations.deleteProjectMutation.isPending
      ? mutations.deleteProjectMutation.variables ?? ""
      : "",
    projectSettingsBusy: mutations.updateProjectSettingsMutation.isPending,
    projectMemberBusy: mutations.assignProjectMemberMutation.isPending,
    removeProjectMemberBusy: mutations.removeProjectMemberMutation.isPending,
    memberActionBusy:
      mutations.updateMemberProjectsMutation.isPending ||
      mutations.updateMemberRolesMutation.isPending ||
      mutations.removeMemberMutation.isPending,
    createInvitationBusy: mutations.createInvitationMutation.isPending,
    revokeInvitationBusy: mutations.revokeInvitationMutation.isPending,
    updateOrganizationBusy: mutations.updateOrganizationNameMutation.isPending,
    deleteOrganizationBusy: mutations.deleteOrganizationMutation.isPending,
    createAPIKeyBusy: mutations.createAPIKeyMutation.isPending,
    revokeAPIKeyBusy: mutations.revokeAPIKeyMutation.isPending,
    createdAPIKey,
    setActiveTab: (value) => {
      setActiveTab(value);
      navigateIfChanged(
        buildScopedHref(`/organizations${routeSearch}`, {
          org: selectedOrganization?.slug,
          section: value === DEFAULT_ORGANIZATION_VIEW_TAB ? null : value,
        }),
      );
    },
    setProjectSearch,
    setInvitationDraft,
    onMemberDraftChange: (projectId, draft) =>
      setProjectMemberDrafts((current) => ({ ...current, [projectId]: draft })),
    onUpdateProjectSettings: (projectId, input) =>
      mutations.updateProjectSettingsMutation.mutate({ projectId, input }),
    onDeleteProject: (projectId) => mutations.deleteProjectMutation.mutate(projectId),
    onAssignProjectMember: (projectId) => mutations.assignProjectMemberMutation.mutate(projectId),
    onRemoveProjectMember: (projectId, userId) =>
      mutations.removeProjectMemberMutation.mutate({ projectId, userId }),
    onUpdateMemberProjects: (userId, projectIds) =>
      mutations.updateMemberProjectsMutation.mutate({ userId, projectIds }),
    onUpdateRoles: (userId, roles) => mutations.updateMemberRolesMutation.mutate({ userId, roles }),
    onRemoveMember: (userId) => mutations.removeMemberMutation.mutate(userId),
    onCreateInvitation: () => mutations.createInvitationMutation.mutate(),
    onRevokeInvitation: (invitationId) => mutations.revokeInvitationMutation.mutate(invitationId),
    onUpdateOrganizationName: (name) => mutations.updateOrganizationNameMutation.mutate(name),
    onDeleteOrganization: () => mutations.deleteOrganizationMutation.mutate(),
    onCreateAPIKey: (name) => mutations.createAPIKeyMutation.mutate(name),
    onRevokeAPIKey: (keyId) => mutations.revokeAPIKeyMutation.mutate(keyId),
    onClearCreatedAPIKey: () => setCreatedAPIKey(null),
    onRefetchOrganizations: () => void organizationsQuery.refetch(),
  };
}
