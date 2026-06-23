import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { appQueryKeys } from "@/lib/query-keys";
import { invalidateOrganizationScope } from "@/shared/api/query-refresh";
import type { UserProfile } from "@/shared/models";
import { findBySlugIdOrPublicId } from "@/shared/public-slugs";
import {
  buildScopedHref,
  clearSelectedProjectContext,
  readOrganizationIdFromSearch,
  readRouteQueryParam,
  SELECTED_CONTEXT_CHANGE_EVENT,
  readSelectedOrganizationID,
  storeSelectedOrganizationContext,
  storeSelectedOrganizationID,
} from "@/shared/selection";
import { useLocale } from "@/shared/hooks/use-i18n";
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
  apiBaseURL: string;
  routeSearch: string;
  activeTab: ViewTab;
  activeError: string | null;
  actionError: string | null;
  notice: string | null;
  isInitialLoading: boolean;
  organizations: OrganizationSummary[];
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
  resendInvitationBusy: boolean;
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
  onResendInvitation: (invitationId: string) => void;
  onRevokeInvitation: (invitationId: string) => void;
  onUpdateOrganizationName: (name: string) => void;
  onDeleteOrganization: () => void;
  onCreateAPIKey: (name: string) => void;
  onRevokeAPIKey: (keyId: string) => void;
  onClearCreatedAPIKey: () => void;
  onSelectOrganization: (organizationId: string) => void;
  onRefetchOrganizations: () => void;
};

function findPreferredOrganizationId(
  organizations: OrganizationSummary[],
  routeSearch: string,
  currentId: string,
): string {
  const availableIds = new Set(organizations.map((organization) => organization.id));
  const routeOrganization =
    findBySlugIdOrPublicId(organizations, readOrganizationIdFromSearch(routeSearch))?.id ?? "";
  const currentOrganization =
    findBySlugIdOrPublicId(organizations, currentId)?.id ?? "";
  const storedOrganization =
    findBySlugIdOrPublicId(organizations, readSelectedOrganizationID())?.id ?? "";
  const candidates = [
    routeOrganization,
    currentOrganization,
    storedOrganization,
    organizations[0]?.id ?? "",
  ];
  return candidates.find((candidate) => candidate && availableIds.has(candidate)) ?? "";
}

