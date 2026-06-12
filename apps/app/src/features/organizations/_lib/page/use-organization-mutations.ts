import { useMutation } from "@tanstack/react-query";
import { EMPTY_INVITATION_DRAFT } from "../shared/constants";
import {
  assignOrganizationProjectMember,
  createOrganizationAPIKey,
  createOrganizationInvitation,
  deleteOrganization,
  deleteOrganizationProject,
  removeOrganizationMember,
  removeOrganizationProjectMember,
  resendOrganizationInvitation,
  revokeOrganizationAPIKey,
  revokeOrganizationInvitation,
  updateOrganizationProject,
  updateOrganizationName,
  updateOrganizationMemberRoles,
} from "../shared/organization-page-api";
import {
  buildCurrentUserProjectAccessGuardMessage,
  buildProjectMembershipChangeGuardMessage,
  getMemberActionPolicy,
  getOrphanedProjectsAfterMemberProjectsChange,
  getProjectIdsForMember,
  memberHasOrganizationWideProjectAccess,
} from "../shared/project-membership";
import type {
  InvitationDraft,
  OrganizationAPIKey,
  OrganizationProject,
  OrganizationResources,
  ProjectSettingsInput,
  ProjectMemberDraft,
} from "../shared/types";

type OrganizationMutationsInput = {
  apiBaseURL: string;
  selectedOrganizationId: string;
  currentUserId: string;
  currentUserRoles: string[];
  resources: OrganizationResources;
  projectMemberDrafts: Record<string, ProjectMemberDraft>;
  invitationDraft: InvitationDraft;
  setProjectMemberDrafts: (updater: (current: Record<string, ProjectMemberDraft>) => Record<string, ProjectMemberDraft>) => void;
  setInvitationDraft: (draft: InvitationDraft) => void;
  setCreatedAPIKey: (value: OrganizationAPIKey | null) => void;
  setNotice: (value: string | null) => void;
  setLocalError: (value: string | null) => void;
  invalidateOrganizationData: () => Promise<void>;
  onDeleteOrganizationSuccess: () => void;
};

function buildOrganizationError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function resolveProjectOrganizationId(
  projects: OrganizationProject[],
  selectedOrganizationId: string,
  projectId: string,
): string {
  return projects.find((project) => project.id === projectId)?.organizationId || selectedOrganizationId;
}

