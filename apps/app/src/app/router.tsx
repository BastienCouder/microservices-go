import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";
import {
  ADMIN_ROUTE_ROOT,
  adminRoutePaths,
  legacyAdminRoutePaths,
} from "@/shared/admin-routing";

function preloadRoute(loader: () => Promise<unknown>) {
  void loader().catch(() => {
    // Ignore preload failures. React.lazy will surface the error if the route is opened.
  });
}

export function loadOnboardingPageModule() {
  return import("@/features/onboarding").then((module) => ({
    default: module.OnboardingPage,
  }));
}

export function preloadOnboardingPage() {
  preloadRoute(loadOnboardingPageModule);
}

const OnboardingPage = lazy(loadOnboardingPageModule);

export function loadMonitoringPageModule() {
  return import("@/features/monitoring/index").then((module) => ({
    default: module.MonitoringPage,
  }));
}

export function preloadMonitoringPage() {
  preloadRoute(loadMonitoringPageModule);
}

const MonitoringPage = lazy(loadMonitoringPageModule);

export function loadPromptsPageModule() {
  return import("@/features/prompts/index").then((module) => ({
    default: module.PromptsPage,
  }));
}

export function preloadPromptsPage() {
  preloadRoute(loadPromptsPageModule);
}

const PromptsPage = lazy(loadPromptsPageModule);

export function loadPagesPageModule() {
  return import("@/features/pages/index").then((module) => ({
    default: module.PagesPage,
  }));
}

export function preloadPagesPage() {
  preloadRoute(loadPagesPageModule);
}

const PagesPage = lazy(loadPagesPageModule);

export function loadTrafficPageModule() {
  return import("@/features/traffic/index").then((module) => ({
    default: module.TrafficPage,
  }));
}

export function preloadTrafficPage() {
  preloadRoute(loadTrafficPageModule);
}

const TrafficPage = lazy(loadTrafficPageModule);

export function loadModelsPageModule() {
  return import("@/features/models/index").then((module) => ({
    default: module.ModelsPage,
  }));
}

export function preloadModelsPage() {
  preloadRoute(loadModelsPageModule);
}

const ModelsPage = lazy(loadModelsPageModule);

export function loadAdminModelsPageModule() {
  return import("@/features/admin/admin-models").then((module) => ({
    default: module.AdminModelsPage,
  }));
}

export function preloadAdminModelsPage() {
  preloadRoute(loadAdminModelsPageModule);
}

const AdminModelsPage = lazy(loadAdminModelsPageModule);

export function loadAdminOrganizationsPageModule() {
  return import("@/features/admin/admin-organizations").then((module) => ({
    default: module.AdminOrganizationsPage,
  }));
}

export function preloadAdminOrganizationsPage() {
  preloadRoute(loadAdminOrganizationsPageModule);
}

const AdminOrganizationsPage = lazy(loadAdminOrganizationsPageModule);

export function loadAdminUsersPageModule() {
  return import("@/features/admin/admin-users").then((module) => ({
    default: module.AdminUsersPage,
  }));
}

export function preloadAdminUsersPage() {
  preloadRoute(loadAdminUsersPageModule);
}

const AdminUsersPage = lazy(loadAdminUsersPageModule);

export function loadAdminPricingPageModule() {
  return import("@/features/admin/admin-pricing").then((module) => ({
    default: module.AdminPricingPage,
  }));
}

export function preloadAdminPricingPage() {
  preloadRoute(loadAdminPricingPageModule);
}

const AdminPricingPage = lazy(loadAdminPricingPageModule);

export function loadPerceptionPageModule() {
  return import("@/features/perception").then((module) => ({
    default: module.PerceptionPage,
  }));
}

export function preloadPerceptionPage() {
  preloadRoute(loadPerceptionPageModule);
}

const PerceptionPage = lazy(loadPerceptionPageModule);

export function loadPerceptionResponsesPageModule() {
  return import("@/features/perception/responses").then((module) => ({
    default: module.PerceptionResponsesPage,
  }));
}

export function preloadPerceptionResponsesPage() {
  preloadRoute(loadPerceptionResponsesPageModule);
}

const PerceptionResponsesPage = lazy(loadPerceptionResponsesPageModule);

export function loadContentOptimizerPageModule() {
  return import("@/features/content-optimizer/index").then((module) => ({
    default: module.ContentOptimizerPage,
  }));
}

export function preloadContentOptimizerPage() {
  preloadRoute(loadContentOptimizerPageModule);
}

const ContentOptimizerPage = lazy(loadContentOptimizerPageModule);

export function loadErrorHubPageModule() {
  return import("@/features/error-hub/index").then((module) => ({
    default: module.ErrorHubPage,
  }));
}

export function preloadErrorHubPage() {
  preloadRoute(loadErrorHubPageModule);
}

const ErrorHubPage = lazy(loadErrorHubPageModule);

export function loadBrandsPageModule() {
  return import("@/features/brands/index").then((module) => ({
    default: module.BrandsPage,
  }));
}

export function preloadBrandsPage() {
  preloadRoute(loadBrandsPageModule);
}

const BrandsPage = lazy(loadBrandsPageModule);

export function loadPerceptionBrandCanonPageModule() {
  return import("@/features/brands/brand-canon/index").then((module) => ({
    default: module.BrandCanonPage,
  }));
}

export function preloadPerceptionBrandCanonPage() {
  preloadRoute(loadPerceptionBrandCanonPageModule);
}

