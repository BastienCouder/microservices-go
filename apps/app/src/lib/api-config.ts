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
    brandCanon: (projectId: string) => `/projects/${projectId}/brand-canon`,
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
    generatePrompts: (projectId: string) => `/projects/${projectId}/prompts/generate`,
  },
  prompts: {
    update: (promptId: string) => `/prompts/${promptId}`,
  },
  competitors: {
    update: (competitorId: string) => `/competitors/${competitorId}`,
    delete: (competitorId: string) => `/competitors/${competitorId}`,
  },
  aiModels: {
    list: (activeOnly = true) => `/ai-models?active_only=${activeOnly ? "true" : "false"}`,
    onboardingList: (activeOnly = true) => `/onboarding/ai-models?active_only=${activeOnly ? "true" : "false"}`,
    create: () => "/ai-models",
    syncOpenRouter: () => "/ai-models/sync/openrouter",
    update: (modelId: string) => `/ai-models/${encodeURIComponent(modelId)}`,
  },
  agentReady: {
    scans: () => "/analysis/agent-ready/scans",
    scan: (scanId: string) => `/analysis/agent-ready/scans/${encodeURIComponent(scanId)}`,
  },
  onboarding: {
    bootstrap: () => "/onboarding/bootstrap",
    project: () => "/onboarding/project",
    projectModels: (projectId: string) =>
      `/onboarding/projects/${encodeURIComponent(projectId)}/models`,
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
    plans: () => "/billing/plans",
    publicPlans: () => "/billing/public/plans",
    pricingTiers: () => "/billing/pricing-tiers",
    creditCostSettings: () => "/billing/credit-cost-settings",
    pricingTier: (promptVolume: number) =>
      `/billing/pricing-tiers/${encodeURIComponent(String(promptVolume))}`,
    publicPricingTiers: () => "/billing/public/pricing-tiers",
    subscriptions: () => "/billing/subscriptions",
    stripeCheckoutSession: () => "/billing/stripe/checkout-session",
    stripePricingCatalogSync: (plan: string) =>
      `/billing/stripe/pricing-catalog/plans/${encodeURIComponent(plan)}/sync`,
  },
  analysis: {
    analyze: (projectId: string) => `/analysis/projects/${projectId}/run`,
    cancelRun: (runId: string) => `/analysis/runs/${encodeURIComponent(runId)}/cancel`,
    runs: (projectId: string, limit = 10) =>
      `/analysis/projects/${projectId}/runs?limit=${encodeURIComponent(String(limit))}`,
    perceptionRun: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/analysis/perception/run`,
    quota: (projectId: string) => `/analysis/projects/${projectId}/quota`,
    monitoring: (projectId: string) => `/analysis/projects/${projectId}/dashboard`,
    perception: (projectId: string, options?: { includeDashboard?: boolean }) =>
      options?.includeDashboard
        ? `/analysis/projects/${projectId}/perception?includeDashboard=1`
        : `/analysis/projects/${projectId}/perception`,
    optimizationErrors: (projectId: string) => `/analysis/projects/${projectId}/optimization-errors`,
    aiBriefSettings: (projectId: string) => `/analysis/projects/${projectId}/ai-brief-settings`,
    optimizeActions: (projectId: string) => `/analysis/projects/${projectId}/optimize-actions`,
    optimizeAction: (projectId: string, actionId: string) =>
      `/analysis/projects/${projectId}/optimize-actions/${encodeURIComponent(actionId)}`,
    brandCanon: (projectId: string) => `/analysis/projects/${projectId}/brand-canon`,
  },
  attribution: {
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
  },
} as const;

export function buildApiPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }

  return `/${path}`;
}
