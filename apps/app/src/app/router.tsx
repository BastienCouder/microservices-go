import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import type { AppRouterProps } from "./App";

const ProfilePage = lazy(() =>
  import("@/features/profile/views/profile-page").then((module) => ({
    default: module.ProfilePage,
  })),
);
const OrganizationsPage = lazy(() =>
  import("@/features/organizations").then((module) => ({
    default: module.OrganizationsPage,
  })),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard").then((module) => ({
    default: module.DashboardPage,
  })),
);
const PromptsPage = lazy(() =>
  import("@/features/prompts").then((module) => ({
    default: module.PromptsPage,
  })),
);
const PagesPage = lazy(() =>
  import("@/features/pages").then((module) => ({
    default: module.PagesPage,
  })),
);
const BrandsPage = lazy(() =>
  import("@/features/brands").then((module) => ({
    default: module.BrandsPage,
  })),
);
const ModelsPage = lazy(() =>
  import("@/features/models").then((module) => ({
    default: module.ModelsPage,
  })),
);
const PerceptionPage = lazy(() =>
  import("@/features/perception").then((module) => ({
    default: module.PerceptionPage,
  })),
);
const PerceptionBrandCanonPage = lazy(() =>
  import("@/features/perception/view/brand-canon-page").then((module) => ({
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
    path: "/pages",
    View: PagesPage,
  },
  {
    path: "/brands",
    View: BrandsPage,
  },
  {
    path: "/models",
    View: ModelsPage,
  },
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
        path="/dashboard"
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
        path="/perception"
        element={
          <Suspense fallback={null}>
            <PerceptionPage apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
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
      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}