export function useOrganizationMutations({
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
  onDeleteOrganizationSuccess,
}: OrganizationMutationsInput) {
  const getMemberRoles = (userId: string): string[] =>
    resources.members.find((member) => member.userId === userId)?.roles ?? [];
  const getProjectOrganizationId = (projectId: string): string =>
    resolveProjectOrganizationId(resources.projects, selectedOrganizationId, projectId);
  const getPolicyForUser = (userId: string) =>
    getMemberActionPolicy({
      actorRoles: currentUserRoles,
      targetRoles: getMemberRoles(userId),
      isCurrentUser: userId === currentUserId,
    });

  const updateProjectSettingsMutation = useMutation({
    mutationFn: async ({
      projectId,
      input,
    }: {
      projectId: string;
      input: ProjectSettingsInput;
    }) => {
      const name = input.name.trim();
      if (!projectId) throw new Error("Selectionne un projet.");
      if (!name) throw new Error("Le nom du projet est obligatoire.");
      const organizationId = getProjectOrganizationId(projectId);
      if (!organizationId) throw new Error("Selectionne une organisation.");
      await updateOrganizationProject(apiBaseURL, organizationId, projectId, {
        name,
      });
    },
    onSuccess: async () => {
      setNotice("Projet mis a jour.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de mettre a jour le projet."));
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!projectId) throw new Error("Selectionne un projet.");
      const organizationId = getProjectOrganizationId(projectId);
      if (!organizationId) throw new Error("Selectionne une organisation.");
      await deleteOrganizationProject(apiBaseURL, organizationId, projectId);
      return projectId;
    },
    onSuccess: async () => {
      setNotice("Projet supprime.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de supprimer le projet."));
    },
  });

  const assignProjectMemberMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const draft = projectMemberDrafts[projectId] ?? { userId: "", role: "viewer" };
      const userId = draft.userId.trim();
      const role = draft.role.trim() || "viewer";
      if (!projectId) throw new Error("Selectionne un projet.");
      if (!userId) throw new Error("Selectionne un membre.");
      const organizationId = getProjectOrganizationId(projectId);
      if (!organizationId) throw new Error("Selectionne une organisation.");
      await assignOrganizationProjectMember(apiBaseURL, organizationId, projectId, { userId, role });
      return projectId;
    },
    onSuccess: async (projectId) => {
      setProjectMemberDrafts((current) => ({ ...current, [projectId]: { userId: "", role: "viewer" } }));
      setNotice("Membre ajoute au projet.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible d'ajouter le membre au projet."));
    },
  });

  const removeProjectMemberMutation = useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: string; userId: string }) => {
      if (!projectId || !userId) throw new Error("Selectionne un membre de projet.");
      if (!getPolicyForUser(userId).canEditProjects) throw new Error("Action interdite pour ce membre.");
      const targetRoles = getMemberRoles(userId);
      if (memberHasOrganizationWideProjectAccess(targetRoles)) return;
      const nextProjectIds = getProjectIdsForMember(resources.projectMembers, userId).filter(
        (id) => id !== projectId,
      );
      const currentUserGuardMessage = buildCurrentUserProjectAccessGuardMessage({
        currentUserId,
        userId,
        nextProjectIds,
        roles: targetRoles,
      });
      if (currentUserGuardMessage) throw new Error(currentUserGuardMessage);
      const guardMessage = buildProjectMembershipChangeGuardMessage(
        getOrphanedProjectsAfterMemberProjectsChange({
          projects: resources.projects,
          projectMembers: resources.projectMembers,
          organizationMembers: resources.members,
          userId,
          nextProjectIds,
        }),
      );
      if (guardMessage) throw new Error(guardMessage);
      const organizationId = getProjectOrganizationId(projectId);
      if (!organizationId) throw new Error("Selectionne une organisation.");
      await removeOrganizationProjectMember(apiBaseURL, organizationId, projectId, userId);
    },
    onSuccess: async () => {
      setNotice("Membre retire du projet.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de retirer le membre du projet."));
    },
  });

  const updateMemberProjectsMutation = useMutation({
    mutationFn: async ({ userId, projectIds }: { userId: string; projectIds: string[] }) => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!userId) throw new Error("Selectionne un membre.");
      if (!getPolicyForUser(userId).canEditProjects) throw new Error("Action interdite pour ce membre.");
      const targetRoles = getMemberRoles(userId);
      if (memberHasOrganizationWideProjectAccess(targetRoles)) return;
      const currentProjectIds = getProjectIdsForMember(resources.projectMembers, userId);
      const nextProjectIds = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right, "fr"),
      );
      const currentUserGuardMessage = buildCurrentUserProjectAccessGuardMessage({
        currentUserId,
        userId,
        nextProjectIds,
        roles: targetRoles,
      });
      if (currentUserGuardMessage) throw new Error(currentUserGuardMessage);
      const guardMessage = buildProjectMembershipChangeGuardMessage(
        getOrphanedProjectsAfterMemberProjectsChange({
          projects: resources.projects,
          projectMembers: resources.projectMembers,
          organizationMembers: resources.members,
          userId,
          nextProjectIds,
        }),
      );
      if (guardMessage) throw new Error(guardMessage);

      const currentProjectIdSet = new Set(currentProjectIds);
      const nextProjectIdSet = new Set(nextProjectIds);
      const projectIdsToAdd = nextProjectIds.filter((projectId) => !currentProjectIdSet.has(projectId));
      const projectIdsToRemove = currentProjectIds.filter((projectId) => !nextProjectIdSet.has(projectId));
      await Promise.all(
        projectIdsToAdd.map((projectId) =>
          assignOrganizationProjectMember(apiBaseURL, getProjectOrganizationId(projectId), projectId, {
            userId,
            role: "viewer",
          }),
        ),
      );
      await Promise.all(
        projectIdsToRemove.map((projectId) =>
          removeOrganizationProjectMember(apiBaseURL, getProjectOrganizationId(projectId), projectId, userId),
        ),
      );
    },
    onSuccess: async () => {
      setNotice("Projets du membre mis a jour.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de mettre a jour les projets du membre."));
    },
  });

  const updateMemberRolesMutation = useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: string[] }) => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!userId) throw new Error("Selectionne un membre.");
      if (roles.length === 0) throw new Error("Au moins un role est obligatoire.");
      const policy = getPolicyForUser(userId);
      if (!policy.canEditRoles) throw new Error("Action interdite pour ce membre.");
      await updateOrganizationMemberRoles(apiBaseURL, selectedOrganizationId, userId, roles);
    },
    onSuccess: async () => {
      setNotice("Roles mis a jour.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de mettre a jour les roles."));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!userId) throw new Error("Selectionne un membre.");
      if (!getPolicyForUser(userId).canRemoveMember) throw new Error("Action interdite pour ce membre.");
      const guardMessage = buildProjectMembershipChangeGuardMessage(
        getOrphanedProjectsAfterMemberProjectsChange({
          projects: resources.projects,
          projectMembers: resources.projectMembers,
          organizationMembers: resources.members,
          userId,
          nextProjectIds: [],
        }),
      );
      if (guardMessage) throw new Error(guardMessage);
      await removeOrganizationMember(apiBaseURL, selectedOrganizationId, userId);
    },
    onSuccess: async () => {
      setNotice("Membre retire de l'organisation.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de retirer le membre."));
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async () => {
      const email = invitationDraft.email.trim();
      const role = invitationDraft.role.trim() || "viewer";
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!email) throw new Error("L'email est obligatoire.");
      await createOrganizationInvitation(apiBaseURL, selectedOrganizationId, {
        email,
        role,
        message: invitationDraft.message.trim(),
        projectId: invitationDraft.projectId.trim(),
      });
    },
    onSuccess: async () => {
      setInvitationDraft(EMPTY_INVITATION_DRAFT);
      setNotice("Invitation envoyee.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible d'envoyer l'invitation."));
    },
  });

  const updateOrganizationNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const nextName = name.trim();
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!nextName) throw new Error("Le nom de l'organisation est obligatoire.");
      await updateOrganizationName(apiBaseURL, selectedOrganizationId, nextName);
    },
    onSuccess: async () => {
      setNotice("Organisation mise a jour.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de mettre a jour l'organisation."));
    },
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      await deleteOrganization(apiBaseURL, selectedOrganizationId);
    },
    onSuccess: async () => {
      setNotice("Organisation supprimee.");
      setLocalError(null);
      await invalidateOrganizationData();
      onDeleteOrganizationSuccess();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de supprimer l'organisation."));
    },
  });

  const createAPIKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const nextName = name.trim();
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!nextName) throw new Error("Le nom de l'API key est obligatoire.");
      return createOrganizationAPIKey(apiBaseURL, selectedOrganizationId, nextName);
    },
    onSuccess: async (apiKey) => {
      setCreatedAPIKey(apiKey);
      setNotice("API key creee.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setCreatedAPIKey(null);
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de creer l'API key."));
    },
  });

  const revokeAPIKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!keyId) throw new Error("Selectionne une API key.");
      await revokeOrganizationAPIKey(apiBaseURL, selectedOrganizationId, keyId);
    },
    onSuccess: async () => {
      setCreatedAPIKey(null);
      setNotice("API key supprimee.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de supprimer l'API key."));
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!invitationId) throw new Error("Selectionne une invitation.");
      await revokeOrganizationInvitation(apiBaseURL, selectedOrganizationId, invitationId);
    },
    onSuccess: async () => {
      setNotice("Invitation desactivee.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de desactiver l'invitation."));
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!invitationId) throw new Error("Selectionne une invitation.");
      const invitation = resources.invitations.find((item) => item.id === invitationId);
      if (!invitation) throw new Error("Invitation introuvable.");
      await resendOrganizationInvitation(apiBaseURL, selectedOrganizationId, invitation);
    },
    onSuccess: async () => {
      setNotice("Invitation renvoyee.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de renvoyer l'invitation."));
    },
  });

  return {
    updateProjectSettingsMutation,
    deleteProjectMutation,
    assignProjectMemberMutation,
    removeProjectMemberMutation,
    updateMemberProjectsMutation,
    updateMemberRolesMutation,
    removeMemberMutation,
    createInvitationMutation,
    updateOrganizationNameMutation,
    deleteOrganizationMutation,
    createAPIKeyMutation,
    revokeAPIKeyMutation,
    revokeInvitationMutation,
    resendInvitationMutation,
  };
}
