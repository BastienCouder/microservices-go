import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AppToaster } from "@/components/ui/toaster";
import {
  ACCOUNT_SETUP_SEARCH,
  PROJECT_SETUP_SEARCH,
  getOnboardingSetupMode,
} from "@/features/onboarding/onboarding-mode";
import { AdminBootstrapClaim } from "@/features/admin/admin-bootstrap-claim";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { UserProfile } from "@/shared/models";
import { useAuthSession } from "@/features/session/hooks/use-auth-session";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";
import { redirectToWebAuth, redirectToWebPricing } from "@/shared/auth/web-auth";
import { confirmStripeCheckoutSession, loadBillingEntitlements } from "@/shared/billing";
import {
  isNumericOrganizationId,
  loadUserOrganizationSummaries,
  resolveNumericOrganizationIdFromSummaries,
} from "@/shared/organizations";
import {
  applyResolvedProjectContextSearch,
  findResolvedProjectContext,
  loadProjectContextHierarchies,
} from "@/shared/project-context";
import {
  clearSelectedContext,
  clearSelectedProjectContext,
  clearProjectContextSearch,
  readOrganizationIdFromSearch,
  readProjectIdFromSearch,
  readProjectTokenFromSearch,
  readSelectedOrganizationID,
  readSelectedOrganizationPublicID,
  resolveSelectedContextSearch,
  SELECTED_CONTEXT_CHANGE_EVENT,
  storeSelectedOrganizationContext,
  storeSelectedProjectContext,
  storeSelectedProjectID,
} from "@/shared/selection";
import { isAnyAdminRoutePath, isSuperAdminRole } from "@/shared/admin-routing";
import {
  shouldRedirectAccountOnboardingToBilling,
  shouldRedirectAwayFromAccountOnboarding,
  type BillingAccessState,
  shouldRedirectToBillingGate,
  shouldRedirectToOnboarding,
  shouldRedirectUnauthenticated,
} from "./auth-guard";
import { AdminLayout, AppLayout } from "./layout";
import { AppRouter } from "./router";

import "./global.css";

function getAPIBaseURL(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  return typeof value === "string" ? value.trim() : "";
}

async function loadProjectCount(
  apiBaseURL: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.list(), {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const payload = unwrapGatewayPayload(response.data);
  return Array.isArray(payload) ? payload.length : 0;
}

async function loadAdminBootstrapStatus(
  apiBaseURL: string,
  signal?: AbortSignal,
): Promise<{ exists: boolean }> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.admin.bootstrapSuperAdminStatus(),
    {
      method: "GET",
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(response.error);
  }
  const payload = unwrapGatewayPayload(response.data);
  if (!payload || typeof payload !== "object") {
    return { exists: false };
  }
  const exists = (payload as { exists?: unknown }).exists;
  return { exists: exists === true };
}

async function findFirstPaidOrganizationId(
  apiBaseURL: string,
  organizationIds: string[],
  signal?: AbortSignal,
): Promise<string> {
  for (const organizationId of organizationIds) {
    try {
      const entitlements = await loadBillingEntitlements(apiBaseURL, organizationId, { signal });
      if (entitlements.isPaid) {
        return organizationId;
      }
    } catch {
      // Keep scanning the user's organizations until we find an active paid org.
    }
  }
  return "";
}

