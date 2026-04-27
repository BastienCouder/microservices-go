import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";
import { MonitoringPage } from "@/features/monitoring/index";
import { ModelsPage } from "@/features/models/index";
import { PerceptionPage } from "@/features/perception";
import { PromptsPage } from "@/features/prompts/index";

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
const AdminModelsPage = lazy(() =>
  import("@/features/admin-models").then((module) => ({
    default: module.AdminModelsPage,
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

const PerceptionBrandCanonPage = lazy(() =>
  import("@/features/brands/brand-canon/index").then((module) => ({
    default: module.BrandCanonPage,
  })),
);

export function AppRouter({ apiBaseURL, busy, routeSearch, user }: AppRouterProps) {
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
        path="/models"
        element={
          <Suspense fallback={null}>
            <ModelsPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route
        path="/admin/models"
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
        path="/perception"
        element={
          <Suspense fallback={null}>
            <PerceptionPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
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
      <Route path="/" element={<Navigate replace to="/monitoring" />} />
      <Route path="*" element={<Navigate replace to="/monitoring" />} />
    </Routes>
  );
}
