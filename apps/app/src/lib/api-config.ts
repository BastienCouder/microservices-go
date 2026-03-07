export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "",
} as const;

export const apiRoutes = {
  organizations: {
    me: () => "/organizations/me",
    create: () => "/organizations",
    delete: (id: string) => `/organizations/${id}`,
    get: (id: string) => `/organizations/${id}`,
    update: (id: string) => `/organizations/${id}`,
    inviteMember: (id: string) => `/organizations/${id}/invitations`,
    removeMember: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
    updateMemberRole: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
    acceptInvitation: (token: string) => `/organizations/invitations/${token}/accept`,
  },
  analysis: {
    perception: (projectId: string) => `/analysis/projects/${projectId}/perception`,
    optimizeActions: (projectId: string) => `/analysis/projects/${projectId}/optimize-actions`,
    brandCanon: (projectId: string) => `/analysis/projects/${projectId}/brand-canon`,
  },
} as const;

export function buildApiPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }

  return `/${path}`;
}
