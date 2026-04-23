import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";
import { loadPromptsPageModule } from "./route-preloads";

import { MonitoringPage } from "@/features/monitoring";
import { ModelsPage } from "@/features/models";
import { PerceptionPage } from "@/features/perception";

const PromptsPage = lazy(loadPromptsPageModule);
const OnboardingPage = lazy(() =>
  import("@/features/onboarding").then((module) => ({
    default: module.OnboardingPage,
  })),
);
const PagesPage = lazy(() =>
  import("@/features/pages").then((module) => ({
    default: module.PagesPage,
  })),
);
const AdminModelsPage = lazy(() =>
  import("@/features/admin-models").then((module) => ({
    default: module.AdminModelsPage,
  })),
);
const BrandsPage = lazy(() =>
  import("@/features/brands").then((module) => ({
    default: module.BrandsPage,
  })),
);

const PerceptionBrandCanonPage = lazy(() =>
  import("@/features/brands/brand-canon").then((module) => ({
    default: module.BrandCanonPage,
  })),
);

export function AppRouter({ apiBaseURL, routeSearch }: AppRouterProps) {
  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          <Suspense fallback={null}>
            <OnboardingPage apiBaseURL={apiBaseURL} />
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
        path="/perception/brand-canon"
        element={
          <Suspense fallback={null}>
            <PerceptionBrandCanonPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
          </Suspense>
        }
      />
      <Route path="/" element={<Navigate replace to="/monitoring" />} />
      <Route path="*" element={<Navigate replace to="/monitoring" />} />
    </Routes>
  );
}
