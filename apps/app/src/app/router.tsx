import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";
import { MonitoringPage } from "@/features/monitoring/index";
import { ModelsPage } from "@/features/models/index";
import { PerceptionPage } from "@/features/perception";
import { PromptsPage } from "@/features/prompts/index";
import {
  ADMIN_ROUTE_ROOT,
  adminRoutePaths,
  legacyAdminRoutePaths,
} from "@/shared/admin-routing";



const OnboardingPage = lazy(() =>
  import("@/features/onboarding").then((module) => ({
    default: module.OnboardingPage,
  })),
);
const PagesPage = lazy(() =>
  import("@/features/pages/index").then((module) => ({
    default: module.PagesPage,
  })),
);
const TrafficPage = lazy(() =>
  import("@/features/traffic/index").then((module) => ({
    default: module.TrafficPage,
  })),
);
const AdminModelsPage = lazy(() =>
  import("@/features/admin/admin-models").then((module) => ({
    default: module.AdminModelsPage,
  })),
);
const AdminOrganizationsPage = lazy(() =>
  import("@/features/admin/admin-organizations").then((module) => ({
    default: module.AdminOrganizationsPage,
  })),
);
const AdminPricingPage = lazy(() =>
  import("@/features/admin/admin-pricing").then((module) => ({
    default: module.AdminPricingPage,
  })),
);
const BrandsPage = lazy(() =>
  import("@/features/brands/index").then((module) => ({
    default: module.BrandsPage,
  })),
);
const OrganizationsPage = lazy(() =>
  import("@/features/organizations/index").then((module) => ({
    default: module.OrganizationsPage,
  })),
);
const InvitationAcceptPage = lazy(() =>
  import("@/features/invitations/index").then((module) => ({
    default: module.InvitationAcceptPage,
  })),
);
const BillingGatePage = lazy(() =>
  import("@/features/billing-gate/index").then((module) => ({
    default: module.BillingGatePage,
  })),
);
const AccountPage = lazy(() =>
  import("@/features/account/index").then((module) => ({
    default: module.AccountPage,
  })),
);
const ContentOptimizerPage = lazy(() =>
  import("@/features/content-optimizer/index").then((module) => ({
    default: module.ContentOptimizerPage,
  })),
);
const AgentReadyPage = lazy(() =>
  import("@/features/ai-agent-ready/index").then((module) => ({
    default: module.AgentReadyPage,
  })),
);

const PerceptionBrandCanonPage = lazy(() =>
  import("@/features/brands/brand-canon/index").then((module) => ({
    default: module.BrandCanonPage,
  })),
);

const ErrorHubPage = lazy(() =>
  import("@/features/error-hub/index").then((module) => ({
    default: module.ErrorHubPage,
  })),
);
const PerceptionOptimizeActionsPage = ErrorHubPage;

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
        path="/crawler"
        element={<Navigate replace to={{ pathname: "/content-optimizer", search: routeSearch }} />}
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
        path="/ai-agent-ready"
        element={
          <Suspense fallback={null}>
            <AgentReadyPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
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
        path="/optimize/actions"
        element={
          <Suspense fallback={null}>
            <PerceptionOptimizeActionsPage
              apiBaseURL={apiBaseURL}
              routeSearch={routeSearch}
            />
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
