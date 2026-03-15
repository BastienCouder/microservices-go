export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "",
} as const;

export const apiRoutes = {
  organizations: {
    me: () => "/organizations/me",
    create: () => "/organizations",
    delete: (id: string) => `/organizations/${id}`,
    get: (id: string) => `/organizations/${id}`,
    hierarchy: (id: string) => `/organizations/${id}/hierarchy`,
    update: (id: string) => `/organizations/${id}`,
    inviteMember: (id: string) => `/organizations/${id}/invitations`,
    removeMember: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
    updateMemberRole: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
    acceptInvitation: (token: string) => `/organizations/invitations/${token}/accept`,
  },
  projects: {
    create: () => "/projects",
    list: () => "/projects",
    get: (projectId: string) => `/projects/${projectId}`,
    impactIntegrations: (projectId: string) => `/projects/${projectId}/impact-integrations`,
    competitors: (projectId: string) => `/projects/${projectId}/competitors`,
    promptsStatus: (projectId: string) => `/projects/${projectId}/prompts/status`,
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
  prompts: {
    update: (promptId: string) => `/prompts/${promptId}`,
  },
  competitors: {
    update: (competitorId: string) => `/competitors/${competitorId}`,
    delete: (competitorId: string) => `/competitors/${competitorId}`,
  },
  aiModels: {
    list: (activeOnly = true) => `/projects/ai-models${activeOnly ? "?active_only=true" : ""}`,
  },
  analysis: {
    dashboard: (projectId: string) => `/analysis/projects/${projectId}/dashboard`,
    perception: (projectId: string) => `/analysis/projects/${projectId}/perception`,
    optimizeActions: (projectId: string) => `/analysis/projects/${projectId}/optimize-actions`,
    brandCanon: (projectId: string) => `/analysis/projects/${projectId}/brand-canon`,
  },
  attribution: {
    funnel: (projectId: string) => `/attribution/projects/${projectId}/funnel`,
    ingest: (projectId: string) => `/attribution/ingest/${projectId}`,
    stripeWebhook: (projectId: string) => `/attribution/stripe/webhook/${projectId}`,
    events: (projectId: string, options?: { limit?: number }) => {
      const params = new URLSearchParams();
      if (options?.limit && options.limit > 0) params.set("limit", String(options.limit));
      const query = params.toString();
      return `/attribution/projects/${projectId}/events${query ? `?${query}` : ""}`;
    },
    recordEvent: (projectId: string) => `/attribution/projects/${projectId}/events`,
  },
} as const;

export function buildApiPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }

  return `/${path}`;
}
