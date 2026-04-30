export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "",
} as const;

export const apiRoutes = {
  users: {
    me: () => "/users/me",
    deleteMe: () => "/users/me",
  },
  organizations: {
    me: () => "/organizations/me",
    create: () => "/organizations",
    delete: (id: string) => `/organizations/${id}`,
    get: (id: string) => `/organizations/${id}`,
    hierarchy: (id: string) => `/organizations/${id}/hierarchy`,
    members: (id: string) => `/organizations/${id}/members`,
    apiKeys: (id: string) => `/organizations/${id}/api-keys`,
    apiKey: (orgId: string, keyId: string) => `/organizations/${orgId}/api-keys/${keyId}`,
    invitations: (id: string) => `/organizations/${id}/invitations`,
    invitation: (orgId: string, invitationId: string) => `/organizations/${orgId}/invitations/${invitationId}`,
    update: (id: string) => `/organizations/${id}`,
    inviteMember: (id: string) => `/organizations/${id}/invitations`,
    assignMemberRole: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}/roles`,
    removeMember: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
    updateMemberRole: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
    acceptInvitation: (token: string) => `/invitations/${encodeURIComponent(token)}/accept`,
  },
  projects: {
    create: () => "/projects",
    list: () => "/projects",
    get: (projectId: string) => `/projects/${projectId}`,
    update: (projectId: string) => `/projects/${projectId}`,
    remove: (projectId: string) => `/projects/${projectId}`,
    members: (projectId: string) => `/projects/${projectId}/members`,
    member: (projectId: string, userId: string) => `/projects/${projectId}/members/${userId}`,
    impactIntegrations: (projectId: string) => `/projects/${projectId}/impact-integrations`,
    ga4OAuthStart: (projectId: string) =>
      `/projects/${projectId}/impact-integrations/ga4/oauth/start`,
    ga4OAuthCallback: (projectId: string) =>
      `/projects/${projectId}/impact-integrations/ga4/oauth/callback`,
    ga4OAuthProperties: (projectId: string) =>
      `/projects/${projectId}/impact-integrations/ga4/oauth/properties`,
    ga4OAuthProperty: (projectId: string) =>
      `/projects/${projectId}/impact-integrations/ga4/oauth/property`,
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
    list: (activeOnly = true) => `/projects/ai-models?active_only=${activeOnly ? "true" : "false"}`,
    create: () => "/projects/ai-models",
    syncOpenRouter: () => "/projects/ai-models/sync/openrouter",
    update: (modelId: string) => `/projects/ai-models/${encodeURIComponent(modelId)}`,
  },
  llmProviderCredentials: {
    list: (projectId: string) =>
      `/projects/${encodeURIComponent(projectId)}/llm-provider-credentials`,
    update: (projectId: string, provider: string) =>
      `/projects/${encodeURIComponent(projectId)}/llm-provider-credentials/${encodeURIComponent(provider)}`,
    delete: (projectId: string, provider: string) =>
      `/projects/${encodeURIComponent(projectId)}/llm-provider-credentials/${encodeURIComponent(provider)}`,
  },
  billing: {
    quota: (organizationId: string) => `/billing/quotas/${organizationId}`,
  },
  analysis: {
    analyze: (projectId: string) => `/projects/${projectId}/analysis/run`,
    quota: (projectId: string) => `/analysis/projects/${projectId}/quota`,
    monitoring: (projectId: string) => `/analysis/projects/${projectId}/dashboard`,
    perception: (projectId: string) => `/analysis/projects/${projectId}/perception`,
    optimizeActions: (projectId: string) => `/analysis/projects/${projectId}/optimize-actions`,
    brandCanon: (projectId: string) => `/analysis/projects/${projectId}/brand-canon`,
  },
  attribution: {
    funnel: (projectId: string) => `/attribution/projects/${projectId}/funnel`,
    traffic: (
      projectId: string,
      options?: { from?: string; to?: string; search?: string; engine?: string },
    ) => {
      const params = new URLSearchParams();
      if (options?.from) params.set("from", options.from);
      if (options?.to) params.set("to", options.to);
      if (options?.search) params.set("search", options.search);
      if (options?.engine && options.engine !== "all") params.set("engine", options.engine);
      const query = params.toString();
      return `/attribution/projects/${projectId}/traffic${query ? `?${query}` : ""}`;
    },
    geo: (projectId: string, options?: { from?: string; to?: string }) => {
      const params = new URLSearchParams();
      if (options?.from) params.set("from", options.from);
      if (options?.to) params.set("to", options.to);
      const query = params.toString();
      return `/attribution/projects/${projectId}/traffic${query ? `?${query}` : ""}`;
    },
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