const PerceptionBrandCanonPage = lazy(loadPerceptionBrandCanonPageModule);

export function loadOrganizationsPageModule() {
  return import("@/features/organizations/index").then((module) => ({
    default: module.OrganizationsPage,
  }));
}

export function preloadOrganizationsPage() {
  preloadRoute(loadOrganizationsPageModule);
}

const OrganizationsPage = lazy(loadOrganizationsPageModule);

export function loadBillingGatePageModule() {
  return import("@/features/billing-gate/index").then((module) => ({
    default: module.BillingGatePage,
  }));
}

export function preloadBillingGatePage() {
  preloadRoute(loadBillingGatePageModule);
}

const BillingGatePage = lazy(loadBillingGatePageModule);

export function loadInvitationAcceptPageModule() {
  return import("@/features/invitations/index").then((module) => ({
    default: module.InvitationAcceptPage,
  }));
}

export function preloadInvitationAcceptPage() {
  preloadRoute(loadInvitationAcceptPageModule);
}

const InvitationAcceptPage = lazy(loadInvitationAcceptPageModule);

export function loadAccountPageModule() {
  return import("@/features/account/index").then((module) => ({
    default: module.AccountPage,
  }));
}

export function preloadAccountPage() {
  preloadRoute(loadAccountPageModule);
}

const AccountPage = lazy(loadAccountPageModule);

export function AppRouter({
  apiBaseURL,
  busy,
  routeSearch,
  user,
  onLogout,
  onRefresh,
}: AppRouterProps) {
  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          <Suspense fallback={null}>
            <OnboardingPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/monitoring"
        element={
          <Suspense fallback={null}>
            <MonitoringPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/prompts"
        element={
          <Suspense fallback={null}>
            <PromptsPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/pages"
        element={
          <Suspense fallback={null}>
            <PagesPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/traffic"
        element={
          <Suspense fallback={null}>
            <TrafficPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/geo"
        element={<Navigate replace to={{ pathname: "/traffic", search: routeSearch }} />}
      />
      <Route
        path="/models"
        element={
          <Suspense fallback={null}>
            <ModelsPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path={adminRoutePaths.models}
        element={
          <Suspense fallback={null}>
            <AdminModelsPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
            />
          </Suspense>
        }
      />
      <Route
        path={ADMIN_ROUTE_ROOT}
        element={
          <Navigate
            replace
            to={{ pathname: adminRoutePaths.organizations, search: routeSearch }}
          />
        }
      />
      <Route
        path={adminRoutePaths.organizations}
        element={
          <Suspense fallback={null}>
            <AdminOrganizationsPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
            />
          </Suspense>
        }
      />
      <Route
        path={adminRoutePaths.users}
        element={
          <Suspense fallback={null}>
            <AdminUsersPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
            />
          </Suspense>
        }
      />
      <Route
        path={adminRoutePaths.pricing}
        element={
          <Suspense fallback={null}>
            <AdminPricingPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
            />
          </Suspense>
        }
      />
      <Route
        path={legacyAdminRoutePaths.models}
        element={
          <Navigate
            replace
            to={{ pathname: adminRoutePaths.models, search: routeSearch }}
          />
        }
      />
      <Route
        path={legacyAdminRoutePaths.organizations}
        element={
          <Navigate
            replace
            to={{ pathname: adminRoutePaths.organizations, search: routeSearch }}
          />
        }
      />
      <Route
        path={legacyAdminRoutePaths.users}
        element={
          <Navigate
            replace
            to={{ pathname: adminRoutePaths.users, search: routeSearch }}
          />
        }
      />
      <Route
        path={legacyAdminRoutePaths.pricing}
        element={
          <Navigate
            replace
            to={{ pathname: adminRoutePaths.pricing, search: routeSearch }}
          />
        }
      />
      <Route
        path="/perception"
        element={
          <Suspense fallback={null}>
            <PerceptionPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/perception/responses"
        element={
          <Suspense fallback={null}>
            <PerceptionResponsesPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
            />
          </Suspense>
        }
      />
      <Route
        path="/content-optimizer"
        element={
          <Suspense fallback={null}>
            <ContentOptimizerPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
            />
          </Suspense>
        }
      />
      <Route
        path="/error-hub"
        element={
          <Suspense fallback={null}>
            <ErrorHubPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/brands"
        element={
          <Suspense fallback={null}>
            <BrandsPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/brand-canon"
        element={
          <Suspense fallback={null}>
            <PerceptionBrandCanonPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/organizations"
        element={
          <Suspense fallback={null}>
            <OrganizationsPage
              apiBaseURL={apiBaseURL}
              busy={busy}
              routeSearch={routeSearch}
              user={user}
            />
          </Suspense>
        }
      />
      <Route
        path="/billing"
        element={
          <Suspense fallback={null}>
            <BillingGatePage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
              user={user}
            />
          </Suspense>
        }
      />
      <Route
        path="/invitations/:token"
        element={
          <Suspense fallback={null}>
            <InvitationAcceptPage apiBaseURL={apiBaseURL} />
          </Suspense>
        }
      />
      <Route
        path="/account"
        element={
          <Suspense fallback={null}>
            <AccountPage
              apiBaseURL={apiBaseURL}
              busy={busy}
              user={user}
              onLogout={onLogout}
              onRefresh={onRefresh}
            />
          </Suspense>
        }
      />
      <Route path="/" element={<Navigate replace to="/monitoring" />} />
      <Route path="*" element={<Navigate replace to="/monitoring" />} />
    </Routes>
  );
}
