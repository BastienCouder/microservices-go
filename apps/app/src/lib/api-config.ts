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
  projects: {
    list: () => "/projects",
    models: (projectId: string) => `/projects/${projectId}/models`,
    prompts: (
      projectId: string,
      options?: { page?: number; pageSize?: number; search?: string },
    ) => {
      const params = new URLSearchParams();
      if (options?.page && options.page > 0) params.set("page", String(options.page));
      if (options?.pageSize && options.pageSize > 0) params.set("page_size", String(options.pageSize));
      if (options?.search && options.search.trim() !== "") params.set("search", options.search.trim());
      const query = params.toString();
      return `/projects/${projectId}/prompts${query ? `?${query}` : ""}`;
    },
  },
  aiModels: {
    list: (activeOnly = true) => `/projects/ai-models${activeOnly ? "?active_only=true" : ""}`,
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