export default function App() {
  const { t } = useScopedI18n("app-shell");
  const location = useLocation();
  const navigate = useNavigate();
  const [selectionVersion, setSelectionVersion] = useState(0);
  const isOnboardingRoute = location.pathname === "/onboarding" || location.pathname.startsWith("/onboarding/");
  const isInvitationRoute = location.pathname === "/invitations" || location.pathname.startsWith("/invitations/");
  const isBillingRoute = location.pathname === "/billing" || location.pathname.startsWith("/billing/");
  const isAdminRoute = isAnyAdminRoutePath(location.pathname);
  const onboardingSetupMode = useMemo(
    () => getOnboardingSetupMode(location.search),
    [location.search],
  );
  const isCheckoutSuccessRoute = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("checkout") === "success";
  }, [location.search]);
  const checkoutSuccessSessionId = useMemo(() => {
    if (!isCheckoutSuccessRoute) return "";
    return new URLSearchParams(location.search).get("session_id")?.trim() ?? "";
  }, [isCheckoutSuccessRoute, location.search]);
  const checkoutSuccessOrganizationId = useMemo(() => {
    if (!isCheckoutSuccessRoute) return "";
    return new URLSearchParams(location.search).get("organization_id")?.trim() ?? "";
  }, [isCheckoutSuccessRoute, location.search]);
  const bypassResolvedContext =
    isOnboardingRoute || isInvitationRoute || isBillingRoute || isAdminRoute;
  const baseRouteSearch = useMemo(
    () => {
      void selectionVersion;
      return bypassResolvedContext
        ? location.search
        : resolveSelectedContextSearch(location.search);
    },
    [bypassResolvedContext, location.search, selectionVersion],
  );
  const routeProjectToken = useMemo(
    () => (bypassResolvedContext ? "" : readProjectTokenFromSearch(baseRouteSearch)),
    [baseRouteSearch, bypassResolvedContext],
  );
  const routeProjectId = useMemo(
    () => (bypassResolvedContext ? "" : readProjectIdFromSearch(baseRouteSearch)),
    [baseRouteSearch, bypassResolvedContext],
  );
  const routeOrganizationToken = useMemo(
    () => (bypassResolvedContext ? "" : readOrganizationIdFromSearch(baseRouteSearch)),
    [baseRouteSearch, bypassResolvedContext],
  );
  const apiBaseURL = useMemo(() => getAPIBaseURL(), []);

  const { busy, user, feedback, refresh, logout } = useAuthSession(apiBaseURL);
  const shouldCheckBillingGuard =
    apiBaseURL.trim() !== "" && !busy && user !== null && !isInvitationRoute && !isAdminRoute;
  const shouldCheckAdminBootstrapGate =
    apiBaseURL.trim() !== "" && !busy && user !== null && isAdminRoute;
  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(
      apiBaseURL,
      user?.ID ?? null,
      shouldCheckAdminBootstrapGate ? "admin" : "user",
    ),
    enabled: shouldCheckBillingGuard || shouldCheckAdminBootstrapGate,
    queryFn: ({ signal }) =>
      loadUserOrganizationSummaries(apiBaseURL, signal, {
        adminScope: shouldCheckAdminBootstrapGate,
      }),
  });
  const organizations = useMemo(
    () => organizationsQuery.data ?? [],
    [organizationsQuery.data],
  );
  const hasSuperAdminRole = useMemo(
    () => organizations.some((organization) => isSuperAdminRole(organization.role)),
    [organizations],
  );
  const adminBootstrapStatusQuery = useQuery({
    queryKey: ["admin-bootstrap-status", apiBaseURL, user?.ID ?? null],
    enabled: shouldCheckAdminBootstrapGate,
    queryFn: ({ signal }) => loadAdminBootstrapStatus(apiBaseURL, signal),
  });
  const isAdminGateInitialLoading =
    shouldCheckAdminBootstrapGate &&
    (
      (organizationsQuery.isLoading && organizationsQuery.data === undefined) ||
      (adminBootstrapStatusQuery.isLoading && adminBootstrapStatusQuery.data === undefined)
    );
  const organizationIdsKey = useMemo(
    () => organizations.map((organization) => organization.id).sort().join(","),
    [organizations],
  );
  const selectedOrganizationToken = useMemo(
    () => {
      void selectionVersion;
      return readSelectedOrganizationPublicID();
    },
    [selectionVersion],
  );
  const hasHardBillingOrganizationOverride = useMemo(
    () =>
      checkoutSuccessOrganizationId.trim() !== "" ||
      routeOrganizationToken.trim() !== "",
    [
      checkoutSuccessOrganizationId,
      routeOrganizationToken,
    ],
  );
  const hasStoredBillingOrganizationPreference =
    !hasHardBillingOrganizationOverride && selectedOrganizationToken.trim() !== "";
  const paidOrganizationFallbackQuery = useQuery({
    queryKey: ["billing", "paid-organization", apiBaseURL, organizationIdsKey],
    enabled:
      shouldCheckBillingGuard &&
      !hasHardBillingOrganizationOverride &&
      organizations.length > 1,
    queryFn: ({ signal }) =>
      findFirstPaidOrganizationId(
        apiBaseURL,
        organizations.map((organization) => organization.id),
        signal,
      ),
    staleTime: 30_000,
  });
  const billingOrganizationId = useMemo(() => {
    const candidates = [
      checkoutSuccessOrganizationId,
      routeOrganizationToken,
      selectedOrganizationToken,
      paidOrganizationFallbackQuery.data ?? "",
      !hasHardBillingOrganizationOverride &&
      (paidOrganizationFallbackQuery.isLoading || paidOrganizationFallbackQuery.isFetching)
        ? ""
        : organizations[0]?.id ?? "",
    ];

    for (const candidate of candidates) {
      const normalized = candidate.trim();
      if (!normalized) {
        continue;
      }
      if (isNumericOrganizationId(normalized)) {
        return normalized;
      }

      const resolved = resolveNumericOrganizationIdFromSummaries(
        organizations,
        normalized,
      );
      if (resolved) {
        return resolved;
      }
    }

    return "";
  }, [
    checkoutSuccessOrganizationId,
    hasHardBillingOrganizationOverride,
    organizations,
    paidOrganizationFallbackQuery.data,
    paidOrganizationFallbackQuery.isFetching,
    paidOrganizationFallbackQuery.isLoading,
    routeOrganizationToken,
    selectedOrganizationToken,
  ]);
  const checkoutConfirmationOrganizationId =
    checkoutSuccessOrganizationId || billingOrganizationId;
  const billingEntitlementsQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, billingOrganizationId),
    enabled: shouldCheckBillingGuard && billingOrganizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, billingOrganizationId, { signal }),
  });
  const refetchBillingEntitlements = billingEntitlementsQuery.refetch;
  const stripeCheckoutConfirmationQuery = useQuery({
    queryKey: [
      "stripe-checkout-confirmation",
      apiBaseURL,
      checkoutConfirmationOrganizationId,
      checkoutSuccessSessionId,
    ],
    enabled:
      apiBaseURL.trim() !== "" &&
      !busy &&
      user !== null &&
      isCheckoutSuccessRoute &&
      checkoutSuccessSessionId !== "" &&
      checkoutConfirmationOrganizationId !== "",
    queryFn: () =>
      confirmStripeCheckoutSession(apiBaseURL, {
        organizationId: checkoutConfirmationOrganizationId,
        sessionId: checkoutSuccessSessionId,
      }),
    retry: 2,
    staleTime: Infinity,
  });
  const shouldResolveRouteProjectContext =
    apiBaseURL.trim() !== "" &&
    !busy &&
    user !== null &&
    !bypassResolvedContext &&
    routeProjectToken !== "" &&
    organizations.length > 0;
  const routeProjectContextQuery = useQuery({
    queryKey: appQueryKeys.projectContextHierarchies(apiBaseURL, organizationIdsKey),
    enabled: shouldResolveRouteProjectContext,
    queryFn: ({ signal }) =>
      loadProjectContextHierarchies(apiBaseURL, organizations, signal),
  });
  const resolvedProjectContext = useMemo(
    () =>
      findResolvedProjectContext(
        routeProjectContextQuery.data ?? [],
        routeProjectToken,
        routeOrganizationToken,
      ),
    [routeOrganizationToken, routeProjectContextQuery.data, routeProjectToken],
  );
  const hasUnresolvedRouteProjectContext =
    apiBaseURL.trim() !== "" &&
    !busy &&
    user !== null &&
    !bypassResolvedContext &&
    routeProjectToken !== "" &&
    (
      (organizationsQuery.isSuccess && organizations.length === 0) ||
      (
        shouldResolveRouteProjectContext &&
        !routeProjectContextQuery.isLoading &&
        !routeProjectContextQuery.isFetching &&
        routeProjectContextQuery.data !== undefined &&
        resolvedProjectContext === null
      )
    );
  const resolvedRouteSearch = useMemo(
    () => {
      if (bypassResolvedContext) {
        return baseRouteSearch;
      }
      if (resolvedProjectContext) {
        return applyResolvedProjectContextSearch(baseRouteSearch, resolvedProjectContext);
      }
      if (hasUnresolvedRouteProjectContext) {
        return clearProjectContextSearch(baseRouteSearch);
      }
      return baseRouteSearch;
    },
    [
      baseRouteSearch,
      bypassResolvedContext,
      hasUnresolvedRouteProjectContext,
      resolvedProjectContext,
    ],
  );
  const routeSearch = resolvedRouteSearch;
  const billingAccess: BillingAccessState = !shouldCheckBillingGuard
    ? "loading"
    : organizationsQuery.isError
      ? "unknown"
    : organizationsQuery.isLoading || organizationsQuery.isFetching
      ? "loading"
    : !hasHardBillingOrganizationOverride &&
        organizations.length > 1 &&
        (paidOrganizationFallbackQuery.isLoading || paidOrganizationFallbackQuery.isFetching)
      ? "loading"
    : organizations.length === 0
      ? "missing_organization"
    : billingOrganizationId === ""
      ? "loading"
    : billingEntitlementsQuery.isError
      ? "unknown"
    : billingEntitlementsQuery.isLoading || billingEntitlementsQuery.isFetching
      ? "loading"
    : billingEntitlementsQuery.data?.isPaid === true
      ? "paid"
      : "unpaid";
  const shouldAutoSelectPaidOrganization =
    shouldCheckBillingGuard &&
    !hasHardBillingOrganizationOverride &&
    hasStoredBillingOrganizationPreference &&
    billingAccess === "unpaid" &&
    (paidOrganizationFallbackQuery.data ?? "") !== "" &&
    (paidOrganizationFallbackQuery.data ?? "") !== billingOrganizationId;
  const shouldCheckAccountOnboardingProjectGuard =
    apiBaseURL.trim() !== "" &&
    !busy &&
      user !== null &&
      isOnboardingRoute &&
      onboardingSetupMode === "account" &&
      !isInvitationRoute &&
      !isBillingRoute &&
      !isAdminRoute;
  const shouldCheckProjectGuard =
    shouldCheckAccountOnboardingProjectGuard ||
    (
      apiBaseURL.trim() !== "" &&
      !busy &&
      user !== null &&
      !isAdminRoute &&
      !isOnboardingRoute &&
      !isInvitationRoute &&
      !isBillingRoute
    );
  const mustRedirectToAuth = shouldRedirectUnauthenticated({ apiBaseURL, busy, user });
  const projectGuardQuery = useQuery({
    queryKey: ["route-project-guard", apiBaseURL, user?.ID ?? null],
    enabled: shouldCheckProjectGuard,
    queryFn: ({ signal }) => loadProjectCount(apiBaseURL, signal),
  });
  const mustRedirectToOnboarding = shouldRedirectToOnboarding({
    apiBaseURL,
    busy,
    user,
    isOnboardingRoute,
    isBillingRoute,
    isInvitationRoute,
    billingAccess,
    projectCount:
      projectGuardQuery.isLoading || projectGuardQuery.isFetching
        ? null
        : projectGuardQuery.data ?? null,
  });
  const mustRedirectAwayFromAccountOnboarding =
    shouldRedirectAwayFromAccountOnboarding({
      apiBaseURL,
      busy,
      user,
      isOnboardingRoute,
      onboardingSetupMode,
      organizationCount:
        organizationsQuery.isLoading || organizationsQuery.isFetching
          ? null
          : organizations.length,
      projectCount:
        projectGuardQuery.isLoading || projectGuardQuery.isFetching
          ? null
          : projectGuardQuery.data ?? null,
    });
  const mustRedirectAccountOnboardingToBilling =
    shouldRedirectAccountOnboardingToBilling({
      apiBaseURL,
      busy,
      user,
      isOnboardingRoute,
      onboardingSetupMode,
      billingAccess,
      isCheckoutSuccessRoute,
    });
  const mustRedirectToBillingGate = shouldRedirectToBillingGate({
    apiBaseURL,
    busy,
    user,
    isBillingRoute,
    isInvitationRoute,
    billingAccess:
      isOnboardingRoute && isCheckoutSuccessRoute ? "paid" : billingAccess,
  });

  useLayoutEffect(() => {
    if (!mustRedirectToAuth) {
      return;
    }
    redirectToWebAuth(window.location.href);
  }, [mustRedirectToAuth]);

  useLayoutEffect(() => {
    if (!mustRedirectAccountOnboardingToBilling) {
      return;
    }
    redirectToWebPricing();
  }, [mustRedirectAccountOnboardingToBilling]);

  useLayoutEffect(() => {
    if (!mustRedirectToBillingGate) {
      return;
    }
    redirectToWebPricing();
  }, [mustRedirectToBillingGate]);

  useEffect(() => {
    if (!shouldAutoSelectPaidOrganization) {
      return;
    }

    storeSelectedOrganizationContext({
      organizationId: paidOrganizationFallbackQuery.data ?? "",
      publicId: paidOrganizationFallbackQuery.data ?? "",
    });
  }, [paidOrganizationFallbackQuery.data, shouldAutoSelectPaidOrganization]);

  useEffect(() => {
    const refreshSelection = () => setSelectionVersion((current) => current + 1);
    window.addEventListener(SELECTED_CONTEXT_CHANGE_EVENT, refreshSelection);
    window.addEventListener("storage", refreshSelection);
    return () => {
      window.removeEventListener(SELECTED_CONTEXT_CHANGE_EVENT, refreshSelection);
      window.removeEventListener("storage", refreshSelection);
    };
  }, []);

  useEffect(() => {
    if (!stripeCheckoutConfirmationQuery.isSuccess) {
      return;
    }
    if (billingOrganizationId === "" || billingOrganizationId !== checkoutConfirmationOrganizationId) {
      return;
    }
    void refetchBillingEntitlements();
  }, [
    billingOrganizationId,
    checkoutConfirmationOrganizationId,
    refetchBillingEntitlements,
    stripeCheckoutConfirmationQuery.isSuccess,
  ]);

  useEffect(() => {
    if (isOnboardingRoute || isInvitationRoute) return;

    if (routeProjectId) {
      storeSelectedProjectID(routeProjectId);
    }
  }, [isInvitationRoute, isOnboardingRoute, routeProjectId]);

  useEffect(() => {
    if (!hasUnresolvedRouteProjectContext) return;

    clearSelectedProjectContext();
  }, [hasUnresolvedRouteProjectContext]);

  useEffect(() => {
    if (!resolvedProjectContext) return;

    storeSelectedProjectContext({
      organizationId: resolvedProjectContext.organizationId,
      organizationPublicId:
        resolvedProjectContext.organizationPublicId || resolvedProjectContext.organizationId,
      projectId: resolvedProjectContext.projectId,
    });
  }, [resolvedProjectContext]);

  useEffect(() => {
    if (organizations.length === 0) return;

    const selectedOrganizationId = routeOrganizationToken || readSelectedOrganizationID();
    const selectedOrganizationPublicId = readSelectedOrganizationPublicID();
    const selectedOrganization =
      organizations.find(
        (organization) =>
          organization.id === selectedOrganizationId ||
          organization.publicId === selectedOrganizationId ||
          organization.slug === selectedOrganizationId ||
          organization.publicId === selectedOrganizationPublicId ||
          organization.slug === selectedOrganizationPublicId,
      ) ?? null;

    if (!selectedOrganization) {
      if (!isAdminRoute && (selectedOrganizationId || selectedOrganizationPublicId)) {
        clearSelectedContext();
      }
      return;
    }

    storeSelectedOrganizationContext({
      organizationId: selectedOrganization.id,
      publicId: selectedOrganization.publicId || selectedOrganization.id,
    });
  }, [isAdminRoute, organizations, routeOrganizationToken]);

  useEffect(() => {
    if (bypassResolvedContext) return;
    if (
      routeProjectToken !== "" &&
      !resolvedProjectContext &&
      !hasUnresolvedRouteProjectContext
    ) {
      return;
    }
    if (routeSearch === location.search) return;

    navigate(`${location.pathname}${routeSearch}${location.hash}`, {
      replace: true,
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    bypassResolvedContext,
    resolvedProjectContext,
    routeProjectToken,
    routeSearch,
    hasUnresolvedRouteProjectContext,
  ]);

  if (!apiBaseURL) {
    return (
      <>
        <main className="app-root">
          <section className="card">
            <h1>{t("missingConfigurationTitle")}</h1>
            <p>
              {t("missingApiBaseUrlDescription")}
            </p>
          </section>
        </main>
        <AppToaster />
      </>
    );
  }

  if (mustRedirectToAuth) {
    return null;
  }

  if (isAdminGateInitialLoading) {
    return null;
  }

  if (
    shouldCheckBillingGuard &&
    billingAccess === "loading" &&
    !(isOnboardingRoute && isCheckoutSuccessRoute)
  ) {
    return null;
  }

  if (mustRedirectToBillingGate) {
    return null;
  }

  if (mustRedirectAccountOnboardingToBilling) {
    return null;
  }

  if (isBillingRoute && billingAccess === "paid") {
    return <Navigate replace to="/monitoring" />;
  }

  if (shouldCheckProjectGuard && (projectGuardQuery.isLoading || projectGuardQuery.isFetching)) {
    return null;
  }

  if (
    shouldResolveRouteProjectContext &&
    routeProjectContextQuery.isLoading &&
    routeProjectContextQuery.data === undefined
  ) {
    return null;
  }

  if (mustRedirectToOnboarding) {
    const onboardingSearch =
      billingAccess === "missing_organization"
        ? ACCOUNT_SETUP_SEARCH
        : PROJECT_SETUP_SEARCH;
    return <Navigate replace to={`/onboarding${onboardingSearch}`} />;
  }

  if (mustRedirectAwayFromAccountOnboarding) {
    return <Navigate replace to={`/onboarding${PROJECT_SETUP_SEARCH}`} />;
  }

  if (isOnboardingRoute && busy) {
    return null;
  }

  if (isOnboardingRoute || isInvitationRoute || isBillingRoute) {
    return (
      <>
        <AppRouter
          apiBaseURL={apiBaseURL}
          routeSearch={routeSearch}
          user={user}
          busy={busy}
          onLogout={logout}
          onRefresh={refresh}
        />
        <AppToaster />
      </>
    );
  }

  if (isAdminRoute) {
    if (!hasSuperAdminRole) {
      if (
        adminBootstrapStatusQuery.data?.exists === true ||
        adminBootstrapStatusQuery.isError ||
        organizationsQuery.isError
      ) {
        return <Navigate replace to="/monitoring" />;
      }
      return (
        <>
          <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
            <AdminBootstrapClaim apiBaseURL={apiBaseURL} />
          </main>
          <AppToaster />
        </>
      );
    }

    return (
      <>
        <AdminLayout busy={busy} onLogout={logout}>
          <AppRouter
            apiBaseURL={apiBaseURL}
            routeSearch={routeSearch}
            user={user}
            busy={busy}
            onLogout={logout}
            onRefresh={refresh}
          />
        </AdminLayout>
        <AppToaster />
      </>
    );
  }

  return (
    <>
      <AppLayout
        apiBaseURL={apiBaseURL}
        busy={busy}
        feedback={feedback}
        userId={user?.ID ?? null}
        onLogout={logout}
        onRefresh={refresh}
      >
        <AppRouter
          apiBaseURL={apiBaseURL}
          routeSearch={routeSearch}
          user={user}
          busy={busy}
          onLogout={logout}
          onRefresh={refresh}
        />
      </AppLayout>
      <AppToaster />
    </>
  );
}

export type AppRouterProps = {
  apiBaseURL: string;
  busy: boolean;
  routeSearch: string;
  user: UserProfile | null;
  onLogout?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
};
