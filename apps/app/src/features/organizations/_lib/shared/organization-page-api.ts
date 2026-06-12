import { apiRoutes } from "@/lib/api-config";
import {
  gatewayJSON,
  optionalGatewayData,
  requireGatewayData,
} from "@/shared/api/gateway";
import { attachStableSlugs, slugifyPublicName } from "@/shared/public-slugs";
import {
  getArray,
  getField,
  getIDString,
  isRecord,
  normalizeHierarchyProjects,
  normalizeInvitation,
  normalizeAPIKey,
  normalizeMembership,
  normalizeOrganization,
  normalizeProjectMember,
  normalizeResourcesMembers,
  unwrapData,
} from "./api-normalizers";
import type {
  OrganizationInvitation,
  OrganizationAPIKey,
  OrganizationProjectMember,
  OrganizationRole,
  ProjectSettingsInput,
  OrganizationResources,
  OrganizationSummary,
} from "./types";

export type {
  OrganizationInvitation,
  OrganizationAPIKey,
  OrganizationMember,
  OrganizationProject,
  OrganizationProjectMember,
  OrganizationResources,
  OrganizationRole,
  OrganizationSummary,
} from "./types";

type LoadOrganizationResourcesOptions = {
  canManageOrganization?: boolean;
  organizationRole?: OrganizationRole;
  currentUserEmail?: string;
  currentUserId?: string;
  signal?: AbortSignal;
};

export async function loadOrganizationSummaries(
  apiBaseURL: string,
  signal?: AbortSignal,
): Promise<OrganizationSummary[]> {
  const membershipsPayload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.me(), {
      method: "GET",
      signal,
    }),
    "Impossible de charger les organisations.",
  );
  const memberships = getArray(membershipsPayload)
    .map(normalizeMembership)
    .filter((membership): membership is NonNullable<typeof membership> => membership !== null);

  const organizations = await Promise.all(
    memberships.map(async (membership) => {
      const response = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.organizations.get(membership.organizationId),
        {
          method: "GET",
          organizationId: membership.organizationId,
          signal,
        },
      );

      if (!response.ok) {
        return normalizeOrganization(null, membership);
      }
      return normalizeOrganization(response.data, membership);
    }),
  );

  return attachStableSlugs(
    [...organizations].sort((left, right) => left.name.localeCompare(right.name, "fr")),
    "organization",
  );
}

export async function loadOrganizationResources(
  apiBaseURL: string,
  organizationId: string,
  options: LoadOrganizationResourcesOptions = {},
): Promise<OrganizationResources> {
  const signal = options.signal;
  const canManageOrganization = options.canManageOrganization ?? false;
  const [organizationPayload, hierarchyPayload, membersPayload] = await Promise.all([
    requireGatewayData(
      gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.get(organizationId), {
        method: "GET",
        organizationId,
        signal,
      }),
      "Impossible de charger l'organisation.",
    ),
    requireGatewayData(
      gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.hierarchy(organizationId), {
        method: "GET",
        organizationId,
        signal,
      }),
      "Impossible de charger les projets.",
    ),
    canManageOrganization
      ? requireGatewayData(
          gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.members(organizationId), {
            method: "GET",
            organizationId,
            signal,
          }),
          "Impossible de charger les membres.",
        )
      : optionalGatewayData(
          gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.members(organizationId), {
            method: "GET",
            organizationId,
            signal,
          }),
          [],
        ),
  ]);

  const projects = normalizeHierarchyProjects(hierarchyPayload);
  console.info("[organizations] hierarchy payload", {
    organizationId,
    raw: hierarchyPayload,
    normalizedProjects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
    })),
  });

  const projectMembersPromise = Promise.all(
    projects.map(async (project) => {
      const payload = canManageOrganization
        ? await requireGatewayData(
            gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.members(project.id), {
              method: "GET",
              organizationId,
              signal,
            }),
            "Impossible de charger les membres du projet.",
          )
        : await optionalGatewayData(
            gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.members(project.id), {
              method: "GET",
              organizationId,
              signal,
            }),
            [],
          );
      return getArray(unwrapData(payload))
        .map(normalizeProjectMember)
        .filter((member): member is OrganizationProjectMember => member !== null);
    }),
  ).then((items) => items.flat());

  const [projectMembers, invitationsPayload, apiKeysPayload] = canManageOrganization
    ? await Promise.all([
        projectMembersPromise,
        requireGatewayData(
          gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.invitations(organizationId), {
            method: "GET",
            organizationId,
            signal,
          }),
          "Impossible de charger les invitations.",
        ),
        requireGatewayData(
          gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.apiKeys(organizationId), {
            method: "GET",
            organizationId,
            signal,
          }),
          "Impossible de charger les API keys.",
        ),
      ])
    : [await projectMembersPromise, [], []];

  const organization = normalizeOrganization(organizationPayload, {
    organizationId,
    role: options.organizationRole ?? "viewer",
  });
  let members = normalizeResourcesMembers(membersPayload);
  const currentUserId = options.currentUserId?.trim() ?? "";
  if (!canManageOrganization && currentUserId && !members.some((member) => member.userId === currentUserId)) {
    members = [
      {
        organizationId,
        userId: currentUserId,
        email: options.currentUserEmail?.trim() ?? "",
        firstName: "",
        lastName: "",
        roles: [options.organizationRole ?? "viewer"],
        addedAt: "",
      },
    ];
  }
  const invitations = getArray(invitationsPayload)
    .map(normalizeInvitation)
    .filter((invitation): invitation is OrganizationInvitation => invitation !== null);
  const apiKeys = getArray(apiKeysPayload)
    .map(normalizeAPIKey)
    .filter((apiKey): apiKey is OrganizationAPIKey => apiKey !== null);

  console.info("[organizations] resources normalized", {
    organizationId,
    projectCount: projects.length,
    projectMemberCount: projectMembers.length,
    members: members.map((member) => ({
      userId: member.userId,
      roles: member.roles,
      email: member.email,
    })),
  });

  return {
    organization: {
      ...organization,
      slug: slugifyPublicName(organization.name, "organization"),
    },
    projects,
    projectMembers,
    members,
    invitations,
    apiKeys,
  };
}

