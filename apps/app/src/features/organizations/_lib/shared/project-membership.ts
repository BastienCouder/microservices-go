import type {
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
} from "./types";

export type MemberActionPolicy = {
  showActions: boolean;
  canEditRoles: boolean;
  canEditProjects: boolean;
  canRemoveMember: boolean;
  canAssignOwnerRole: boolean;
};

export const ASSIGNABLE_ORGANIZATION_ROLES = ["admin", "member"] as const;
export const INVITABLE_ORGANIZATION_ROLES = ["admin", "member"] as const;

const EMPTY_MEMBER_ACTION_POLICY: MemberActionPolicy = {
  showActions: false,
  canEditRoles: false,
  canEditProjects: false,
  canRemoveMember: false,
  canAssignOwnerRole: false,
};

function uniqueSortedProjectIds(projectMembers: OrganizationProjectMember[]): string[] {
  return Array.from(new Set(projectMembers.map((member) => member.projectId))).sort((left, right) =>
    left.localeCompare(right, "fr"),
  );
}

function hasRole(roles: string[], role: string): boolean {
  return roles.map((item) => item.trim().toLowerCase()).includes(role);
}

export function memberHasOrganizationWideProjectAccess(roles: string[]): boolean {
  return hasRole(roles, "owner");
}

export function getMemberActionPolicy({
  actorRoles,
  targetRoles,
  isCurrentUser = false,
}: {
  actorRoles: string[];
  targetRoles: string[];
  isCurrentUser?: boolean;
}): MemberActionPolicy {
  const actorIsOwner = hasRole(actorRoles, "owner");
  const actorIsAdminLike = hasRole(actorRoles, "admin") || hasRole(actorRoles, "super_admin");
  const actorCanManageMembers = actorIsOwner || actorIsAdminLike;
  if (!actorCanManageMembers) return EMPTY_MEMBER_ACTION_POLICY;
  if (isCurrentUser) return EMPTY_MEMBER_ACTION_POLICY;

  const targetIsOwner = hasRole(targetRoles, "owner");
  if (targetIsOwner && !actorIsOwner) return EMPTY_MEMBER_ACTION_POLICY;

  return {
    showActions: true,
    canEditRoles: true,
    canEditProjects: !targetIsOwner,
    canRemoveMember: actorIsAdminLike && !targetIsOwner,
    canAssignOwnerRole: actorIsOwner,
  };
}

export function getProjectIdsForMember(
  projectMembers: OrganizationProjectMember[],
  userId: string,
  options?: {
    projects?: OrganizationProject[];
    roles?: string[];
  },
): string[] {
  if (options?.projects && memberHasOrganizationWideProjectAccess(options.roles ?? [])) {
    return options.projects
      .map((project) => project.id)
      .sort((left, right) => left.localeCompare(right, "fr"));
  }
  return uniqueSortedProjectIds(projectMembers.filter((member) => member.userId === userId));
}

export function getProjectNamesForMember(
  projects: OrganizationProject[],
  projectMembers: OrganizationProjectMember[],
  userId: string,
  roles: string[] = [],
): string[] {
  if (memberHasOrganizationWideProjectAccess(roles)) {
    return ["Tous les projets"];
  }
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  return getProjectIdsForMember(projectMembers, userId, { projects, roles })
    .map((projectId) => projectNameById.get(projectId) ?? `Projet ${projectId}`)
    .sort((left, right) => left.localeCompare(right, "fr"));
}

export function getOrphanedProjectsAfterMemberProjectsChange({
  projects,
  projectMembers,
  organizationMembers = [],
  userId,
  nextProjectIds,
}: {
  projects: OrganizationProject[];
  projectMembers: OrganizationProjectMember[];
  organizationMembers?: OrganizationMember[];
  userId: string;
  nextProjectIds: string[];
}): OrganizationProject[] {
  const currentProjectIds = new Set(getProjectIdsForMember(projectMembers, userId));
  const nextProjectIdSet = new Set(nextProjectIds);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const organizationWideUserIds = new Set(
    organizationMembers
      .filter((member) => memberHasOrganizationWideProjectAccess(member.roles))
      .filter((member) => !hasRole(member.roles, "banned"))
      .map((member) => member.userId),
  );

  return Array.from(currentProjectIds)
    .filter((projectId) => !nextProjectIdSet.has(projectId))
    .filter((projectId) => {
      const remainingUserIds = new Set(
        projectMembers
          .filter((member) => member.projectId === projectId && member.userId !== userId)
          .map((member) => member.userId),
      );
      for (const organizationWideUserId of organizationWideUserIds) {
        remainingUserIds.add(organizationWideUserId);
      }
      return remainingUserIds.size === 0;
    })
    .map((projectId) => projectById.get(projectId))
    .filter((project): project is OrganizationProject => project !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

export function buildProjectMembershipChangeGuardMessage(
  orphanedProjects: OrganizationProject[],
): string | null {
  if (orphanedProjects.length === 0) return null;
  const projectNames = orphanedProjects.map((project) => project.name).join(", ");
  return `Modification interdite: ${projectNames} se retrouverait sans utilisateur.`;
}

export function buildCurrentUserProjectAccessGuardMessage({
  currentUserId,
  userId,
  nextProjectIds,
  roles = [],
}: {
  currentUserId: string;
  userId: string;
  nextProjectIds: string[];
  roles?: string[];
}): string | null {
  if (memberHasOrganizationWideProjectAccess(roles)) return null;
  if (!currentUserId || userId !== currentUserId || nextProjectIds.length > 0) return null;
  return "Modification interdite: votre compte doit rester rattache a au moins un projet.";
}