function normalizeViewTab(value: string): ViewTab {
  if (
    value === "projects" ||
    value === "members" ||
    value === "invitations" ||
    value === "billing" ||
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
  const { locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ViewTab>(DEFAULT_ORGANIZATION_VIEW_TAB);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(readSelectedOrganizationID);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectMemberDrafts, setProjectMemberDrafts] = useState<Record<string, ProjectMemberDraft>>({});
  const [invitationDraft, setInvitationDraft] = useState<InvitationDraft>({
    ...EMPTY_INVITATION_DRAFT,
    locale: locale === "en" ? "en" : "fr",
  });
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
  const selectedOrganizationRef =
    selectedOrganizationFromList?.publicId || selectedOrganizationId;
  const selectedOrganizationRole = selectedOrganizationFromList?.role ?? "viewer";
  const canManageOrganizationFromSummary = canManageOrganizationPages([selectedOrganizationRole]);

  useEffect(() => {
    setActiveTab(routeSection);
  }, [routeSection]);

  useEffect(() => {
    const syncSelectedOrganization = () => {
      setSelectedOrganizationId(readSelectedOrganizationID());
    };

    window.addEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncSelectedOrganization);
    window.addEventListener("storage", syncSelectedOrganization);
    syncSelectedOrganization();

    return () => {
      window.removeEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncSelectedOrganization);
      window.removeEventListener("storage", syncSelectedOrganization);
    };
  }, []);

  useEffect(() => {
    if (organizations.length === 0) return;
    const nextId = findPreferredOrganizationId(organizations, routeSearch, selectedOrganizationId);
    if (nextId && nextId !== selectedOrganizationId) {
      setSelectedOrganizationId(nextId);
      const nextOrganization = organizations.find((organization) => organization.id === nextId);
      if (nextOrganization) {
        storeSelectedOrganizationContext({
          organizationId: nextOrganization.id,
          publicId: nextOrganization.publicId,
        });
      } else {
        storeSelectedOrganizationID(nextId);
      }
      navigateIfChanged(
        buildScopedHref(`/organizations${routeSearch}`, { org: null }),
        { replace: true },
      );
    }
  }, [navigateIfChanged, organizations, routeSearch, selectedOrganizationId]);

  const resourcesQuery = useQuery({
    queryKey: [
      ...appQueryKeys.organizationResources(apiBaseURL, selectedOrganizationRef),
      canManageOrganizationFromSummary ? "manager" : "member",
    ] as const,
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationRef !== "",
    queryFn: ({ signal }) =>
      loadOrganizationResources(apiBaseURL, selectedOrganizationRef, {
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
  const canDeleteProjects = effectiveCurrentUserRoles.some((role) => role === "editor");
  const shouldDeferTabPermissionResolution =
    resourcesQuery.isLoading || (resourcesQuery.isFetching && !resourcesQuery.data);
  const effectiveActiveTab =
    shouldDeferTabPermissionResolution ||
    isOrganizationViewTabAvailable(activeTab, effectiveCurrentUserRoles)
    ? activeTab
    : DEFAULT_ORGANIZATION_VIEW_TAB;

  useEffect(() => {
    if (shouldDeferTabPermissionResolution) return;
    if (isOrganizationViewTabAvailable(routeSection, effectiveCurrentUserRoles)) return;
    if (!selectedOrganization) return;
    navigateIfChanged(
      buildScopedHref(`/organizations${routeSearch}`, {
        org: null,
        section: null,
      }),
      { replace: true },
    );
  }, [
    effectiveCurrentUserRoles,
    navigateIfChanged,
    routeSearch,
    routeSection,
    selectedOrganization,
    shouldDeferTabPermissionResolution,
  ]);

  useEffect(() => {
    if (!selectedOrganization) return;
    if (!routeOrganizationToken) return;
    navigateIfChanged(
      buildScopedHref(`/organizations${routeSearch}`, { org: null }),
      { replace: true },
    );
  }, [navigateIfChanged, routeOrganizationToken, routeSearch, selectedOrganization]);

  const activeError =
    localError ??
    (organizationsQuery.error instanceof Error ? organizationsQuery.error.message : null) ??
    (resourcesQuery.error instanceof Error ? resourcesQuery.error.message : null);

  const invalidateOrganizationData = async () => {
    await invalidateOrganizationScope(
      queryClient,
      apiBaseURL,
      selectedOrganizationRef,
    );
  };

  const mutations = useOrganizationMutations({
    apiBaseURL,
    selectedOrganizationId: selectedOrganizationRef,
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
    apiBaseURL,
    routeSearch,
    activeTab: effectiveActiveTab,
    activeError,
    actionError: localError,
    notice,
    isInitialLoading:
      organizationsQuery.isLoading ||
      (selectedOrganizationId !== "" && resourcesQuery.isLoading && !resourcesQuery.data),
    organizations,
    selectedOrganization,
    resources,
    currentUserId,
    currentUserEmail: user?.Email ?? "",
    projectSearch,
    projectMemberDrafts,
    invitationDraft,
    createProjectOnboardingHref: buildCreateProjectOnboardingHref(),
    onStartCreateProjectOnboarding: () =>
      prepareCreateProjectOnboardingContext(selectedOrganizationRef),
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
    resendInvitationBusy: mutations.resendInvitationMutation.isPending,
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
          org: null,
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
    onResendInvitation: (invitationId) => mutations.resendInvitationMutation.mutate(invitationId),
    onRevokeInvitation: (invitationId) => mutations.revokeInvitationMutation.mutate(invitationId),
    onUpdateOrganizationName: (name) => mutations.updateOrganizationNameMutation.mutate(name),
    onDeleteOrganization: () => mutations.deleteOrganizationMutation.mutate(),
    onCreateAPIKey: (name) => mutations.createAPIKeyMutation.mutate(name),
    onRevokeAPIKey: (keyId) => mutations.revokeAPIKeyMutation.mutate(keyId),
    onClearCreatedAPIKey: () => setCreatedAPIKey(null),
    onSelectOrganization: (organizationId) => {
      const nextOrganizationId = organizationId.trim();
      if (!nextOrganizationId || nextOrganizationId === selectedOrganizationId) return;

      setSelectedOrganizationId(nextOrganizationId);
      const nextOrganization = organizations.find(
        (organization) => organization.id === nextOrganizationId,
      );
      if (nextOrganization) {
        storeSelectedOrganizationContext({
          organizationId: nextOrganization.id,
          publicId: nextOrganization.publicId,
        });
      } else {
        storeSelectedOrganizationID(nextOrganizationId);
      }
      clearSelectedProjectContext();
      navigateIfChanged(
        buildScopedHref(`/organizations${routeSearch}`, {
          org: null,
          project: null,
          projectId: null,
          project_id: null,
          section: activeTab === DEFAULT_ORGANIZATION_VIEW_TAB ? null : activeTab,
        }),
      );
    },
    onRefetchOrganizations: () => void organizationsQuery.refetch(),
  };
}
