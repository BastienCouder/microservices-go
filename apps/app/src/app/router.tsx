import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";
import { loadPromptsPageModule } from "./route-preloads";

const ProfilePage = lazy(() =>
  import("@/features/profile/view").then((module) => ({
    default: module.ProfilePage,
  })),
);
const OrganizationsPage = lazy(() =>
  import("@/features/organizations").then((module) => ({
    default: module.OrganizationsPage,
  })),
);

import { DashboardPage } from "@/features/monitoring";

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
const OptimizeActionsPage = lazy(() =>
  import("@/features/optimize-actions").then((module) => ({
    default: module.OptimizeActionsPage,
  })),
);
const ContentOptimizerPage = lazy(() =>
  import("@/features/content-optimizer").then((module) => ({
    default: module.ContentOptimizerPage,
  })),
);
const ImpactPage = lazy(() =>
  import("@/features/impact").then((module) => ({
    default: module.ImpactPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings").then((module) => ({
    default: module.SettingsPage,
  })),
);

const SIDEBAR_FEATURE_ROUTES = [
  {
    path: "/optimize/actions",
    View: OptimizeActionsPage,
  },
  {
    path: "/optimize/content-optimizer",
    View: ContentOptimizerPage,
  },
  {
    path: "/impact",
    View: ImpactPage,
  },
  {
    path: "/settings",
    View: SettingsPage,
  },
] as const;

export function AppRouter({ apiBaseURL, busy, routeSearch, user }: AppRouterProps) {
  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          <Suspense fallback={null}>
            <OnboardingPage />
          </Suspense>
        }
      />
      <Route
        path="/monitoring"
        element={
          <Suspense fallback={null}>
            <DashboardPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
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
      {SIDEBAR_FEATURE_ROUTES.map((item) => (
        <Route
          key={item.path}
          path={item.path}
          element={
            <Suspense fallback={null}>
              <item.View />
            </Suspense>
          }
        />
      ))}
      <Route
        path="/profile"
        element={
          <Suspense fallback={null}>
            <ProfilePage user={user} />
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
