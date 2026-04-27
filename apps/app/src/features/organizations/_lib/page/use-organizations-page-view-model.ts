import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { appQueryKeys } from "@/lib/query-keys";
import type { UserProfile } from "@/shared/models";
import { findBySlugOrId } from "@/shared/public-slugs";
import {
  buildScopedHref,
  readOrganizationIdFromSearch,
  readSelectedOrganizationID,
  storeSelectedOrganizationID,
} from "@/shared/selection";
import { EMPTY_INVITATION_DRAFT, EMPTY_ORGANIZATIONS, EMPTY_RESOURCES } from "../shared/constants";
import {
  loadOrganizationResources,
  loadOrganizationSummaries,
} from "../shared/organization-page-api";
import { buildCreateProjectOnboardingHref } from "../shared/organization-page-links";
import { useOrganizationMutations } from "./use-organization-mutations";
import type {
  InvitationDraft,
  OrganizationResources,
  OrganizationSummary,
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
  projectMemberBusy: boolean;
  removeProjectMemberBusy: boolean;
  memberActionBusy: boolean;
  createInvitationBusy: boolean;
  revokeInvitationBusy: boolean;
  setActiveTab: (value: ViewTab) => void;
  setProjectSearch: (value: string) => void;
  setInvitationDraft: (draft: InvitationDraft) => void;
  onMemberDraftChange: (projectId: string, draft: ProjectMemberDraft) => void;
  onAssignProjectMember: (projectId: string) => void;
  onRemoveProjectMember: (projectId: string, userId: string) => void;
  onUpdateMemberProjects: (userId: string, projectIds: string[]) => void;
  onUpdateRoles: (userId: string, roles: string[]) => void;
  onRemoveMember: (userId: string) => void;
  onSetMemberBanned: (userId: string, banned: boolean) => void;
  onCreateInvitation: () => void;
  onRevokeInvitation: (invitationId: string) => void;
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

export function useOrganizationsPageViewModel({
  apiBaseURL,
  busy,
  routeSearch,
  user,
}: UseOrganizationsPageViewModelInput): OrganizationsPageViewModel {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ViewTab>("projects");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(readSelectedOrganizationID);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectMemberDrafts, setProjectMemberDrafts] = useState<Record<string, ProjectMemberDraft>>({});
  const [invitationDraft, setInvitationDraft] = useState<InvitationDraft>(EMPTY_INVITATION_DRAFT);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
    enabled: apiBaseURL.trim() !== "" && !busy,
    queryFn: ({ signal }) => loadOrganizationSummaries(apiBaseURL, signal),
  });
  const organizations = organizationsQuery.data ?? EMPTY_ORGANIZATIONS;
  const routeOrganizationToken = readOrganizationIdFromSearch(routeSearch);

  useEffect(() => {
    if (organizations.length === 0) return;
    const nextId = findPreferredOrganizationId(organizations, routeSearch, selectedOrganizationId);
    if (nextId && nextId !== selectedOrganizationId) {
      setSelectedOrganizationId(nextId);
      storeSelectedOrganizationID(nextId);
      const organization = organizations.find((item) => item.id === nextId);
      navigate(buildScopedHref("/organizations", { org: organization?.slug }), { replace: true });
    }
  }, [navigate, organizations, routeSearch, selectedOrganizationId]);

  const resourcesQuery = useQuery({
    queryKey: appQueryKeys.organizationResources(apiBaseURL, selectedOrganizationId),
    enabled: apiBaseURL.trim() !== "" && selectedOrganizationId !== "",
    queryFn: ({ signal }) => loadOrganizationResources(apiBaseURL, selectedOrganizationId, signal),
  });
  const resources = resourcesQuery.data ?? EMPTY_RESOURCES;
  const selectedOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) ??
    resources.organization;
  const currentUserId = user ? String(user.ID) : "";
  const currentUserRoles = useMemo(
    () => resources.members.find((member) => member.userId === currentUserId)?.roles ?? [],
    [currentUserId, resources.members],
  );
  useEffect(() => {
    if (!selectedOrganizationId) return;
    console.info("[organizations] client resources", {
      selectedOrganizationId,
      currentUserId,
      currentUserRoles,
      projects: resources.projects.map((project) => ({
        id: project.id,
        name: project.name,
        organizationId: project.organizationId,
      })),
      members: resources.members.map((member) => ({ userId: member.userId, roles: member.roles })),
      projectMembers: resources.projectMembers.map((projectMember) => ({
        projectId: projectMember.projectId,
        userId: projectMember.userId,
        role: projectMember.role,
      })),
    });
  }, [currentUserId, currentUserRoles, resources, selectedOrganizationId]);

  useEffect(() => {
    if (!selectedOrganization) return;
    if (routeOrganizationToken === selectedOrganization.slug) return;
    navigate(buildScopedHref("/organizations", { org: selectedOrganization.slug }), { replace: true });
  }, [navigate, routeOrganizationToken, selectedOrganization]);

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
    setNotice,
    setLocalError,
    invalidateOrganizationData,
  });

  return {
    activeTab,
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
    createProjectOnboardingHref: buildCreateProjectOnboardingHref(selectedOrganizationId),
    projectMemberBusy: mutations.assignProjectMemberMutation.isPending,
    removeProjectMemberBusy: mutations.removeProjectMemberMutation.isPending,
    memberActionBusy:
      mutations.updateMemberProjectsMutation.isPending ||
      mutations.updateMemberRolesMutation.isPending ||
      mutations.removeMemberMutation.isPending ||
      mutations.setMemberBannedMutation.isPending,
    createInvitationBusy: mutations.createInvitationMutation.isPending,
    revokeInvitationBusy: mutations.revokeInvitationMutation.isPending,
    setActiveTab,
    setProjectSearch,
    setInvitationDraft,
    onMemberDraftChange: (projectId, draft) =>
      setProjectMemberDrafts((current) => ({ ...current, [projectId]: draft })),
    onAssignProjectMember: (projectId) => mutations.assignProjectMemberMutation.mutate(projectId),
    onRemoveProjectMember: (projectId, userId) =>
      mutations.removeProjectMemberMutation.mutate({ projectId, userId }),
    onUpdateMemberProjects: (userId, projectIds) =>
      mutations.updateMemberProjectsMutation.mutate({ userId, projectIds }),
    onUpdateRoles: (userId, roles) => mutations.updateMemberRolesMutation.mutate({ userId, roles }),
    onRemoveMember: (userId) => mutations.removeMemberMutation.mutate(userId),
    onSetMemberBanned: (userId, banned) => mutations.setMemberBannedMutation.mutate({ userId, banned }),
    onCreateInvitation: () => mutations.createInvitationMutation.mutate(),
    onRevokeInvitation: (invitationId) => mutations.revokeInvitationMutation.mutate(invitationId),
    onRefetchOrganizations: () => void organizationsQuery.refetch(),
  };
}
