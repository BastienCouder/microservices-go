import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AppToaster } from "@/components/ui/toaster";
import { ACCOUNT_SETUP_SEARCH } from "@/features/onboarding/onboarding-mode";
import type { UserProfile } from "@/shared/models";
import { useAuthSession } from "@/features/session/hooks/use-auth-session";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";
import { redirectToWebAuth } from "@/shared/auth/web-auth";
import { loadBillingEntitlements } from "@/shared/billing";
import { loadUserOrganizationSummaries } from "@/shared/organizations";
import {
  applyResolvedProjectContextSearch,
  findResolvedProjectContext,
  loadProjectContextHierarchies,
} from "@/shared/project-context";
import {
  keepProjectOnlyContextSearch,
  readOrganizationIdFromSearch,
  readProjectTokenFromSearch,
  resolveSelectedContextSearch,
  SELECTED_CONTEXT_CHANGE_EVENT,
  storeSelectedProjectContext,
  storeLastSelectedProjectToken,
} from "@/shared/selection";
import {
  type BillingAccessState,
  shouldRedirectToBillingGate,
  shouldRedirectToOnboarding,
  shouldRedirectUnauthenticated,
} from "./auth-guard";
import { AppLayout } from "./layout";
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

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectionVersion, setSelectionVersion] = useState(0);
  const isOnboardingRoute = location.pathname === "/onboarding" || location.pathname.startsWith("/onboarding/");
  const isInvitationRoute = location.pathname === "/invitations" || location.pathname.startsWith("/invitations/");
  const isBillingRoute = location.pathname === "/billing" || location.pathname.startsWith("/billing/");
  const useCompactProjectContext =
    location.pathname === "/organizations" || location.pathname === "/account";
  const bypassResolvedContext = isOnboardingRoute || isInvitationRoute || isBillingRoute;
  const baseRouteSearch = useMemo(
    () =>
      bypassResolvedContext
        ? location.search
        : resolveSelectedContextSearch(location.search),
    [bypassResolvedContext, location.search, selectionVersion],
  );
  const routeProjectToken = useMemo(
    () => (bypassResolvedContext ? "" : readProjectTokenFromSearch(baseRouteSearch)),
    [baseRouteSearch, bypassResolvedContext],
  );
  const routeOrganizationToken = useMemo(
    () => (bypassResolvedContext ? "" : readOrganizationIdFromSearch(baseRouteSearch)),
    [baseRouteSearch, bypassResolvedContext],
  );
  const apiBaseURL = useMemo(() => getAPIBaseURL(), []);

  const { busy, user, feedback, refresh, logout } = useAuthSession(apiBaseURL);
  const shouldCheckBillingGuard =
    apiBaseURL.trim() !== "" && !busy && user !== null && !isInvitationRoute;
  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, user?.ID ?? null),
    enabled: shouldCheckBillingGuard,
    queryFn: ({ signal }) => loadUserOrganizationSummaries(apiBaseURL, signal),
  });
  const organizations = organizationsQuery.data ?? [];
  const organizationIdsKey = useMemo(
    () => organizations.map((organization) => organization.id).sort().join(","),
    [organizations],
  );
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
  const resolvedRouteSearch = useMemo(
    () =>
      bypassResolvedContext
        ? baseRouteSearch
        : applyResolvedProjectContextSearch(baseRouteSearch, resolvedProjectContext),
    [baseRouteSearch, bypassResolvedContext, resolvedProjectContext],
  );
  const routeSearch = useMemo(
    () =>
      useCompactProjectContext
        ? keepProjectOnlyContextSearch(resolvedRouteSearch)
        : resolvedRouteSearch,
    [resolvedRouteSearch, useCompactProjectContext],
  );
  const billingOrganizationId = organizations[0]?.id ?? "";
  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, billingOrganizationId),
    enabled: shouldCheckBillingGuard && billingOrganizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, billingOrganizationId, { signal }),
  });
  const billingAccess: BillingAccessState = !shouldCheckBillingGuard
    ? "loading"
    : organizationsQuery.isError || billingQuery.isError
      ? "unknown"
      : organizationsQuery.isLoading || organizationsQuery.isFetching
        ? "loading"
        : organizations.length === 0
          ? "missing_organization"
          : billingQuery.isLoading || billingQuery.isFetching
            ? "loading"
            : billingQuery.data?.isPaid === true
              ? "paid"
              : "unpaid";
  const shouldCheckProjectGuard =
    apiBaseURL.trim() !== "" &&
    !busy &&
    user !== null &&
    billingAccess === "paid" &&
    !isOnboardingRoute &&
    !isInvitationRoute &&
    !isBillingRoute;
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
  const mustRedirectToBillingGate = shouldRedirectToBillingGate({
    apiBaseURL,
    busy,
    user,
    isBillingRoute,
    isInvitationRoute,
    billingAccess,
  });

  useEffect(() => {
    if (!mustRedirectToAuth) {
      return;
    }
    redirectToWebAuth(window.location.href);
  }, [mustRedirectToAuth]);

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
    if (isOnboardingRoute || isInvitationRoute) return;

    if (routeProjectToken) {
      storeLastSelectedProjectToken(routeProjectToken);
    }
  }, [isInvitationRoute, isOnboardingRoute, routeProjectToken]);

  useEffect(() => {
    if (!resolvedProjectContext) return;

    storeSelectedProjectContext({
      organizationId: resolvedProjectContext.organizationId,
      projectId: resolvedProjectContext.projectId,
      projectToken: resolvedProjectContext.projectId,
    });
  }, [resolvedProjectContext]);

  useEffect(() => {
    if (!useCompactProjectContext) return;
    if (routeSearch === location.search) return;

    navigate(`${location.pathname}${routeSearch}${location.hash}`, {
      replace: true,
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    routeSearch,
    useCompactProjectContext,
  ]);

  if (!apiBaseURL) {
    return (
      <>
        <main className="app-root">
          <section className="card">
            <h1>Configuration manquante</h1>
            <p>
              La variable <code>VITE_API_BASE_URL</code> est requise pour appeler l&apos;API Gateway.
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

  if (shouldCheckBillingGuard && billingAccess === "loading") {
    return null;
  }

  if (mustRedirectToBillingGate) {
    return <Navigate replace to="/billing" />;
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
    return <Navigate replace to={`/onboarding${ACCOUNT_SETUP_SEARCH}`} />;
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

  return (
    <>
      <AppLayout apiBaseURL={apiBaseURL} busy={busy} feedback={feedback} onLogout={logout} onRefresh={refresh}>
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