export async function updateOrganizationName(
  apiBaseURL: string,
  organizationId: string,
  name: string,
): Promise<OrganizationSummary> {
  const payload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.update(organizationId), {
      method: "PATCH",
      organizationId,
      body: JSON.stringify({ name }),
    }),
    "Impossible de mettre a jour l'organisation.",
  );
  return normalizeOrganization(payload, {
    organizationId,
    role: "viewer",
  });
}

export async function deleteOrganization(
  apiBaseURL: string,
  organizationId: string,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.delete(organizationId), {
      method: "DELETE",
      organizationId,
    }),
    "Impossible de supprimer l'organisation.",
  );
}

export async function updateOrganizationProject(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  input: ProjectSettingsInput,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.update(projectId), {
      method: "PATCH",
      organizationId,
      body: JSON.stringify(input),
    }),
    "Impossible de mettre a jour le projet.",
  );
}

export async function deleteOrganizationProject(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.remove(projectId), {
      method: "DELETE",
      organizationId,
    }),
    "Impossible de supprimer le projet.",
  );
}

export async function createOrganizationAPIKey(
  apiBaseURL: string,
  organizationId: string,
  name: string,
): Promise<OrganizationAPIKey> {
  const payload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.apiKeys(organizationId), {
      method: "POST",
      organizationId,
      body: JSON.stringify({ name }),
    }),
    "Impossible de creer l'API key.",
  );
  const key = normalizeAPIKey(payload);
  if (!key) {
    throw new Error("Reponse API key invalide.");
  }
  return key;
}

export async function revokeOrganizationAPIKey(
  apiBaseURL: string,
  organizationId: string,
  keyId: string,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.apiKey(organizationId, keyId), {
      method: "DELETE",
      organizationId,
    }),
    "Impossible de supprimer l'API key.",
  );
}

export async function createOrganizationProject(
  apiBaseURL: string,
  organizationId: string,
  input: {
    name: string;
    websiteUrl: string;
    domain: string;
    brandName: string;
  },
): Promise<string> {
  const payload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.create(), {
      method: "POST",
      organizationId,
      body: JSON.stringify(input),
    }),
    "Impossible de creer le projet.",
  );
  const record = unwrapData(payload);
  return isRecord(record) ? getIDString(getField(record, ["id", "ID"])) : "";
}

export async function createOrganizationInvitation(
  apiBaseURL: string,
  organizationId: string,
  input: {
    email: string;
    role: string;
    message: string;
    projectId?: string;
  },
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.invitations(organizationId), {
      method: "POST",
      organizationId,
      body: JSON.stringify({
        email: input.email,
        role: input.role,
        message: input.message,
        projectId: input.projectId ?? "",
      }),
    }),
    "Impossible d'envoyer l'invitation.",
  );
}

export async function revokeOrganizationInvitation(
  apiBaseURL: string,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.invitation(organizationId, invitationId), {
      method: "DELETE",
      organizationId,
    }),
    "Impossible de desactiver l'invitation.",
  );
}

export async function resendOrganizationInvitation(
  apiBaseURL: string,
  organizationId: string,
  invitation: OrganizationInvitation,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.invitation(organizationId, invitation.id), {
      method: "PUT",
      organizationId,
      body: JSON.stringify({
        email: invitation.email,
        role: invitation.role,
        message: invitation.message,
        expires_at: invitation.expiresAt || "",
      }),
    }),
    "Impossible de renvoyer l'invitation.",
  );
}

export async function assignOrganizationProjectMember(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  input: {
    userId: string;
    role: string;
  },
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.members(projectId), {
      method: "POST",
      organizationId,
      body: JSON.stringify({
        userId: Number.parseInt(input.userId, 10),
        role: input.role,
      }),
    }),
    "Impossible d'ajouter le membre au projet.",
  );
}

export async function removeOrganizationProjectMember(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  userId: string,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.member(projectId, userId), {
      method: "DELETE",
      organizationId,
    }),
    "Impossible de retirer le membre du projet.",
  );
}

export async function updateOrganizationMemberRoles(
  apiBaseURL: string,
  organizationId: string,
  userId: string,
  roles: string[],
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.updateMemberRole(organizationId, userId), {
      method: "PATCH",
      organizationId,
      body: JSON.stringify({ roles }),
    }),
    "Impossible de mettre a jour les roles du membre.",
  );
}

export async function removeOrganizationMember(
  apiBaseURL: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.removeMember(organizationId, userId), {
      method: "DELETE",
      organizationId,
    }),
    "Impossible de retirer le membre de l'organisation.",
  );
}
