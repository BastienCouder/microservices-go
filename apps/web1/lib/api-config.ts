export const API_CONFIG = {
    BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
} as const;

export const apiRoutes = {
    auth: (path: string) => `/auth${path}`,
    profiles: {
        me: () => `/profiles/me`,
        update: () => `/profiles/me`,
    },

    billing: {
        createSubscription: () => `/billing/create-subscription`,
        cancelSubscription: () => `/billing/cancel-subscription`,
        resumeSubscription: () => `/billing/resume-subscription`,
        updatePaymentMethod: () => `/billing/update-payment-method`,
        invoices: () => `/billing/invoices`,
        ensureSynced: () => `/billing/ensure-synced`,
        cancelIncomplete: () => `/billing/cancel-incomplete-subscription`,
    },

    admin: {
        users: (path: string = '') => `/admin/users${path}`,
        profiles: (path: string = '') => `/admin/profiles${path}`,
        stats: {
            users: () => `/admin/stats/users`,
            profiles: () => `/admin/stats/profiles`,
            billing: () => `/admin/stats/billing`,
        },
    },

    organizations: {
        me: () => `/organizations/me`,
        create: () => `/organizations`,
        delete: (id: string) => `/organizations/${id}`,
        get: (id: string) => `/organizations/${id}`,
        update: (id: string) => `/organizations/${id}`,
        inviteMember: (id: string) => `/organizations/${id}/invitations`,
        removeMember: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
        updateMemberRole: (orgId: string, userId: string) => `/organizations/${orgId}/members/${userId}`,
        acceptInvitation: (token: string) => `/organizations/invitations/${token}/accept`,
    },

    audits: {
        list: () => `/audits`,
        create: () => `/audits`,
        get: (id: string) => `/audits/${id}`,
        delete: (id: string) => `/audits/${id}`,
    },

    projects: {
        create: () => `/projects`,
        createAndFinalize: () => `/projects/create-and-finalize`,
        list: () => `/projects`,
        get: (id: string) => `/projects/${id}`,
        update: (id: string) => `/projects/${id}`,
        activate: (id: string) => `/projects/${id}/activate`,
        finalize: (id: string) => `/projects/${id}/finalize`,
        prompts: (id: string) => `/projects/${id}/prompts`,
        competitors: (id: string) => `/projects/${id}/competitors`,
        models: (id: string) => `/projects/${id}/models`,
    },

    aiModels: {
        list: () => `/ai-models`,
        seed: () => `/ai-models/seed`,
    },

    analysis: {
        start: (projectId: string) => `/analysis/projects/${projectId}/analyze`,
        run: (runId: string) => `/analysis/runs/${runId}`,
        runs: (projectId: string, limit?: number) => `/analysis/projects/${projectId}/runs${typeof limit === "number" ? `?limit=${limit}` : ""}`,
        dashboard: (projectId: string) => `/analysis/projects/${projectId}/dashboard`,
        dashboardFixture: (projectId: string) => `/analysis/projects/${projectId}/dashboard-fixture`,
        alerts: (projectId: string, unreadOnly?: boolean) => `/analysis/projects/${projectId}/alerts${unreadOnly ? "?unreadOnly=true" : ""}`,
        perception: (projectId: string) => `/analysis/projects/${projectId}/perception`,
        pagesStats: (projectId: string) => `/analysis/projects/${projectId}/pages-stats`,
        optimizeActions: (projectId: string) => `/analysis/projects/${projectId}/optimize-actions`,
        optimizeAction: (projectId: string, actionId: string) => `/analysis/projects/${projectId}/optimize-actions/${actionId}`,
        contentOptimizer: {
            summary: (projectId: string) => `/analysis/projects/${projectId}/content-optimizer`,
            analyze: (projectId: string) => `/analysis/projects/${projectId}/content-optimizer/analyze`,
            generate: (projectId: string, recommendationId: string) =>
                `/analysis/projects/${projectId}/content-optimizer/recommendations/${recommendationId}/generate`,
            promote: (projectId: string, recommendationId: string) =>
                `/analysis/projects/${projectId}/content-optimizer/recommendations/${recommendationId}/promote`,
        },
        brandCanon: (projectId: string) => `/analysis/projects/${projectId}/brand-canon`,
    },

    optimize: {
        actions: () => `/api/optimize/actions`,
        action: (id: string) => `/api/optimize/actions/${id}`,
        generate: () => `/api/optimize/generate`,
        publish: {
            webflow: () => `/api/optimize/publish/webflow`,
            hubspot: () => `/api/optimize/publish/hubspot`,
        },
    },

    exports: {
        datasets: () => `/exports/datasets`,
        dataset: (projectId: string, dataset: string) => `/exports/projects/${projectId}/${dataset}`,
        demoDataset: (dataset: string) => `/exports/demo/${dataset}`,
    },
} as const;

export function buildApiPath(path: string): string {
    if (path.startsWith('/')) {
        return path;
    }

    return `/${path}`;
}

