import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";
import { loadPromptsPageModule } from "./route-preloads";

const OrganizationsPage = lazy(() =>
  import("@/features/organizations").then((module) => ({
    default: module.OrganizationsPage,
  })),
);

import { MonitoringPage } from "@/features/monitoring";

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
const ModelsPage = lazy(() =>
  import("@/features/models").then((module) => ({
    default: module.ModelsPage,
  })),
);
const BrandsPage = lazy(() =>
  import("@/features/brands").then((module) => ({
    default: module.BrandsPage,
  })),
);

import { PerceptionPage } from "@/features/perception";

const PerceptionBrandCanonPage = lazy(() =>
  import("@/features/perception/brand-canon").then((module) => ({
    default: module.BrandCanonPage,
  })),
);



const SettingsPage = lazy(() =>
  import("@/features/settings").then((module) => ({
    default: module.SettingsPage,
  })),
);


const SIDEBAR_FEATURE_ROUTES = [] as const;

export function AppRouter({ apiBaseURL, busy, routeSearch, user }: AppRouterProps) {
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
     
      <Route
        path="/settings"
        element={
          <Suspense fallback={null}>
            <SettingsPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
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
