import { useMutation } from "@tanstack/react-query";
import { EMPTY_INVITATION_DRAFT } from "../shared/constants";
import {
  assignOrganizationProjectMember,
  banOrganizationMember,
  createOrganizationInvitation,
  removeOrganizationMember,
  removeOrganizationProjectMember,
  revokeOrganizationInvitation,
  unbanOrganizationMember,
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
  OrganizationResources,
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
  setNotice: (value: string | null) => void;
  setLocalError: (value: string | null) => void;
  invalidateOrganizationData: () => Promise<void>;
};

function buildOrganizationError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  setNotice,
  setLocalError,
  invalidateOrganizationData,
}: OrganizationMutationsInput) {
  const getMemberRoles = (userId: string): string[] =>
    resources.members.find((member) => member.userId === userId)?.roles ?? [];
  const getPolicyForUser = (userId: string) =>
    getMemberActionPolicy({
      actorRoles: currentUserRoles,
      targetRoles: getMemberRoles(userId),
      isCurrentUser: userId === currentUserId,
    });

  const assignProjectMemberMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const draft = projectMemberDrafts[projectId] ?? { userId: "", role: "viewer" };
      const userId = draft.userId.trim();
      const role = draft.role.trim() || "viewer";
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!projectId) throw new Error("Selectionne un projet.");
      if (!userId) throw new Error("Selectionne un membre.");
      await assignOrganizationProjectMember(apiBaseURL, selectedOrganizationId, projectId, { userId, role });
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
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
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
      await removeOrganizationProjectMember(apiBaseURL, selectedOrganizationId, projectId, userId);
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
          assignOrganizationProjectMember(apiBaseURL, selectedOrganizationId, projectId, {
            userId,
            role: "viewer",
          }),
        ),
      );
      await Promise.all(
        projectIdsToRemove.map((projectId) =>
          removeOrganizationProjectMember(apiBaseURL, selectedOrganizationId, projectId, userId),
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
      if (roles.includes("owner") && !policy.canAssignOwnerRole) {
        throw new Error("Seul un owner peut attribuer le role owner.");
      }
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

  const setMemberBannedMutation = useMutation({
    mutationFn: async ({ userId, banned }: { userId: string; banned: boolean }) => {
      if (!selectedOrganizationId) throw new Error("Selectionne une organisation.");
      if (!userId) throw new Error("Selectionne un membre.");
      if (!getPolicyForUser(userId).canSetBanned) throw new Error("Action interdite pour ce membre.");
      if (banned) {
        await banOrganizationMember(apiBaseURL, selectedOrganizationId, userId);
        return true;
      }
      await unbanOrganizationMember(apiBaseURL, selectedOrganizationId, userId);
      return false;
    },
    onSuccess: async (banned) => {
      setNotice(banned ? "Membre banni." : "Membre debanni.");
      setLocalError(null);
      await invalidateOrganizationData();
    },
    onError: (error) => {
      setNotice(null);
      setLocalError(buildOrganizationError(error, "Impossible de mettre a jour le statut du membre."));
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: async () => {
      const email = invitationDraft.email.trim();
      const role = invitationDraft.role.trim() || "member";
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

  return {
    assignProjectMemberMutation,
    removeProjectMemberMutation,
    updateMemberProjectsMutation,
    updateMemberRolesMutation,
    removeMemberMutation,
    setMemberBannedMutation,
    createInvitationMutation,
    revokeInvitationMutation,
  };
}
